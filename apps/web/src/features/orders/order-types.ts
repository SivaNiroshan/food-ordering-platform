// Order shapes returned by the API (see apps/api/src/modules/orders/orders.mapper.ts).

export type OrderStatus =
  'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export type OrderReasonCode =
  | 'CUSTOMER_REQUEST'
  | 'ITEM_UNAVAILABLE'
  | 'KITCHEN_BUSY'
  | 'RESTAURANT_CLOSING'
  | 'ACCEPTANCE_TIMEOUT'
  | 'OTHER';

export interface OrderItem {
  menuItemId: string;
  itemName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderHistoryEntry {
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changeSource: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
  reasonCode: OrderReasonCode | null;
  reasonNote: string | null;
  changedAt: string;
  /** Staff views only */
  changedBy?: { id: string; name: string } | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  paymentMethod: 'PAY_ON_COLLECTION';
  paymentStatus: 'UNPAID' | 'PAID';
  subtotal: string;
  notes: string | null;
  acceptanceDeadline: string;
  statusReason: { code: OrderReasonCode; note: string | null } | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  /** Detail endpoints only */
  history?: OrderHistoryEntry[];
  /** Staff views only */
  customer?: { id: string; name: string; email: string };
}
