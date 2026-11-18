import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { Page } from '../../lib/types';
import type { Order } from './order-types';

// Query keys in one place, so realtime updates invalidate exactly the right data.
export const orderKeys = {
  detail: (id: string) => ['orders', id] as const,
  allDetails: ['orders'] as const,
  mine: ['my-orders'] as const,
  staff: ['staff-orders'] as const,
};

export interface PlaceOrderInput {
  items: { menuItemId: string; quantity: number }[];
  notes?: string;
  idempotencyKey: string;
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    // Never queue an order while offline: fail now, so the customer sees the message and
    // chooses to retry (with the same Idempotency-Key). Set here as well as in the app's
    // defaults, because this is the one action where a silent delayed send matters most.
    networkMode: 'always',
    mutationFn: ({ items, notes, idempotencyKey }: PlaceOrderInput) =>
      apiRequest<Order>('/orders', {
        method: 'POST',
        body: { items, notes },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: orderKeys.mine });
    },
  });
}

export function useMyOrders(page: number) {
  return useQuery({
    queryKey: [...orderKeys.mine, { page }],
    queryFn: ({ signal }) =>
      apiRequest<Page<Order>>(`/orders?page=${page}&pageSize=10`, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useMyOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: ({ signal }) => apiRequest<Order>(`/orders/${id}`, { signal }),
  });
}

export function useCancelOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Order>(`/orders/${id}/cancel`, { method: 'POST', body: {} }),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(id), order);
      void queryClient.invalidateQueries({ queryKey: orderKeys.mine });
    },
  });
}
