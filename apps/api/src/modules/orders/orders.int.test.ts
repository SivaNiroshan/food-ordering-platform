import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import { orderJobs } from '../../jobs/queues.js';
import { prisma } from '../../lib/prisma.js';
import { realtimeEvents } from '../../realtime/events.js';
import { createCategory, createMenuItem, createUserAndLogin } from '../../../test/helpers.js';
import { ordersService } from './orders.service.js';

const app = createApp();

type Session = Awaited<ReturnType<typeof createUserAndLogin>>;

let customer: Session;
let staff: Session;
let kottu: { id: string };
let milo: { id: string };

beforeEach(async () => {
  customer = await createUserAndLogin(app, 'CUSTOMER');
  staff = await createUserAndLogin(app, 'STAFF');
  const category = await createCategory();
  kottu = await createMenuItem(category.id, { name: 'Chicken Kottu', price: '1200.00' });
  milo = await createMenuItem(category.id, { name: 'Iced Milo', price: '450.00' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function placeOrder(session: Session, body: unknown, idempotencyKey: string | null = randomUUID()) {
  const req = request(app).post('/api/v1/orders').set(session.auth);
  if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey);
  return req.send(body as object);
}

function standardOrder() {
  return {
    items: [
      { menuItemId: kottu.id, quantity: 2 },
      { menuItemId: milo.id, quantity: 1 },
    ],
  };
}

async function placeStandardOrder() {
  const res = await placeOrder(customer, standardOrder()).expect(201);
  return res.body as { id: string; status: string };
}

function staffAction(orderId: string, action: string, body?: object) {
  return request(app)
    .post(`/api/v1/staff/orders/${orderId}/${action}`)
    .set(staff.auth)
    .send(body ?? {});
}

describe('POST /orders', () => {
  it('creates a PENDING order using database prices, ignoring client prices', async () => {
    const createdSpy = vi.spyOn(realtimeEvents, 'orderCreated');
    const jobSpy = vi.spyOn(orderJobs, 'scheduleExpiry');

    const res = await placeOrder(customer, {
      items: [{ menuItemId: kottu.id, quantity: 2, unitPrice: '1.00' }],
      notes: 'Less spicy please',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      subtotal: '2400.00',
      notes: 'Less spicy please',
    });
    expect(res.body.items[0]).toMatchObject({ unitPrice: '1200.00', lineTotal: '2400.00' });
    expect(res.body.history).toHaveLength(1);
    expect(createdSpy).toHaveBeenCalledOnce();
    expect(jobSpy).toHaveBeenCalledWith(res.body.id, expect.any(Date));
  });

  it('keeps the original price after the menu price changes', async () => {
    const order = await placeStandardOrder();
    await prisma.menuItem.update({ where: { id: kottu.id }, data: { price: '9999.00' } });

    const res = await request(app).get(`/api/v1/orders/${order.id}`).set(customer.auth);
    const kottuLine = res.body.items.find((i: { menuItemId: string }) => i.menuItemId === kottu.id);
    expect(kottuLine.unitPrice).toBe('1200.00');
  });

  it('rejects orders below the minimum amount', async () => {
    const res = await placeOrder(customer, { items: [{ menuItemId: milo.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MINIMUM_ORDER_NOT_MET');
  });

  it('rejects unavailable items and lists them', async () => {
    await prisma.menuItem.update({ where: { id: milo.id }, data: { isAvailable: false } });

    const res = await placeOrder(customer, standardOrder());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MENU_ITEM_UNAVAILABLE');
    expect(res.body.error.details).toEqual([{ menuItemId: milo.id }]);
  });

  it('rejects duplicate menu items and empty orders', async () => {
    const duplicate = await placeOrder(customer, {
      items: [
        { menuItemId: kottu.id, quantity: 1 },
        { menuItemId: kottu.id, quantity: 1 },
      ],
    });
    expect(duplicate.status).toBe(400);

    const empty = await placeOrder(customer, { items: [] });
    expect(empty.status).toBe(400);
  });

  it('requires an Idempotency-Key header', async () => {
    const res = await placeOrder(customer, standardOrder(), null);
    expect(res.status).toBe(400);
  });

  it('returns the original order when the same request is retried', async () => {
    const key = randomUUID();
    const first = await placeOrder(customer, standardOrder(), key).expect(201);
    const retry = await placeOrder(customer, standardOrder(), key);

    expect(retry.status).toBe(200);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.id).toBe(first.body.id);
    expect(await prisma.order.count()).toBe(1);
  });

  it('rejects reusing a key for a different order', async () => {
    const key = randomUUID();
    await placeOrder(customer, standardOrder(), key).expect(201);
    const res = await placeOrder(customer, { items: [{ menuItemId: kottu.id, quantity: 3 }] }, key);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('creates only one order when identical requests arrive at the same time', async () => {
    const key = randomUUID();
    const results = await Promise.all([
      placeOrder(customer, standardOrder(), key),
      placeOrder(customer, standardOrder(), key),
      placeOrder(customer, standardOrder(), key),
    ]);

    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it('does not allow staff to place orders', async () => {
    const res = await placeOrder(staff, standardOrder());
    expect(res.status).toBe(403);
  });
});

describe('customer order access', () => {
  it('lists only the customer’s own orders', async () => {
    await placeStandardOrder();
    const other = await createUserAndLogin(app, 'CUSTOMER');

    const mine = await request(app).get('/api/v1/orders').set(customer.auth);
    const theirs = await request(app).get('/api/v1/orders').set(other.auth);

    expect(mine.body.meta.totalItems).toBe(1);
    expect(theirs.body.meta.totalItems).toBe(0);
  });

  it('returns 404 for another customer’s order', async () => {
    const order = await placeStandardOrder();
    const other = await createUserAndLogin(app, 'CUSTOMER');

    const res = await request(app).get(`/api/v1/orders/${order.id}`).set(other.auth);
    expect(res.status).toBe(404);
  });

  it('lets a customer cancel a PENDING order', async () => {
    const order = await placeStandardOrder();
    const res = await request(app)
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set(customer.auth)
      .send({ note: 'Ordered by mistake' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.statusReason).toEqual({ code: 'CUSTOMER_REQUEST', note: 'Ordered by mistake' });
  });

  it('does not let a customer cancel an accepted order', async () => {
    const order = await placeStandardOrder();
    await staffAction(order.id, 'accept').expect(200);

    const res = await request(app).post(`/api/v1/orders/${order.id}/cancel`).set(customer.auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('does not let a customer cancel someone else’s order', async () => {
    const order = await placeStandardOrder();
    const other = await createUserAndLogin(app, 'CUSTOMER');

    const res = await request(app).post(`/api/v1/orders/${order.id}/cancel`).set(other.auth);
    expect(res.status).toBe(404);
  });
});

describe('staff order processing', () => {
  it('moves an order through the full lifecycle and marks it paid', async () => {
    const statusSpy = vi.spyOn(realtimeEvents, 'orderStatusChanged');
    const order = await placeStandardOrder();

    for (const action of ['accept', 'start-preparing', 'mark-ready']) {
      await staffAction(order.id, action).expect(200);
    }
    const done = await staffAction(order.id, 'complete');

    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ status: 'COMPLETED', paymentStatus: 'PAID' });
    expect(done.body.history.map((h: { newStatus: string }) => h.newStatus)).toEqual([
      'PENDING',
      'ACCEPTED',
      'PREPARING',
      'READY',
      'COMPLETED',
    ]);
    expect(done.body.history[1].changedBy.id).toBe(staff.user.id);
    expect(statusSpy).toHaveBeenCalledTimes(4);
    expect(statusSpy).toHaveBeenLastCalledWith(
      customer.user.id,
      expect.objectContaining({ previousStatus: 'READY', status: 'COMPLETED' }),
    );
  });

  it('rejects transitions that skip steps', async () => {
    const order = await placeStandardOrder();
    const res = await staffAction(order.id, 'mark-ready');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('requires a note when rejecting with reason OTHER, and shows the reason to the customer', async () => {
    const order = await placeStandardOrder();

    const missingNote = await staffAction(order.id, 'reject', { reasonCode: 'OTHER' });
    expect(missingNote.status).toBe(400);

    await staffAction(order.id, 'reject', {
      reasonCode: 'KITCHEN_BUSY',
      note: 'Please try again in 30 minutes',
    }).expect(200);

    const res = await request(app).get(`/api/v1/orders/${order.id}`).set(customer.auth);
    expect(res.body.status).toBe('REJECTED');
    expect(res.body.statusReason).toEqual({
      code: 'KITCHEN_BUSY',
      note: 'Please try again in 30 minutes',
    });
  });

  it('lets admins view orders but not process them', async () => {
    const order = await placeStandardOrder();
    const admin = await createUserAndLogin(app, 'ADMIN');

    const list = await request(app).get('/api/v1/staff/orders').set(admin.auth);
    expect(list.status).toBe(200);
    expect(list.body.data[0].customer.id).toBe(customer.user.id);

    const accept = await request(app)
      .post(`/api/v1/staff/orders/${order.id}/accept`)
      .set(admin.auth);
    expect(accept.status).toBe(403);
  });

  it('filters the staff queue by status', async () => {
    const first = await placeStandardOrder();
    await placeStandardOrder();
    await staffAction(first.id, 'accept').expect(200);

    const res = await request(app)
      .get('/api/v1/staff/orders?status=PENDING&status=ACCEPTED')
      .set(staff.auth);
    expect(res.body.meta.totalItems).toBe(2);

    const pending = await request(app).get('/api/v1/staff/orders?status=PENDING').set(staff.auth);
    expect(pending.body.meta.totalItems).toBe(1);
  });
});

describe('automatic expiry (worker logic)', () => {
  async function makeOverdue(orderId: string) {
    await prisma.order.update({
      where: { id: orderId },
      data: { acceptanceDeadline: new Date(Date.now() - 1000) },
    });
  }

  it('cancels an overdue PENDING order as SYSTEM with reason ACCEPTANCE_TIMEOUT', async () => {
    const order = await placeStandardOrder();
    await makeOverdue(order.id);

    expect(await ordersService.expireIfOverdue(order.id)).toBe('expired');

    const res = await request(app).get(`/api/v1/orders/${order.id}`).set(customer.auth);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.statusReason.code).toBe('ACCEPTANCE_TIMEOUT');
    expect(res.body.history.at(-1).changeSource).toBe('SYSTEM');
  });

  it('does nothing before the deadline or after staff accepted', async () => {
    const early = await placeStandardOrder();
    expect(await ordersService.expireIfOverdue(early.id)).toBe('not-due');

    const accepted = await placeStandardOrder();
    await staffAction(accepted.id, 'accept').expect(200);
    await makeOverdue(accepted.id);
    expect(await ordersService.expireIfOverdue(accepted.id)).toBe('skipped');
  });

  it('lets exactly one side win when staff accept while the order expires', async () => {
    const order = await placeStandardOrder();
    await makeOverdue(order.id);

    const [acceptRes, expiry] = await Promise.all([
      staffAction(order.id, 'accept'),
      ordersService.expireIfOverdue(order.id),
    ]);

    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    if (acceptRes.status === 200) {
      expect(expiry).toBe('skipped');
      expect(final.status).toBe('ACCEPTED');
    } else {
      expect(acceptRes.status).toBe(409);
      expect(expiry).toBe('expired');
      expect(final.status).toBe('CANCELLED');
    }
    // Exactly one transition was recorded after PENDING
    expect(await prisma.orderStatusHistory.count({ where: { orderId: order.id } })).toBe(2);
  });

  it('sweeps overdue orders whose job was lost', async () => {
    const a = await placeStandardOrder();
    const b = await placeStandardOrder();
    await makeOverdue(a.id);
    await makeOverdue(b.id);

    expect(await ordersService.sweepOverdue()).toBe(2);
  });
});
