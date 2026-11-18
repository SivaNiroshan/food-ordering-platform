import type { QueryClient } from '@tanstack/react-query';
import { toast } from '../../components/ui/toast-store';
import type { UserRole } from '../../lib/types';
import { orderKeys } from '../orders/orders-api';
import { orderNumber, STATUS_LABEL } from '../orders/order-status';
import type { OrderReasonCode, OrderStatus } from '../orders/order-types';

// Payloads sent by the API (apps/api/src/realtime/events.ts)

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
  changeSource: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
  reason: { code: OrderReasonCode; note: string | null } | null;
  changedAt: string;
}

/*
 * Events are notifications, not data. Instead of patching the cache by hand, we mark
 * the affected queries as stale and React Query refetches them over REST. The API stays
 * the single source of truth, and a missed or out-of-order event can't leave the screen wrong.
 */

export function handleOrderStatusChanged(
  queryClient: QueryClient,
  event: OrderStatusChangedEvent,
  role: UserRole,
) {
  void queryClient.invalidateQueries({ queryKey: orderKeys.detail(event.orderId) });
  void queryClient.invalidateQueries({ queryKey: orderKeys.mine });
  void queryClient.invalidateQueries({ queryKey: orderKeys.staff });

  // Customers don't need a notification for a change they made themselves.
  if (role === 'CUSTOMER' && event.changeSource !== 'CUSTOMER') {
    toast(
      `Order ${orderNumber(event.orderId)}: ${STATUS_LABEL[event.status]}`,
      event.status === 'READY' ? 'success' : 'info',
    );
  }
}

export function handleOrderCreated(
  queryClient: QueryClient,
  event: OrderCreatedEvent,
  role: UserRole,
) {
  void queryClient.invalidateQueries({ queryKey: orderKeys.staff });
  if (role === 'STAFF' || role === 'ADMIN') {
    toast(`New order ${orderNumber(event.orderId)} from ${event.customerName}`, 'attention');
  }
}

/** After any (re)connect, refetch everything order-related: events may have been missed. */
export function handleConnected(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: orderKeys.allDetails });
  void queryClient.invalidateQueries({ queryKey: orderKeys.mine });
  void queryClient.invalidateQueries({ queryKey: orderKeys.staff });
}
