import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customerUser, makeOrder } from '../../test/fixtures';
import { mockFetch } from '../../test/mock-fetch';
import { renderPage } from '../../test/render';
import { useAuthStore } from '../auth/auth-store';
import { OrderDetailPage } from './OrderDetailPage';
import type { Order } from './order-types';

function renderOrder(order: Order) {
  return renderPage(<OrderDetailPage />, { path: '/orders/:id', route: `/orders/${order.id}` });
}

function mockOrderApi(order: Order, onCancel?: () => { status?: number; body?: unknown }) {
  return mockFetch(
    (url, init) =>
      url.pathname === `/api/v1/orders/${order.id}/cancel` && init.method === 'POST'
        ? onCancel?.()
        : undefined,
    (url) => (url.pathname === `/api/v1/orders/${order.id}` ? { body: order } : undefined),
  );
}

beforeEach(() => useAuthStore.getState().setSession(customerUser, 'token'));
afterEach(() => vi.unstubAllGlobals());

describe('OrderDetailPage', () => {
  it('shows a pending order with its deadline and items', async () => {
    const order = makeOrder();
    mockOrderApi(order);
    renderOrder(order);

    expect(
      await screen.findByRole('heading', { name: 'Waiting for the kitchen to accept' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/it’s cancelled automatically/)).toBeInTheDocument();
    expect(screen.getByText('Order #00A1B2', { exact: false })).toBeInTheDocument();
    const items = screen.getByRole('region', { name: 'What you ordered' });
    expect(within(items).getByText('LKR 2,850.00')).toBeInTheDocument();
  });

  it('marks the current step in the progress list', async () => {
    const order = makeOrder({
      status: 'PREPARING',
      history: [
        ...makeOrder().history!,
        {
          previousStatus: 'PENDING',
          newStatus: 'ACCEPTED',
          changeSource: 'STAFF',
          reasonCode: null,
          reasonNote: null,
          changedAt: '2026-11-17T09:02:00Z',
        },
        {
          previousStatus: 'ACCEPTED',
          newStatus: 'PREPARING',
          changeSource: 'STAFF',
          reasonCode: null,
          reasonNote: null,
          changedAt: '2026-11-17T09:03:00Z',
        },
      ],
    });
    mockOrderApi(order);
    renderOrder(order);

    await screen.findByRole('heading', { name: 'Your food is being prepared' });
    const current = screen.getByRole('listitem', { current: 'step' });
    expect(current).toHaveTextContent('Being prepared');
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
  });

  it('cancels a pending order after confirmation', async () => {
    const order = makeOrder();
    const cancelled = makeOrder({
      status: 'CANCELLED',
      statusReason: { code: 'CUSTOMER_REQUEST', note: null },
    });
    const fetchMock = mockOrderApi(order, () => ({ body: cancelled }));
    renderOrder(order);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    expect(fetchMock).toHaveBeenCalledTimes(1); // nothing sent before confirming
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    expect(
      await screen.findByRole('heading', { name: 'This order was cancelled' }),
    ).toBeInTheDocument();
    expect(screen.getByText('You cancelled this order.')).toBeInTheDocument();
  });

  it('explains when the kitchen accepted the order first', async () => {
    const order = makeOrder();
    mockOrderApi(order, () => ({
      status: 409,
      body: { error: { code: 'INVALID_STATUS_TRANSITION', message: 'Order is ACCEPTED' } },
    }));
    renderOrder(order);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already accepted this order');
  });

  it('shows the rejection reason and note', async () => {
    const order = makeOrder({
      status: 'REJECTED',
      statusReason: { code: 'KITCHEN_BUSY', note: 'Please try again in 30 minutes' },
    });
    mockOrderApi(order);
    renderOrder(order);

    expect(
      await screen.findByRole('heading', { name: 'The kitchen couldn’t take this order' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The kitchen is too busy right now.')).toBeInTheDocument();
    expect(screen.getByText('“Please try again in 30 minutes”')).toBeInTheDocument();
  });

  it('shows a clear message for an order that does not exist', async () => {
    const order = makeOrder();
    mockFetch(() => ({
      status: 404,
      body: { error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' } },
    }));
    renderOrder(order);

    expect(
      await screen.findByRole('heading', { name: 'We couldn’t find this order' }),
    ).toBeInTheDocument();
  });
});
