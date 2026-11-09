import type { Prisma } from '../../generated/prisma/client.js';
import type { OrderStatus } from '../../generated/prisma/enums.js';
import { prisma } from '../../lib/prisma.js';

type Db = Prisma.TransactionClient;

// Everything the mapper needs, loaded in one query.
export const orderInclude = {
  items: { orderBy: { itemName: 'asc' } },
  customer: { select: { id: true, name: true, email: true } },
  statusHistory: {
    orderBy: { changedAt: 'asc' },
    include: { changedBy: { select: { id: true, name: true } } },
  },
} as const satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export const ordersRepository = {
  findMenuItemsForOrder(ids: string[]) {
    return prisma.menuItem.findMany({ where: { id: { in: ids } }, include: { category: true } });
  },

  findByIdempotencyKey(customerId: string, idempotencyKey: string) {
    return prisma.order.findUnique({
      where: { customerId_idempotencyKey: { customerId, idempotencyKey } },
      include: orderInclude,
    });
  },

  findById(id: string, scope: { customerId?: string } = {}) {
    return prisma.order.findFirst({ where: { id, ...scope }, include: orderInclude });
  },

  findByIdOrThrow(id: string, db: Db = prisma) {
    return db.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
  },

  findStatus(id: string, scope: { customerId?: string } = {}) {
    return prisma.order.findFirst({ where: { id, ...scope }, select: { status: true } });
  },

  async list(params: {
    where: Prisma.OrderWhereInput;
    orderBy: Prisma.OrderOrderByWithRelationInput;
    skip: number;
    take: number;
  }) {
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({ ...params, include: orderInclude }),
      prisma.order.count({ where: params.where }),
    ]);
    return { orders, total };
  },

  create(data: Prisma.OrderCreateInput, db: Db = prisma) {
    return db.order.create({ data, include: orderInclude });
  },

  /**
   * Conditional update: changes the order ONLY if it is still in `from`.
   * Returns false when another actor changed it first (lost race) or it doesn't match the scope.
   */
  async updateStatusIf(
    id: string,
    from: OrderStatus,
    data: Prisma.OrderUpdateManyMutationInput,
    scope: { customerId?: string },
    db: Db,
  ) {
    const result = await db.order.updateMany({ where: { id, status: from, ...scope }, data });
    return result.count === 1;
  },

  addHistory(data: Prisma.OrderStatusHistoryUncheckedCreateInput, db: Db) {
    return db.orderStatusHistory.create({ data });
  },

  findOverduePendingIds(now: Date, limit = 100) {
    return prisma.order.findMany({
      where: { status: 'PENDING', acceptanceDeadline: { lte: now } },
      select: { id: true },
      orderBy: { acceptanceDeadline: 'asc' },
      take: limit,
    });
  },
};
