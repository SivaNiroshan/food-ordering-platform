import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { Page } from '../../lib/types';
import { orderKeys } from '../orders/orders-api';
import type { OrderReasonCode, OrderStatus } from '../orders/order-types';
import type { Order } from '../orders/order-types';
import { dayRange } from './kitchen-time';

export const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'];
export const FINISHED_STATUSES: OrderStatus[] = ['COMPLETED', 'REJECTED', 'CANCELLED'];

function staffOrdersUrl(params: {
  statuses: OrderStatus[];
  sort: 'oldest' | 'newest';
  page?: number;
  pageSize: number;
  date?: string;
}) {
  const search = new URLSearchParams();
  for (const status of params.statuses) search.append('status', status);
  search.set('sort', params.sort);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize));
  if (params.date) {
    const { from, to } = dayRange(params.date);
    search.set('from', from);
    search.set('to', to);
  }
  return `/staff/orders?${search}`;
}

/** Every order the kitchen still has to deal with, oldest first (first in, first out). */
export function useKitchenBoard() {
  return useQuery({
    queryKey: [...orderKeys.staff, 'board'],
    queryFn: ({ signal }) =>
      apiRequest<Page<Order>>(
        staffOrdersUrl({ statuses: ACTIVE_STATUSES, sort: 'oldest', pageSize: 50 }),
        { signal },
      ),
  });
}

/** Finished orders, newest first, optionally for one day. */
export function useOrderHistory({ page, date }: { page: number; date?: string }) {
  return useQuery({
    queryKey: [...orderKeys.staff, 'history', { page, date }],
    queryFn: ({ signal }) =>
      apiRequest<Page<Order>>(
        staffOrdersUrl({ statuses: FINISHED_STATUSES, sort: 'newest', page, pageSize: 20, date }),
        { signal },
      ),
    placeholderData: keepPreviousData,
  });
}

export type StaffAction = 'accept' | 'start-preparing' | 'mark-ready' | 'complete';

export type StaffActionInput =
  | { orderId: string; action: StaffAction }
  | {
      orderId: string;
      action: 'reject';
      reasonCode: Exclude<OrderReasonCode, 'CUSTOMER_REQUEST' | 'ACCEPTANCE_TIMEOUT'>;
      note?: string;
    };

/** The next step for each active status. */
export const NEXT_ACTION: Partial<Record<OrderStatus, { action: StaffAction; label: string }>> = {
  PENDING: { action: 'accept', label: 'Accept' },
  ACCEPTED: { action: 'start-preparing', label: 'Start preparing' },
  PREPARING: { action: 'mark-ready', label: 'Mark ready' },
  READY: { action: 'complete', label: 'Mark collected' },
};

export function useStaffOrderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffActionInput) =>
      apiRequest<Order>(`/staff/orders/${input.orderId}/${input.action}`, {
        method: 'POST',
        body: input.action === 'reject' ? { reasonCode: input.reasonCode, note: input.note } : {},
      }),
    // Refetch on success AND failure: a 409 means our copy of the order is out of date.
    onSettled: () => queryClient.invalidateQueries({ queryKey: orderKeys.staff }),
  });
}
