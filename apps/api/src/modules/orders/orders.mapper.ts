import type { OrderWithRelations } from './orders.repository.js';

function statusReason(order: OrderWithRelations) {
  if (order.status !== 'REJECTED' && order.status !== 'CANCELLED') return null;
  const entry = order.statusHistory.findLast((h) => h.newStatus === order.status);
  return entry?.reasonCode ? { code: entry.reasonCode, note: entry.reasonNote } : null;
}

type View = 'customer' | 'staff';

export function toOrder(order: OrderWithRelations, view: View, { withHistory = false } = {}) {
  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal.toFixed(2),
    notes: order.notes,
    acceptanceDeadline: order.acceptanceDeadline.toISOString(),
    statusReason: statusReason(order),
    items: order.items.map((item) => ({
      menuItemId: item.menuItemId,
      itemName: item.itemName,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toFixed(2),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    ...(view === 'staff' && { customer: order.customer }),
    ...(withHistory && {
      history: order.statusHistory.map((h) => ({
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        changeSource: h.changeSource,
        reasonCode: h.reasonCode,
        reasonNote: h.reasonNote,
        changedAt: h.changedAt.toISOString(),
        ...(view === 'staff' && { changedBy: h.changedBy }),
      })),
    }),
  };
}
