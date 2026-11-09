import type { OrderStatus } from '../../generated/prisma/enums.js';

/**
 * The single source of truth for allowed status transitions.
 * Mirrors the table in docs/database-design.md.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Staff actions exposed as POST /staff/orders/:id/<action> */
export const STAFF_ACTIONS = {
  accept: { from: 'PENDING', to: 'ACCEPTED' },
  'start-preparing': { from: 'ACCEPTED', to: 'PREPARING' },
  'mark-ready': { from: 'PREPARING', to: 'READY' },
  complete: { from: 'READY', to: 'COMPLETED' },
} as const satisfies Record<string, { from: OrderStatus; to: OrderStatus }>;

export type StaffAction = keyof typeof STAFF_ACTIONS;
