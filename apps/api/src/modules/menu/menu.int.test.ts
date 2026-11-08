import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { createCategory, createMenuItem, createUserAndLogin } from '../../../test/helpers.js';

const app = createApp();

describe('public menu', () => {
  it('returns only active items in active categories', async () => {
    const active = await createCategory();
    const hidden = await createCategory({ isActive: false });
    await createMenuItem(active.id, { name: 'Visible Kottu' });
    await createMenuItem(active.id, { name: 'Removed Item', isActive: false });
    await createMenuItem(hidden.id, { name: 'Item In Hidden Category' });

    const res = await request(app).get('/api/v1/menu-items');

    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { name: string }) => i.name)).toEqual(['Visible Kottu']);
  });

  it('searches names regardless of letter case', async () => {
    const category = await createCategory();
    await createMenuItem(category.id, { name: 'Chicken Kottu' });
    await createMenuItem(category.id, { name: 'Iced Milo' });

    const res = await request(app).get('/api/v1/menu-items?search=KOTTU');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Chicken Kottu');
  });

  it('filters by category and rejects an invalid categoryId', async () => {
    const a = await createCategory();
    const b = await createCategory();
    await createMenuItem(a.id);
    await createMenuItem(b.id);

    const res = await request(app).get(`/api/v1/menu-items?categoryId=${a.id}`);
    expect(res.body.data).toHaveLength(1);

    const bad = await request(app).get('/api/v1/menu-items?categoryId=abc');
    expect(bad.status).toBe(400);
  });

  it('treats availableOnly=false as false (string-boolean trap)', async () => {
    const category = await createCategory();
    await createMenuItem(category.id, { isAvailable: true });
    await createMenuItem(category.id, { isAvailable: false });

    const all = await request(app).get('/api/v1/menu-items?availableOnly=false');
    expect(all.body.data).toHaveLength(2);

    const availableOnly = await request(app).get('/api/v1/menu-items?availableOnly=true');
    expect(availableOnly.body.data).toHaveLength(1);
  });

  it('paginates with correct metadata', async () => {
    const category = await createCategory();
    for (const name of ['A', 'B', 'C']) await createMenuItem(category.id, { name: `Item ${name}` });

    const res = await request(app).get('/api/v1/menu-items?pageSize=2&page=2');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, totalItems: 3, totalPages: 2 });
  });

  it('returns prices as strings with two decimals', async () => {
    const category = await createCategory();
    await createMenuItem(category.id, { price: '1200' });

    const res = await request(app).get('/api/v1/menu-items');
    expect(res.body.data[0].price).toBe('1200.00');
  });

  it('returns 404 for an inactive item and 400 for a malformed id', async () => {
    const category = await createCategory();
    const item = await createMenuItem(category.id, { isActive: false });

    expect((await request(app).get(`/api/v1/menu-items/${item.id}`)).status).toBe(404);
    expect((await request(app).get('/api/v1/menu-items/not-a-uuid')).status).toBe(400);
  });
});

describe('staff menu management', () => {
  let staff: Awaited<ReturnType<typeof createUserAndLogin>>;

  beforeEach(async () => {
    staff = await createUserAndLogin(app, 'STAFF');
  });

  it('requires a token and a staff role', async () => {
    expect((await request(app).get('/api/v1/staff/menu-items')).status).toBe(401);

    const customer = await createUserAndLogin(app, 'CUSTOMER');
    const res = await request(app).get('/api/v1/staff/menu-items').set(customer.auth);
    expect(res.status).toBe(403);
  });

  it('validates prices and requires an active category', async () => {
    const active = await createCategory();
    const inactive = await createCategory({ isActive: false });
    const base = { categoryId: active.id, name: 'New Item' };

    for (const price of ['-5', '10.999']) {
      const res = await request(app)
        .post('/api/v1/staff/menu-items')
        .set(staff.auth)
        .send({ ...base, price });
      expect(res.status).toBe(400);
    }

    const res = await request(app)
      .post('/api/v1/staff/menu-items')
      .set(staff.auth)
      .send({ ...base, categoryId: inactive.id, price: '100.00' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('creates an item that appears on the public menu', async () => {
    const category = await createCategory();
    const res = await request(app)
      .post('/api/v1/staff/menu-items')
      .set(staff.auth)
      .send({ categoryId: category.id, name: 'Egg Hopper', price: '150.00' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Egg Hopper', price: '150.00', isActive: true });

    const menu = await request(app).get('/api/v1/menu-items');
    expect(menu.body.data[0].name).toBe('Egg Hopper');
  });

  it('rejects duplicate category names regardless of case', async () => {
    await request(app)
      .post('/api/v1/staff/categories')
      .set(staff.auth)
      .send({ name: 'Drinks' })
      .expect(201);
    const res = await request(app)
      .post('/api/v1/staff/categories')
      .set(staff.auth)
      .send({ name: 'DRINKS' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_ALREADY_EXISTS');
  });

  it('rejects renaming a category to an existing name', async () => {
    await createCategory({ name: 'Drinks' });
    const other = await createCategory({ name: 'Kottu' });

    const res = await request(app)
      .patch(`/api/v1/staff/categories/${other.id}`)
      .set(staff.auth)
      .send({ name: 'drinks' });
    expect(res.status).toBe(409);
  });

  it('hides a deactivated item from customers but not from staff', async () => {
    const category = await createCategory();
    const item = await createMenuItem(category.id);

    await request(app)
      .patch(`/api/v1/staff/menu-items/${item.id}`)
      .set(staff.auth)
      .send({ isActive: false })
      .expect(200);

    expect((await request(app).get('/api/v1/menu-items')).body.data).toHaveLength(0);
    const staffList = await request(app).get('/api/v1/staff/menu-items').set(staff.auth);
    expect(staffList.body.data).toHaveLength(1);
  });

  it('rejects an empty PATCH body', async () => {
    const category = await createCategory();
    const item = await createMenuItem(category.id);

    const res = await request(app)
      .patch(`/api/v1/staff/menu-items/${item.id}`)
      .set(staff.auth)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when updating a menu item that does not exist', async () => {
    const res = await request(app)
      .patch('/api/v1/staff/menu-items/0195f0b4-0000-7000-8000-000000000000')
      .set(staff.auth)
      .send({ isAvailable: false });
    expect(res.status).toBe(404);
  });
});
