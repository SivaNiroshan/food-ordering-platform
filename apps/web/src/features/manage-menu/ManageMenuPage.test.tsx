import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { staffUser } from '../../test/fixtures';
import { mockFetch } from '../../test/mock-fetch';
import { renderPage } from '../../test/render';
import { useAuthStore } from '../auth/auth-store';
import type { StaffCategory, StaffMenuItem } from './manage-menu-api';
import { ManageMenuPage } from './ManageMenuPage';

const stamp = { createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' };
const kottuCategory: StaffCategory = {
  id: 'cat-kottu',
  name: 'Kottu',
  description: null,
  isActive: true,
  ...stamp,
};
const oldCategory: StaffCategory = {
  id: 'cat-old',
  name: 'Seasonal',
  description: null,
  isActive: false,
  ...stamp,
};

const kottu: StaffMenuItem = {
  id: 'dish-kottu',
  name: 'Chicken Kottu',
  description: 'Chopped roti with chicken',
  price: '1200.00',
  imageUrl: null,
  isAvailable: true,
  isActive: true,
  category: { id: kottuCategory.id, name: kottuCategory.name },
  ...stamp,
};

type Sent = { method: string; path: string; body: unknown };

function mockMenuAdminApi(
  respond?: (sent: Sent) => { status?: number; body?: unknown } | undefined,
) {
  const sent: Sent[] = [];
  const fetchMock = mockFetch(
    (url, init) => {
      if (init.method !== 'POST' && init.method !== 'PATCH') return undefined;
      const entry = {
        method: init.method,
        path: url.pathname,
        body: JSON.parse(String(init.body)),
      };
      sent.push(entry);
      return respond?.(entry) ?? { body: {} };
    },
    (url) =>
      url.pathname === '/api/v1/staff/categories'
        ? { body: [kottuCategory, oldCategory] }
        : undefined,
    (url) =>
      url.pathname === '/api/v1/staff/menu-items'
        ? { body: { data: [kottu], meta: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 } } }
        : undefined,
  );
  return { fetchMock, sent };
}

beforeEach(() => useAuthStore.getState().setSession(staffUser, 'token'));
afterEach(() => vi.unstubAllGlobals());

describe('ManageMenuPage: dishes', () => {
  it('validates a new dish, then creates it with a decimal-string price', async () => {
    const { sent } = mockMenuAdminApi();
    renderPage(<ManageMenuPage />, { path: '/manage/menu' });

    await userEvent.click(await screen.findByRole('button', { name: 'Add a dish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    expect(screen.getByText('Choose a category')).toBeInTheDocument();
    expect(screen.getByText('Enter a price like 1200 or 1200.50')).toBeInTheDocument();
    expect(sent).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Name'), 'Egg Hopper');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-kottu');
    await userEvent.type(screen.getByLabelText('Price (LKR)'), '150.5');
    await userEvent.click(screen.getByRole('button', { name: 'Add dish' }));

    await vi.waitFor(() =>
      expect(sent[0]).toEqual({
        method: 'POST',
        path: '/api/v1/staff/menu-items',
        body: { name: 'Egg Hopper', categoryId: 'cat-kottu', price: '150.5', isAvailable: true },
      }),
    );
  });

  it('marks a dish sold out with one click', async () => {
    const { sent } = mockMenuAdminApi();
    renderPage(<ManageMenuPage />, { path: '/manage/menu' });

    await userEvent.click(
      await screen.findByRole('switch', { name: 'Chicken Kottu available today' }),
    );

    await vi.waitFor(() =>
      expect(sent[0]).toEqual({
        method: 'PATCH',
        path: '/api/v1/staff/menu-items/dish-kottu',
        body: { isAvailable: false },
      }),
    );
  });

  it('clears an emptied description and can remove a dish from the menu', async () => {
    const { sent } = mockMenuAdminApi();
    renderPage(<ManageMenuPage />, { path: '/manage/menu' });

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Chicken Kottu' }));
    const form = screen.getByRole('form', { name: 'Edit Chicken Kottu' });
    await userEvent.clear(within(form).getByLabelText('Description (optional)'));
    await userEvent.click(within(form).getByLabelText(/Show on the menu/));
    await userEvent.click(within(form).getByRole('button', { name: 'Save changes' }));

    await vi.waitFor(() =>
      expect(sent[0]?.body).toMatchObject({ description: null, imageUrl: null, isActive: false }),
    );
  });

  it('explains when the chosen category is hidden', async () => {
    mockMenuAdminApi(() => ({
      status: 400,
      body: {
        error: { code: 'CATEGORY_NOT_FOUND', message: 'Category does not exist or is inactive' },
      },
    }));
    renderPage(<ManageMenuPage />, { path: '/manage/menu' });

    await userEvent.click(await screen.findByRole('button', { name: 'Add a dish' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Pumpkin Curry');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'cat-old');
    await userEvent.type(screen.getByLabelText('Price (LKR)'), '700');
    await userEvent.click(screen.getByRole('button', { name: 'Add dish' }));

    expect(await screen.findByText(/This category is hidden or was removed/)).toBeInTheDocument();
  });
});

describe('ManageMenuPage: categories', () => {
  it('shows a clear error for a duplicate category name', async () => {
    mockMenuAdminApi(() => ({
      status: 409,
      body: { error: { code: 'CATEGORY_ALREADY_EXISTS', message: 'exists' } },
    }));
    renderPage(<ManageMenuPage />, { path: '/manage/menu', route: '/manage/menu?tab=categories' });

    const form = await screen.findByRole('form', { name: 'Add a category' });
    await userEvent.type(within(form).getByLabelText('Name'), 'KOTTU');
    await userEvent.click(within(form).getByRole('button', { name: 'Add category' }));

    expect(
      await within(form).findByText('A category with this name already exists.'),
    ).toBeInTheDocument();
  });

  it('hides a category from customers', async () => {
    const { sent } = mockMenuAdminApi();
    renderPage(<ManageMenuPage />, { path: '/manage/menu', route: '/manage/menu?tab=categories' });

    await userEvent.click(await screen.findByRole('switch', { name: 'Show Kottu on the menu' }));

    await vi.waitFor(() =>
      expect(sent[0]).toEqual({
        method: 'PATCH',
        path: '/api/v1/staff/categories/cat-kottu',
        body: { isActive: false },
      }),
    );
  });
});
