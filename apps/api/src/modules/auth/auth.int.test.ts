import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';

const app = createApp();
const customer = { name: 'Test Customer', email: 'Customer@Example.com', password: 'Secret123' };

function getRefreshCookie(res: request.Response): string {
  const raw: unknown = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? (raw as string[]) : [];
  const cookie = cookies.find((c) => c.startsWith('refresh_token='));
  if (!cookie) throw new Error('refresh_token cookie was not set');
  return cookie.split(';')[0] ?? '';
}

async function registerAndLogin() {
  await request(app).post('/api/v1/auth/register').send(customer).expect(201);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: customer.email, password: customer.password })
    .expect(200);
  return { accessToken: res.body.accessToken as string, cookie: getRefreshCookie(res) };
}

describe('POST /auth/register', () => {
  it('creates a CUSTOMER even if another role is sent, and hides the password hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...customer, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: customer.name, role: 'CUSTOMER' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email regardless of letter case', async () => {
    await request(app).post('/api/v1/auth/register').send(customer).expect(201);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...customer, email: 'customer@example.COM' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects a weak password with field-level details', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...customer, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
    );
  });
});

describe('POST /auth/login', () => {
  it('returns an access token and sets an httpOnly refresh cookie', async () => {
    await request(app).post('/api/v1/auth/register').send(customer).expect(201);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: customer.password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(String(res.headers['set-cookie'])).toContain('HttpOnly');
  });

  it('returns the identical error for a wrong password and an unknown email', async () => {
    await request(app).post('/api/v1/auth/register').send(customer).expect(201);
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customer.email, password: 'Wrong1234' });
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'Wrong1234' });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error).toEqual(unknownEmail.body.error);
  });
});

describe('GET /me', () => {
  it('returns the current user with a valid token', async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(customer.email);
  });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('rejects a still-valid token once the account is deactivated', async () => {
    const { accessToken } = await registerAndLogin();
    await prisma.user.updateMany({ data: { isActive: false } });

    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token', async () => {
    const { cookie } = await registerAndLogin();
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(getRefreshCookie(res)).not.toBe(cookie);
  });

  it('detects reuse of a rotated token and revokes every session', async () => {
    const { cookie: first } = await registerAndLogin();
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', first)
      .expect(200);
    const second = getRefreshCookie(rotated);

    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', first);
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // The legitimate newer token is revoked too
    const afterReuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', second);
    expect(afterReuse.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token', async () => {
    const { cookie } = await registerAndLogin();
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });
});
