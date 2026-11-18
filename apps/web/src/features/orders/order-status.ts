import type { OrderReasonCode, OrderStatus } from './order-types';

/** Short labels for badges, shared by customer and kitchen screens. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Waiting for kitchen',
  ACCEPTED: 'Accepted',
  PREPARING: 'Being prepared',
  READY: 'Ready to collect',
  COMPLETED: 'Collected',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

/** The big headline on the customer's order page. */
export const CUSTOMER_HEADLINE: Record<OrderStatus, string> = {
  PENDING: 'Waiting for the kitchen to accept',
  ACCEPTED: 'The kitchen has accepted your order',
  PREPARING: 'Your food is being prepared',
  READY: 'Ready to collect',
  COMPLETED: 'Collected. Enjoy your meal!',
  REJECTED: 'The kitchen couldn’t take this order',
  CANCELLED: 'This order was cancelled',
};

export const REASON_LABEL: Record<OrderReasonCode, string> = {
  CUSTOMER_REQUEST: 'You cancelled this order.',
  ITEM_UNAVAILABLE: 'An item in the order was unavailable.',
  KITCHEN_BUSY: 'The kitchen is too busy right now.',
  RESTAURANT_CLOSING: 'The restaurant is closing.',
  ACCEPTANCE_TIMEOUT: 'The kitchen didn’t accept it in time, so it was cancelled automatically.',
  OTHER: 'Other reason.',
};

/** The normal journey of an order, in order. */
export const ORDER_JOURNEY: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'COMPLETED',
];

export function isFinal(status: OrderStatus) {
  return status === 'COMPLETED' || status === 'REJECTED' || status === 'CANCELLED';
}

/** A short, readable order number: the last 6 characters of the UUID. */
export function orderNumber(id: string) {
  return `#${id.slice(-6).toUpperCase()}`;
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const timeFormat = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' });

/** "17 Nov 2026, 14:05" */
export function formatDateTime(iso: string) {
  return dateTimeFormat.format(new Date(iso));
}

/** "14:05" */
export function formatTime(iso: string) {
  return timeFormat.format(new Date(iso));
}
