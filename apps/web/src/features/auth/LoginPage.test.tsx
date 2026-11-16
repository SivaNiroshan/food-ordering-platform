import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

function renderLogin() {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/menu', element: <p>Menu page</p> },
    ],
    { initialEntries: ['/login'] },
  );
  render(<RouterProvider router={router} />);
}

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  it('shows field errors without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a clear message for wrong credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid' } }),
            { status: 401 },
          ),
        ),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'someone@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Wrong1234');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('don’t match an account');
  });

  it('goes to the role’s home page after logging in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: 'token',
            expiresIn: 900,
            user: {
              id: 'u1',
              name: 'Demo',
              email: 'customer@foodflow.local',
              role: 'CUSTOMER',
              isActive: true,
              createdAt: '2026-11-01T00:00:00Z',
            },
          }),
          { status: 200 },
        ),
      ),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'customer@foodflow.local');
    await userEvent.type(screen.getByLabelText('Password'), 'Password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Menu page')).toBeInTheDocument();
  });
});
