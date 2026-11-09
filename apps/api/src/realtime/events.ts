import { Emitter } from '@socket.io/redis-emitter';
import { env } from '../config/env.js';
import type { OrderChangeSource, OrderReasonCode, OrderStatus } from '../generated/prisma/enums.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

export const ROOMS = {
  staff: 'staff',
  user: (userId: string) => `user:${userId}`,
} as const;

export interface OrderCreatedEvent {
  orderId: string;
  customerName: string;
  subtotal: string;
  itemCount: number;
  createdAt: string;
}

export interface OrderStatusChangedEvent {
  orderId: string;
  previousStatus: OrderStatus;
  status: OrderStatus;
  changeSource: OrderChangeSource;
  reason: { code: OrderReasonCode; note: string | null } | null;
  changedAt: string;
}

/*
 * Events are published through Redis, not sent directly from a Socket.IO server.
 * That way the API *and* the background worker (which has no WebSocket connections)
 * can both emit, and the API's Socket.IO server delivers them to the right rooms.
 */
let emitter: Emitter | undefined;
function getEmitter() {
  emitter ??= new Emitter(redis);
  return emitter;
}

function emit(rooms: string[], event: string, payload: unknown) {
  if (env.NODE_ENV === 'test') return; // tests spy on realtimeEvents instead
  try {
    getEmitter().to(rooms).emit(event, payload);
  } catch (err) {
    // A missed notification is acceptable: clients refetch over REST on reconnect.
    logger.warn({ err, event }, 'Failed to publish realtime event');
  }
}

// Methods live on an object so tests can spy on them.
export const realtimeEvents = {
  orderCreated(payload: OrderCreatedEvent) {
    emit([ROOMS.staff], 'order:created', payload);
  },

  orderStatusChanged(customerId: string, payload: OrderStatusChangedEvent) {
    emit([ROOMS.user(customerId), ROOMS.staff], 'order:status_changed', payload);
  },
};
