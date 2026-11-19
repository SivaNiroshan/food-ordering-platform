import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customerUser } from '../../test/fixtures';
import { mockFetch } from '../../test/mock-fetch';
import { restoreSession } from './auth-api';
import { useAuthStore } from './auth-store';

beforeEach(() => {
  useAuthStore.setState({ status: 'unknown', user: null, accessToken: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('restoreSession', () => {
  it('logs the user in when the refresh cookie is valid', async () => {
    mockFetch(
      (url) =>
        url.pathname === '/api/v1/auth/refresh' ? { body: { accessToken: 't1' } } : undefined,
      (url) => (url.pathname === '/api/v1/me' ? { body: customerUser } : undefined),
    );

    await restoreSession();

    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 't1' });
  });

  it('is logged out when the server says the session is over', async () => {
    mockFetch(() => ({
      status: 401,
      body: { error: { code: 'INVALID_REFRESH_TOKEN', message: 'No session' } },
    }));

    await restoreSession();

    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('is "unreachable", not logged out, when the server is down', async () => {
    mockFetch(() => ({ status: 502, body: { error: { code: 'BAD_GATEWAY', message: 'Down' } } }));

    await restoreSession();

    expect(useAuthStore.getState().status).toBe('unreachable');
  });

  it('is "unreachable" when the network request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await restoreSession();

    expect(useAuthStore.getState().status).toBe('unreachable');
  });
});
