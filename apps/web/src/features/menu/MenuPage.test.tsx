import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '../../test/mock-fetch';
import { renderPage } from '../../test/render';
import { useAuthStore } from '../auth/auth-store';
import { useCartStore } from '../cart/cart-store';
import type { MenuItem } from './menu-api';
import { MenuPage } from './MenuPage';

const kottuCategory = { id: 'cat-kottu', name: 'Kottu', description: null };
const drinksCategory = { id: 'cat-drinks', name: 'Drinks', description: null };

function item(overrides: Partial<MenuItem> & Pick<MenuItem, 'id' | 'name' | 'price'>): MenuItem {
  return {
    description: null,
    imageUrl: null,
    isAvailable: true,
    category: { id: kottuCategory.id, name: kottuCategory.name },
    ...overrides,
  };
}

const MENU: MenuItem[] = [
  item({ id: 'milo', name: 'Iced Milo', price: '450.00', category: drinksCategory }),
  item({
    id: 'lime',
    name: 'Fresh Lime Juice',
    price: '350.00',
    isAvailable: false,
    category: drinksCategory,
  }),
  item({ id: 'kottu', name: 'Chicken Kottu', price: '1200.00' }),
];

/** A fake API that filters the menu the way the real one does. */
function mockMenuApi() {
  return mockFetch(
    (url) =>
      url.pathname === '/api/v1/categories' ? { body: [drinksCategory, kottuCategory] } : undefined,
    (url) => {
      if (url.pathname !== '/api/v1/menu-items') return undefined;
      const search = url.searchParams.get('search')?.toLowerCase();
      const categoryId = url.searchParams.get('categoryId');
      const data = MENU.filter(
        (i) =>
          (!search || i.name.toLowerCase().includes(search)) &&
          (!categoryId || i.category.id === categoryId),
      );
      return {
        body: { data, meta: { page: 1, pageSize: 50, totalItems: data.length, totalPages: 1 } },
      };
    },
  );
}

beforeEach(() => {
  localStorage.clear();
  useCartStore.getState().clear();
  useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
});

afterEach(() => vi.unstubAllGlobals());

describe('MenuPage', () => {
  it('shows the menu grouped by category, with sold-out items marked', async () => {
    mockMenuApi();
    renderPage(<MenuPage />, { path: '/menu' });

    const drinks = await screen.findByRole('region', { name: 'Drinks' });
    expect(within(drinks).getByText('Iced Milo')).toBeInTheDocument();
    expect(within(drinks).getByText('Sold out today')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Fresh Lime Juice' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kottu' })).toBeInTheDocument();
  });

  it('searches the menu after the user stops typing', async () => {
    const fetchMock = mockMenuApi();
    renderPage(<MenuPage />, { path: '/menu' });
    await screen.findByText('Iced Milo');

    await userEvent.type(screen.getByLabelText('Search the menu'), 'kottu');

    expect(await screen.findByText(/1 dish matches/)).toBeInTheDocument();
    expect(screen.queryByText('Iced Milo')).not.toBeInTheDocument();
    // Debounced: one request for "kottu", not one per letter
    const searches = fetchMock.mock.calls.filter(([url]) => String(url).includes('search='));
    expect(searches).toHaveLength(1);
  });

  it('filters by category', async () => {
    mockMenuApi();
    renderPage(<MenuPage />, { path: '/menu' });
    await screen.findByText('Iced Milo');

    await userEvent.click(screen.getByRole('button', { name: 'Kottu' }));

    expect(await screen.findByRole('button', { name: 'Kottu', pressed: true })).toBeInTheDocument();
    expect(screen.queryByText('Iced Milo')).not.toBeInTheDocument();
    expect(screen.getByText('Chicken Kottu')).toBeInTheDocument();
  });

  it('shows a helpful message when nothing matches', async () => {
    mockMenuApi();
    renderPage(<MenuPage />, { path: '/menu', route: '/menu?q=pizza' });

    expect(await screen.findByText('No dishes match “pizza”.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the full menu' })).toBeInTheDocument();
  });

  it('adds items to the order and shows the minimum-order hint', async () => {
    mockMenuApi();
    renderPage(<MenuPage />, { path: '/menu' });

    await userEvent.click(await screen.findByRole('button', { name: 'Add Iced Milo' }));

    const order = screen.getByRole('region', { name: 'Your order' });
    expect(within(order).getByText('LKR 450.00', { selector: 'span' })).toBeInTheDocument();
    expect(within(order).getByText(/Add LKR 50.00 more/)).toBeInTheDocument();
    expect(within(order).getByRole('button', { name: 'Log in to order' })).toBeDisabled();

    await userEvent.click(
      within(order).getByRole('button', { name: 'Increase Iced Milo quantity' }),
    );

    expect(within(order).getByText('LKR 900.00', { selector: 'span' })).toBeInTheDocument();
    expect(within(order).queryByText(/more to reach/)).not.toBeInTheDocument();
    expect(within(order).getByRole('button', { name: 'Log in to order' })).toBeEnabled();
  });

  it('sends guests to log in before checkout', async () => {
    mockMenuApi();
    useCartStore.getState().add({ id: 'kottu', name: 'Chicken Kottu', price: '1200.00' });
    renderPage(<MenuPage />, { path: '/menu' });

    await userEvent.click(await screen.findByRole('button', { name: 'Log in to order' }));

    expect(await screen.findByText('Navigated to /login')).toBeInTheDocument();
  });

  it('shows a read-only menu to staff', async () => {
    mockMenuApi();
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token',
      user: {
        id: 's1',
        name: 'Kitchen Staff',
        email: 'staff@foodflow.local',
        role: 'STAFF',
        isActive: true,
        createdAt: '2026-11-01T00:00:00Z',
      },
    });
    renderPage(<MenuPage />, { path: '/menu' });

    await screen.findByText('Iced Milo');
    expect(screen.queryByRole('button', { name: /^Add / })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your order' })).not.toBeInTheDocument();
  });

  it('offers a retry when the menu fails to load', async () => {
    mockFetch(
      (url) => (url.pathname === '/api/v1/categories' ? { body: [] } : undefined),
      (url) =>
        url.pathname === '/api/v1/menu-items'
          ? {
              status: 503,
              body: {
                error: {
                  code: 'SERVICE_UNAVAILABLE',
                  message: 'Service is temporarily unavailable',
                },
              },
            }
          : undefined,
    );
    renderPage(<MenuPage />, { path: '/menu' });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Service is temporarily unavailable',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});