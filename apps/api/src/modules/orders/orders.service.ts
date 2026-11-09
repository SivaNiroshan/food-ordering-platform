import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  OrderChangeSource,
  OrderReasonCode,
  OrderStatus,
} from '../../generated/prisma/enums.js';
import { AppError, badRequest, conflict, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { toPage, toSkipTake } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { isUniqueViolation } from '../../lib/prisma-errors.js';
import { orderJobs } from '../../jobs/queues.js';
import { realtimeEvents } from '../../realtime/events.js';
import { toOrder } from './orders.mapper.js';
import { ordersRepository, type OrderWithRelations } from './orders.repository.js';
import type {
  CreateOrderInput,
  CustomerOrdersQuery,
  RejectOrderInput,
  StaffOrdersQuery,
} from './orders.schemas.js';
import { STAFF_ACTIONS, type StaffAction } from './orders.state-machine.js';

const MINIMUM_ORDER = new Prisma.Decimal(env.MINIMUM_ORDER_AMOUNT);

const orderNotFound = () => notFound('ORDER_NOT_FOUND', 'Order not found');

// ---------- Idempotency ----------

/** True when a retried request asks for exactly the same order as the stored one. */
function isSameOrder(existing: OrderWithRelations, input: CreateOrderInput) {
  const key = (items: { menuItemId: string; quantity: number }[]) =>
    items
      .map((i) => `${i.menuItemId}:${i.quantity}`)
      .sort()
      .join(',');
  return key(existing.items) === key(input.items) && (existing.notes ?? undefined) === input.notes;
}

function replayOrConflict(existing: OrderWithRelations, input: CreateOrderInput) {
  if (!isSameOrder(existing, input)) {
    throw conflict(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used for a different order',
    );
  }
  return { order: toOrder(existing, 'customer', { withHistory: true }), replayed: true };
}

// ---------- Status transitions ----------

interface TransitionParams {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  source: OrderChangeSource;
  actorId: string | null;
  reasonCode?: OrderReasonCode;
  reasonNote?: string;
  customerId?: string; // limits the change to this customer's orders
  extraData?: Prisma.OrderUpdateManyMutationInput;
}

/**
 * The ONE place where an order's status changes.
 * 1. Conditional update (WHERE status = from) protects against races,
 *    e.g. staff accepting at the same moment the auto-cancel job runs.
 * 2. The status change and its history row are written in the same transaction.
 * 3. The realtime event is published only after the transaction commits.
 */
async function transition(params: TransitionParams) {
  const scope = params.customerId ? { customerId: params.customerId } : {};

  const order = await prisma.$transaction(async (tx) => {
    const changed = await ordersRepository.updateStatusIf(
      params.orderId,
      params.from,
      { status: params.to, ...params.extraData },
      scope,
      tx,
    );
    if (!changed) return null;

    await ordersRepository.addHistory(
      {
        orderId: params.orderId,
        previousStatus: params.from,
        newStatus: params.to,
        changeSource: params.source,
        changedById: params.actorId,
        reasonCode: params.reasonCode,
        reasonNote: params.reasonNote,
      },
      tx,
    );
    return ordersRepository.findByIdOrThrow(params.orderId, tx);
  });

  if (!order) {
    // Work out WHY nothing changed, to return the right error.
    const current = await ordersRepository.findStatus(params.orderId, scope);
    if (!current) throw orderNotFound();
    throw conflict(
      'INVALID_STATUS_TRANSITION',
      `Order is ${current.status} and cannot be moved to ${params.to}`,
    );
  }

  const latest = order.statusHistory.at(-1);
  realtimeEvents.orderStatusChanged(order.customerId, {
    orderId: order.id,
    previousStatus: params.from,
    status: params.to,
    changeSource: params.source,
    reason: params.reasonCode ? { code: params.reasonCode, note: params.reasonNote ?? null } : null,
    changedAt: (latest?.changedAt ?? new Date()).toISOString(),
  });

  return order;
}

// ---------- Service ----------

export const ordersService = {
  async placeOrder(customerId: string, idempotencyKey: string, input: CreateOrderInput) {
    // 1. Same key seen before? Return the original order instead of creating a duplicate.
    const existing = await ordersRepository.findByIdempotencyKey(customerId, idempotencyKey);
    if (existing) return replayOrConflict(existing, input);

    // 2. Load menu items and reject anything that can't be ordered.
    const ids = input.items.map((i) => i.menuItemId);
    const menuItems = await ordersRepository.findMenuItemsForOrder(ids);
    const byId = new Map(menuItems.map((m) => [m.id, m]));

    const unavailable = ids.filter((id) => {
      const item = byId.get(id);
      return !item || !item.isActive || !item.isAvailable || !item.category.isActive;
    });
    if (unavailable.length > 0) {
      throw conflict(
        'MENU_ITEM_UNAVAILABLE',
        'Some items are no longer available',
        unavailable.map((menuItemId) => ({ menuItemId })),
      );
    }

    // 3. Prices come from the DATABASE, never from the client.
    const lines = input.items.map(({ menuItemId, quantity }) => {
      const item = byId.get(menuItemId)!;
      return {
        menuItemId,
        itemName: item.name,
        unitPrice: item.price,
        quantity,
        lineTotal: item.price.mul(quantity),
      };
    });
    const subtotal = lines.reduce((sum, l) => sum.add(l.lineTotal), new Prisma.Decimal(0));

    if (subtotal.lessThan(MINIMUM_ORDER)) {
      throw badRequest(
        'MINIMUM_ORDER_NOT_MET',
        `The minimum order amount is LKR ${MINIMUM_ORDER.toFixed(2)}`,
      );
    }

    // 4. Order, items and first history row: all or nothing.
    const acceptanceDeadline = new Date(Date.now() + env.ORDER_ACCEPTANCE_TIMEOUT_MINUTES * 60_000);

    let order: OrderWithRelations;
    try {
      order = await ordersRepository.create({
        customer: { connect: { id: customerId } },
        idempotencyKey,
        subtotal,
        notes: input.notes,
        acceptanceDeadline,
        items: {
          create: lines.map((l) => ({
            menuItem: { connect: { id: l.menuItemId } },
            itemName: l.itemName,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.lineTotal,
          })),
        },
        statusHistory: {
          create: {
            previousStatus: null,
            newStatus: 'PENDING',
            changeSource: 'CUSTOMER',
            changedBy: { connect: { id: customerId } },
          },
        },
      });
    } catch (err) {
      // Two identical requests raced past step 1: the unique constraint stopped the second.
      if (isUniqueViolation(err)) {
        const winner = await ordersRepository.findByIdempotencyKey(customerId, idempotencyKey);
        if (winner) return replayOrConflict(winner, input);
      }
      throw err;
    }

    // 5. After commit: side effects. A failure here must not fail the order,
    //    which is already saved. The recovery sweep catches any missed expiry job.
    try {
      await orderJobs.scheduleExpiry(order.id, acceptanceDeadline);
    } catch (err) {
      logger.error({ err, orderId: order.id }, 'Failed to schedule order expiry job');
    }
    realtimeEvents.orderCreated({
      orderId: order.id,
      customerName: order.customer.name,
      subtotal: order.subtotal.toFixed(2),
      itemCount: order.items.reduce((n, i) => n + i.quantity, 0),
      createdAt: order.createdAt.toISOString(),
    });

    return { order: toOrder(order, 'customer', { withHistory: true }), replayed: false };
  },

  // ---------- Customer ----------

  async listForCustomer(customerId: string, query: CustomerOrdersQuery) {
    const { orders, total } = await ordersRepository.list({
      where: { customerId, ...(query.status && { status: { in: query.status } }) },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query),
    });
    return toPage(
      orders.map((o) => toOrder(o, 'customer')),
      total,
      query,
    );
  },

  async getForCustomer(customerId: string, orderId: string) {
    const order = await ordersRepository.findById(orderId, { customerId });
    if (!order) throw orderNotFound(); // 404 also for other customers' orders
    return toOrder(order, 'customer', { withHistory: true });
  },

  async cancelByCustomer(customerId: string, orderId: string, note?: string) {
    const order = await transition({
      orderId,
      from: 'PENDING',
      to: 'CANCELLED',
      source: 'CUSTOMER',
      actorId: customerId,
      reasonCode: 'CUSTOMER_REQUEST',
      reasonNote: note,
      customerId,
    });
    return toOrder(order, 'customer', { withHistory: true });
  },

  // ---------- Staff ----------

  async listForStaff(query: StaffOrdersQuery) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: { in: query.status } }),
      ...(query.customerId && { customerId: query.customerId }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lt: new Date(query.to) }),
        },
      }),
    };
    const { orders, total } = await ordersRepository.list({
      where,
      orderBy: { createdAt: query.sort === 'oldest' ? 'asc' : 'desc' },
      ...toSkipTake(query),
    });
    return toPage(
      orders.map((o) => toOrder(o, 'staff')),
      total,
      query,
    );
  },

  async getForStaff(orderId: string) {
    const order = await ordersRepository.findById(orderId);
    if (!order) throw orderNotFound();
    return toOrder(order, 'staff', { withHistory: true });
  },

  async staffAction(staffId: string, orderId: string, action: StaffAction) {
    const { from, to } = STAFF_ACTIONS[action];
    const order = await transition({
      orderId,
      from,
      to,
      source: 'STAFF',
      actorId: staffId,
      // Pay on collection: the order is paid when it is handed over.
      ...(action === 'complete' && { extraData: { paymentStatus: 'PAID' } }),
    });
    return toOrder(order, 'staff', { withHistory: true });
  },

  async reject(staffId: string, orderId: string, input: RejectOrderInput) {
    const order = await transition({
      orderId,
      from: 'PENDING',
      to: 'REJECTED',
      source: 'STAFF',
      actorId: staffId,
      reasonCode: input.reasonCode,
      reasonNote: input.note,
    });
    return toOrder(order, 'staff', { withHistory: true });
  },

  // ---------- System (background worker) ----------

  /** Cancels the order if it is still PENDING after its deadline. Safe to call repeatedly. */
  async expireIfOverdue(orderId: string) {
    const current = await ordersRepository.findById(orderId);
    if (!current || current.status !== 'PENDING') return 'skipped' as const;
    if (current.acceptanceDeadline > new Date()) return 'not-due' as const;

    try {
      await transition({
        orderId,
        from: 'PENDING',
        to: 'CANCELLED',
        source: 'SYSTEM',
        actorId: null,
        reasonCode: 'ACCEPTANCE_TIMEOUT',
      });
      return 'expired' as const;
    } catch (err) {
      // Staff accepted (or the customer cancelled) a moment earlier: nothing to do.
      if (err instanceof AppError && err.code === 'INVALID_STATUS_TRANSITION') {
        return 'skipped' as const;
      }
      throw err;
    }
  },

  /** Recovery: expires overdue orders whose individual job was lost. */
  async sweepOverdue() {
    const overdue = await ordersRepository.findOverduePendingIds(new Date());
    let expired = 0;
    for (const { id } of overdue) {
      if ((await this.expireIfOverdue(id)) === 'expired') expired += 1;
    }
    return expired;
  },
};
