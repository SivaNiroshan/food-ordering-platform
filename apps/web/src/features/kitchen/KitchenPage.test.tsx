import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '../../components/ui/toast-store';
import { makeOrder, staffUser } from '../../test/fixtures';
import { mockFetch } from '../../test/mock-fetch';
import { renderPage } from '../../test/render';
import { useAuthStore } from '../auth/auth-store';
import type { Order } from '../orders/order-types';
import { KitchenPage } from './KitchenPage';

const customer = { id: 'c1', name: 'Demo Customer', email: 'customer@foodflow.local' };

const pending = makeOrder({
  id: '0195f0b4-0000-7000-8000-000000aaaaaa',
  customer,
  notes: 'Less spicy please',
});
const preparing = makeOrder({
  id: '0195f0b4-0000-7000-8000-000000bbbbbb',
  status: 'PREPARING',
  customer,
});

function page(data: Order[]) {
  return { data, meta: { page: 1, pageSize: 50, totalItems: data.length, totalPages: 1 } };
}

/** Fake API: the board, the history list, and staff actions. */
function mockKitchenApi(
  board: Order[],
  onAction?: (path: string, body: unknown) => { status?: number; body?: unknown },
) {
  return mockFetch(
    (url, init) =>
      init.method === 'POST' && url.pathname.startsWith('/api/v1/staff/orders/')
        ? (onAction?.(url.pathname, JSON.parse(String(init.body ?? '{}'))) ?? { body: {} })
        : undefined,
    (url) => {
      if (url.pathname !== '/api/v1/staff/orders') return undefined;
      const statuses = url.searchParams.getAll('status');
      return { body: page(statuses.includes('PENDING') ? board : []) };
    },
  );
}

function loginAs(role: 'STAFF' | 'ADMIN') {
  useAuthStore.getState().setSession({ ...staffUser, role }, 'token');
}

beforeEach(() => {
  loginAs('STAFF');
  useToastStore.setState({ toasts: [] });
});
afterEach(() => vi.unstubAllGlobals());

describe('KitchenPage', () => {
  it('shows active orders in columns, oldest first, with notes', async () => {
    mockKitchenApi([pending, preparing]);
    renderPage(<KitchenPage />, { path: '/kitchen' });

    const newColumn = await screen.findByRole('region', { name: /New/ });
    expect(within(newColumn).getByRole('article', { name: '#AAAAAA' })).toBeInTheDocument();
    expect(within(newColumn).getByText('Less spicy please')).toBeInTheDocument();
    expect(
      within(newColumn).getByText(/Cancels automatically|Cancelling automatically/),
    ).toBeInTheDocument();

    const preparingColumn = screen.getByRole('region', { name: /Preparing/ });
    expect(within(preparingColumn).getByRole('article', { name: '#BBBBBB' })).toBeInTheDocument();
    expect(screen.getByText('Nothing waiting for pickup.')).toBeInTheDocument();
  });

  it('accepts an order and refreshes the board', async () => {
    const fetchMock = mockKitchenApi([pending], () => ({
      body: { ...pending, status: 'ACCEPTED' },
    }));
    renderPage(<KitchenPage />, { path: '/kitchen' });

    await userEvent.click(await screen.findByRole('button', { name: 'Accept: order #AAAAAA' }));

    await vi.waitFor(() => {
      const paths = fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://x').pathname);
      expect(paths).toContain(`/api/v1/staff/orders/${pending.id}/accept`);
      // board fetched again after the action
      expect(paths.filter((p) => p === '/api/v1/staff/orders').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('explains when someone else updated the order first', async () => {
    mockKitchenApi([pending], () => ({
      status: 409,
      body: { error: { code: 'INVALID_STATUS_TRANSITION', message: 'Order is CANCELLED' } },
    }));
    renderPage(<KitchenPage />, { path: '/kitchen' });

    await userEvent.click(await screen.findByRole('button', { name: 'Accept: order #AAAAAA' }));

    await vi.waitFor(() =>
      expect(useToastStore.getState().toasts[0]?.message).toMatch(/#AAAAAA was already updated/),
    );
  });

  it('requires a note when rejecting for another reason, then sends the reason', async () => {
    let sent: unknown;
    mockKitchenApi([pending], (path, body) => {
      sent = { path, body };
      return { body: { ...pending, status: 'REJECTED' } };
    });
    renderPage(<KitchenPage />, { path: '/kitchen' });

    await userEvent.click(await screen.findByRole('button', { name: 'Reject order #AAAAAA' }));
    await userEvent.click(screen.getByLabelText('Other reason'));
    await userEvent.click(screen.getByRole('button', { name: 'Reject order' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add a note');
    expect(sent).toBeUndefined();

    await userEvent.click(screen.getByLabelText('The kitchen is too busy'));
    await userEvent.type(screen.getByLabelText(/Note for the customer/), 'Try again at 2 pm');
    await userEvent.click(screen.getByRole('button', { name: 'Reject order' }));

    await vi.waitFor(() =>
      expect(sent).toEqual({
        path: `/api/v1/staff/orders/${pending.id}/reject`,
        body: { reasonCode: 'KITCHEN_BUSY', note: 'Try again at 2 pm' },
      }),
    );
  });

  it('shows admins the board without action buttons', async () => {
    loginAs('ADMIN');
    mockKitchenApi([pending, preparing]);
    renderPage(<KitchenPage />, { path: '/kitchen' });

    await screen.findByRole('article', { name: '#AAAAAA' });
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Accept/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reject/ })).not.toBeInTheDocument();
  });

  it('lists finished orders with their reasons and can filter by day', async () => {
    const rejected = makeOrder({
      id: '0195f0b4-0000-7000-8000-000000cccccc',
      status: 'REJECTED',
      customer,
      statusReason: { code: 'KITCHEN_BUSY', note: 'Very busy' },
    });
    const fetchMock = mockFetch((url) => {
      if (url.pathname !== '/api/v1/staff/orders') return undefined;
      return {
        body: page(url.searchParams.getAll('status').includes('REJECTED') ? [rejected] : []),
      };
    });
    renderPage(<KitchenPage />, { path: '/kitchen' });

    await userEvent.click(screen.getByRole('button', { name: 'Finished orders' }));
    expect(await screen.findByText('Kitchen too busy: Very busy')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Day'), '2026-11-17');

    await vi.waitFor(() => {
      const last = new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://x');
      expect(last.searchParams.getAll('status')).toEqual(['COMPLETED', 'REJECTED', 'CANCELLED']);
      expect(last.searchParams.get('from')).toBeTruthy();
      expect(last.searchParams.get('to')).toBeTruthy();
    });
  });
});
