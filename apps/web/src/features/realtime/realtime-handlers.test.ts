import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '../../components/ui/toast-store';
import {
  handleConnected,
  handleOrderCreated,
  handleOrderStatusChanged,
  type OrderStatusChangedEvent,
} from './realtime-handlers';

const statusEvent: OrderStatusChangedEvent = {
  orderId: '0195f0b4-0000-7000-8000-00000000a1b2',
  previousStatus: 'PREPARING',
  status: 'READY',
  changeSource: 'STAFF',
  reason: null,
  changedAt: '2026-11-17T09:10:00Z',
};

let queryClient: QueryClient;
let invalidated: unknown[][];

beforeEach(() => {
  queryClient = new QueryClient();
  invalidated = [];
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async (filters) => {
    invalidated.push([...((filters?.queryKey as unknown[]) ?? [])]);
  });
  useToastStore.setState({ toasts: [] });
});

describe('realtime handlers', () => {
  it('refetches the changed order and the order lists', () => {
    handleOrderStatusChanged(queryClient, statusEvent, 'CUSTOMER');

    expect(invalidated).toEqual([['orders', statusEvent.orderId], ['my-orders'], ['staff-orders']]);
  });

  it('notifies the customer when the kitchen changes their order', () => {
    handleOrderStatusChanged(queryClient, statusEvent, 'CUSTOMER');

    expect(useToastStore.getState().toasts[0]).toMatchObject({
      message: 'Order #00A1B2: Ready to collect',
      tone: 'success',
    });
  });

  it('does not notify customers about their own cancellation', () => {
    handleOrderStatusChanged(
      queryClient,
      { ...statusEvent, status: 'CANCELLED', changeSource: 'CUSTOMER' },
      'CUSTOMER',
    );

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('tells staff about new orders and refreshes their queue', () => {
    handleOrderCreated(
      queryClient,
      {
        orderId: statusEvent.orderId,
        customerName: 'Demo Customer',
        subtotal: '2850.00',
        itemCount: 3,
        createdAt: '2026-11-17T09:00:00Z',
      },
      'STAFF',
    );

    expect(invalidated).toEqual([['staff-orders']]);
    expect(useToastStore.getState().toasts[0]?.message).toBe(
      'New order #00A1B2 from Demo Customer',
    );
  });

  it('refetches everything after a reconnect, in case events were missed', () => {
    handleConnected(queryClient);

    expect(invalidated).toEqual([['orders'], ['my-orders'], ['staff-orders']]);
  });
});
