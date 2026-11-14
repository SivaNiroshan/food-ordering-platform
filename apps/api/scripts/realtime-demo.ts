/**
 * Manual end-to-end check of orders + background worker + real-time events.
 *
 * Needs: docker compose up, seeded database, API (npm run dev) and worker (npm run dev:worker),
 * both started with ORDER_ACCEPTANCE_TIMEOUT_MINUTES=1 so the auto-cancel happens quickly.
 *
 * Run: npx tsx scripts/realtime-demo.ts
 */
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';

const BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:4000';
const API = `${BASE_URL}/api/v1`;
const WAIT_SECONDS = Number(process.env.DEMO_WAIT_SECONDS ?? 75);

async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  });
  const body = (await res.json()) as T;
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function login(email: string) {
  const { accessToken } = await api<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'Password123' }),
  });
  return accessToken;
}

interface EventPayload {
  orderId?: string;
  status?: string;
  reason?: unknown;
}

function connect(label: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, { auth: { token } });
    socket.onAny((event: string, payload: EventPayload) =>
      console.log(`📨 [${label}] ${event}`, {
        orderId: payload.orderId?.slice(-8),
        status: payload.status,
        reason: payload.reason ?? undefined,
      }),
    );
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

const customerToken = await login('customer@foodflow.local');
const staffToken = await login('staff@foodflow.local');

const customerSocket = await connect('customer', customerToken);
const staffSocket = await connect('staff', staffToken);
console.log('✅ Both sockets connected');

// A socket with a fake token must be rejected
await new Promise<void>((resolve) => {
  const intruder = io(BASE_URL, { auth: { token: 'fake' }, reconnection: false });
  intruder.once('connect_error', (err) => {
    console.log(`✅ Fake token rejected (${err.message})`);
    resolve();
  });
});

const menu = await api<{ data: { id: string; name: string }[] }>('/menu-items?search=kottu');
const kottu = menu.data[0];
if (!kottu) throw new Error('No kottu on the menu: run npm run db:seed');

function placeOrder(menuItemId: string) {
  return api<{ id: string; status: string }>(
    '/orders',
    {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ items: [{ menuItemId, quantity: 1 }] }),
    },
    customerToken,
  );
}

const toExpire = await placeOrder(kottu.id);
const toAccept = await placeOrder(kottu.id);
console.log(
  `🛒 Placed ${toExpire.id.slice(-8)} (will expire) and ${toAccept.id.slice(-8)} (will be accepted)`,
);

await api(`/staff/orders/${toAccept.id}/accept`, { method: 'POST' }, staffToken);

console.log(`⏳ Waiting ${WAIT_SECONDS}s for the worker to auto-cancel the other order...`);
await new Promise((resolve) => setTimeout(resolve, WAIT_SECONDS * 1000));

const final = await api<{ status: string; statusReason: unknown }>(
  `/orders/${toExpire.id}`,
  {},
  customerToken,
);
console.log('🏁 Unaccepted order is now:', final.status, final.statusReason);

customerSocket.close();
staffSocket.close();
process.exit(final.status === 'CANCELLED' ? 0 : 1);