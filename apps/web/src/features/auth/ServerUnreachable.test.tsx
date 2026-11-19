import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customerUser } from '../../test/fixtures';
import { mockFetch } from '../../test/mock-fetch';
import { renderPage } from '../../test/render';
import { ConnectionBanner } from '../realtime/ConnectionBanner';
import { useRealtimeStore } from '../realtime/realtime-store';
import { useAuthStore } from './auth-store';
import { RequireAuth } from './RequireAuth';

beforeEach(() => {
  useAuthStore.setState({ status: 'unreachable', user: null, accessToken: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useRealtimeStore.getState().reset();
});

describe('when the server is unreachable on load', () => {
  it('explains the problem instead of sending the user to log in', () => {
    renderPage(
      <RequireAuth>
        <p>My orders</p>
      </RequireAuth>,
      { path: '/orders' },
    );

    expect(screen.getByRole('heading', { name: /can’t reach foodflow/i })).toBeInTheDocument();
    expect(screen.queryByText(/navigated to \/login/i)).not.toBeInTheDocument();
  });

  it('shows the page once "Try again" reaches the server', async () => {
    mockFetch(
      (url) =>
        url.pathname === '/api/v1/auth/refresh' ? { body: { accessToken: 't1' } } : undefined,
      (url) => (url.pathname === '/api/v1/me' ? { body: customerUser } : undefined),
    );
    renderPage(
      <RequireAuth>
        <p>My orders</p>
      </RequireAuth>,
      { path: '/orders' },
    );

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('My orders')).toBeInTheDocument();
  });
});

describe('ConnectionBanner', () => {
  it('stays hidden while connecting for the first time', () => {
    useRealtimeStore.getState().setConnected(false);
    renderPage(<ConnectionBanner />);
    expect(screen.queryByText(/lost connection/i)).not.toBeInTheDocument();
  });

  it('appears when a working connection drops', () => {
    useRealtimeStore.getState().setConnected(true);
    useRealtimeStore.getState().setConnected(false);
    renderPage(<ConnectionBanner />);
    expect(screen.getByRole('status')).toHaveTextContent(/lost connection to the server/i);
  });
});
