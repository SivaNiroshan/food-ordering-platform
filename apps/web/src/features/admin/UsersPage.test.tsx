import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../lib/types';
import { customerUser } from '../../test/fixtures';
import { mockFetch } from '../../test/mock-fetch';
import { renderPage } from '../../test/render';
import { useAuthStore } from '../auth/auth-store';
import { UsersPage } from './UsersPage';

const admin: User = {
  id: 'admin-1',
  name: 'Admin User',
  email: 'admin@foodflow.local',
  role: 'ADMIN',
  isActive: true,
  createdAt: '2026-11-01T00:00:00Z',
};

type Sent = { method: string; path: string; body: unknown };

function mockUsersApi(respond?: (sent: Sent) => { status?: number; body?: unknown } | undefined) {
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
      return respond?.(entry) ?? { body: { ...customerUser, name: 'New Person' } };
    },
    (url) =>
      url.pathname === '/api/v1/admin/users'
        ? {
            body: {
              data: [admin, customerUser],
              meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
            },
          }
        : undefined,
  );
  return { fetchMock, sent };
}

beforeEach(() => useAuthStore.getState().setSession(admin, 'token'));
afterEach(() => vi.unstubAllGlobals());

describe('UsersPage', () => {
  it('lists users and protects the admin’s own account', async () => {
    mockUsersApi();
    renderPage(<UsersPage />, { path: '/admin/users' });

    expect(await screen.findByText('customer@foodflow.local')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role for Admin User' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deactivate Admin User' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deactivate Demo Customer' })).toBeEnabled();
  });

  it('changes a role and deactivates an account', async () => {
    const { sent } = mockUsersApi();
    renderPage(<UsersPage />, { path: '/admin/users' });

    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Role for Demo Customer' }),
      'STAFF',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate Demo Customer' }));

    await vi.waitFor(() =>
      expect(sent).toEqual([
        { method: 'PATCH', path: '/api/v1/admin/users/customer-1/role', body: { role: 'STAFF' } },
        {
          method: 'PATCH',
          path: '/api/v1/admin/users/customer-1/status',
          body: { isActive: false },
        },
      ]),
    );
  });

  it('creates a staff account and handles a taken email', async () => {
    let calls = 0;
    const { sent } = mockUsersApi(() => {
      calls += 1;
      return calls === 1
        ? { status: 409, body: { error: { code: 'EMAIL_ALREADY_EXISTS', message: 'exists' } } }
        : { status: 201, body: { ...admin, id: 'new', name: 'Kamal P', role: 'STAFF' } };
    });
    renderPage(<UsersPage />, { path: '/admin/users' });

    await userEvent.click(await screen.findByRole('button', { name: 'Add a staff account' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Kamal P');
    await userEvent.type(screen.getByLabelText('Email'), 'kamal@foodflow.lk');
    await userEvent.type(screen.getByLabelText('Temporary password'), 'TempPass123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.body).toEqual({
      name: 'Kamal P',
      email: 'kamal@foodflow.lk',
      password: 'TempPass123',
      role: 'STAFF',
    });
    expect(await screen.findByRole('button', { name: 'Add a staff account' })).toBeInTheDocument();
  });

  it('sends role and status filters to the API', async () => {
    const { fetchMock } = mockUsersApi();
    renderPage(<UsersPage />, { path: '/admin/users' });
    await screen.findByText('customer@foodflow.local');

    await userEvent.selectOptions(screen.getByLabelText('Role'), 'STAFF');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'deactivated');

    await vi.waitFor(() => {
      const last = new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://x');
      expect(last.searchParams.get('role')).toBe('STAFF');
      expect(last.searchParams.get('isActive')).toBe('false');
    });
  });
});
