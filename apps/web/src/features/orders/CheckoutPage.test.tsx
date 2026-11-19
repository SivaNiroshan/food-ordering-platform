import { onlineManager } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customerUser, makeOrder } from '../../test/fixtures';
import { mockFetch } from '../../test/mock-fetch';
import { renderPage } from '../../test/render';
import { useAuthStore } from '../auth/auth-store';
import { useCartStore } from '../cart/cart-store';
import { CheckoutPage } from './CheckoutPage';

const order = makeOrder();

function headerOf(call: unknown[] | undefined, name: string) {
  const init = call?.[1] as RequestInit;
  return (init.headers as Record<string, string>)[name];
}

beforeEach(() => {
  localStorage.clear();
  useAuthStore.getState().setSession(customerUser, 'token');
  useCartStore.getState().clear();
  useCartStore.getState().add({ id: 'kottu', name: 'Chicken Kottu', price: '1200.00' });
  useCartStore.getState().add({ id: 'milo', name: 'Iced Milo', price: '450.00' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});

describe('CheckoutPage', () => {
  it('places the order with an Idempotency-Key, clears the cart and opens the order', async () => {
    const fetchMock = mockFetch((url, init) =>
      url.pathname === '/api/v1/orders' && init.method === 'POST'
        ? { status: 201, body: order }
        : undefined,
    );
    renderPage(<CheckoutPage />, { path: '/checkout' });

    await userEvent.type(screen.getByLabelText(/Notes for the kitchen/), 'Less spicy');
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByText(`Navigated to /orders/${order.id}`)).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      items: [
        { menuItemId: 'kottu', quantity: 1 },
        { menuItemId: 'milo', quantity: 1 },
      ],
      notes: 'Less spicy',
    });
    expect(headerOf(fetchMock.mock.calls[0], 'Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it('reuses the same Idempotency-Key when retrying after a network failure', async () => {
    let calls = 0;
    const fetchMock = mockFetch((url) => {
      if (url.pathname !== '/api/v1/orders') return undefined;
      calls += 1;
      if (calls === 1) throw new TypeError('Failed to fetch');
      return { status: 200, body: order };
    });
    renderPage(<CheckoutPage />, { path: '/checkout' });

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('can’t tell whether your order');

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));
    await screen.findByText(`Navigated to /orders/${order.id}`);

    const firstKey = headerOf(fetchMock.mock.calls[0], 'Idempotency-Key');
    const secondKey = headerOf(fetchMock.mock.calls[1], 'Idempotency-Key');
    expect(secondKey).toBe(firstKey);
  });
  it('shows the message straight away when the browser is offline, instead of waiting', async () => {
    onlineManager.setOnline(false); // what React Query sees when DevTools is set to Offline
    const fetchMock = mockFetch((url) => {
      if (url.pathname === '/api/v1/orders') throw new TypeError('Failed to fetch');
      return undefined;
    });
    renderPage(<CheckoutPage />, { path: '/checkout' });

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('can’t tell whether your order');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
  });
  it('uses a new key when the order changes between attempts', async () => {
    const fetchMock = mockFetch((url) =>
      url.pathname === '/api/v1/orders'
        ? { status: 503, body: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Try again' } } }
        : undefined,
    );
    renderPage(<CheckoutPage />, { path: '/checkout' });

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));
    await screen.findByRole('alert');
    await userEvent.type(screen.getByLabelText(/Notes for the kitchen/), 'No onions');
    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(headerOf(fetchMock.mock.calls[1], 'Idempotency-Key')).not.toBe(
      headerOf(fetchMock.mock.calls[0], 'Idempotency-Key'),
    );
  });

  it('removes items that are no longer available and explains why', async () => {
    mockFetch((url) =>
      url.pathname === '/api/v1/orders'
        ? {
            status: 409,
            body: {
              error: {
                code: 'MENU_ITEM_UNAVAILABLE',
                message: 'Some items are no longer available',
                details: [{ menuItemId: 'milo' }],
              },
            },
          }
        : undefined,
    );
    renderPage(<CheckoutPage />, { path: '/checkout' });

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Iced Milo is no longer available, so we removed it',
    );
    expect(useCartStore.getState().lines.map((l) => l.menuItemId)).toEqual(['kottu']);
  });

  it('still explains why when every item sold out and the order is now empty', async () => {
    mockFetch((url) =>
      url.pathname === '/api/v1/orders'
        ? {
            status: 409,
            body: {
              error: {
                code: 'MENU_ITEM_UNAVAILABLE',
                message: 'Some items are no longer available',
                details: [{ menuItemId: 'kottu' }, { menuItemId: 'milo' }],
              },
            },
          }
        : undefined,
    );
    renderPage(<CheckoutPage />, { path: '/checkout' });

    await userEvent.click(screen.getByRole('button', { name: 'Place order' }));

    expect(await screen.findByRole('heading', { name: 'Your order is empty' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Chicken Kottu, Iced Milo are no longer available',
    );
  });

  it('shows an empty state when there is nothing to order', () => {
    useCartStore.getState().clear();
    renderPage(<CheckoutPage />, { path: '/checkout' });

    expect(screen.getByRole('heading', { name: 'Your order is empty' })).toBeInTheDocument();
  });
});
