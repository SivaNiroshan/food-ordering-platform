import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createUserAndLogin } from '../../../test/helpers.js';

const app = createApp();
type Session = Awaited<ReturnType<typeof createUserAndLogin>>;

let admin: Session;

beforeEach(async () => {
  admin = await createUserAndLogin(app, 'ADMIN');
});

describe('admin user management', () => {
  it('is only available to admins', async () => {
    const staff = await createUserAndLogin(app, 'STAFF');
    const res = await request(app).get('/api/v1/admin/users').set(staff.auth);
    expect(res.status).toBe(403);
  });

  it('creates a staff account that can log in', async () => {
    const res = await request(app).post('/api/v1/admin/users').set(admin.auth).send({
      name: 'Kamal P',
      email: 'kamal@foodflow.lk',
      password: 'TempPass123',
      role: 'STAFF',
    });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('STAFF');

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'kamal@foodflow.lk', password: 'TempPass123' })
      .expect(200);
  });

  it('does not create customers through the admin endpoint', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set(admin.auth)
      .send({ name: 'Someone', email: 'x@foodflow.lk', password: 'TempPass123', role: 'CUSTOMER' });
    expect(res.status).toBe(400);
  });

  it('filters users by role and search text', async () => {
    await createUserAndLogin(app, 'CUSTOMER');
    await createUserAndLogin(app, 'STAFF');

    const staffOnly = await request(app).get('/api/v1/admin/users?role=STAFF').set(admin.auth);
    expect(staffOnly.body.data.every((u: { role: string }) => u.role === 'STAFF')).toBe(true);

    const search = await request(app).get('/api/v1/admin/users?search=customer').set(admin.auth);
    expect(search.body.meta.totalItems).toBe(1);
  });

  it('deactivates a user, which immediately blocks their requests', async () => {
    const customer = await createUserAndLogin(app, 'CUSTOMER');

    await request(app)
      .patch(`/api/v1/admin/users/${customer.user.id}/status`)
      .set(admin.auth)
      .send({ isActive: false })
      .expect(200);

    expect((await request(app).get('/api/v1/me').set(customer.auth)).status).toBe(401);
  });

  it('applies a role change on the next request', async () => {
    const customer = await createUserAndLogin(app, 'CUSTOMER');
    expect((await request(app).get('/api/v1/staff/orders').set(customer.auth)).status).toBe(403);

    await request(app)
      .patch(`/api/v1/admin/users/${customer.user.id}/role`)
      .set(admin.auth)
      .send({ role: 'STAFF' })
      .expect(200);

    expect((await request(app).get('/api/v1/staff/orders').set(customer.auth)).status).toBe(200);
  });

  it('prevents admins from changing their own role or status', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${admin.user.id}/status`)
      .set(admin.auth)
      .send({ isActive: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_MODIFY_SELF');
  });

  it('returns 404 for an unknown user', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/0195f0b4-0000-7000-8000-000000000000/status')
      .set(admin.auth)
      .send({ isActive: false });
    expect(res.status).toBe(404);
  });
});