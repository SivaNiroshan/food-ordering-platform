import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../features/auth/auth-store';
import { ApiError, apiRequest } from './api-client';

const user = {
  id: 'u1',
  name: 'Demo Customer',
  email: 'customer@foodflow.local',
  role: 'CUSTOMER' as const,
  isActive: true,
  createdAt: '2026-11-01T00:00:00Z',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const expired = () =>
  json(401, { error: { code: 'ACCESS_TOKEN_EXPIRED', message: 'Access token has expired' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  useAuthStore.getState().setSession(user, 'old-token');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function authHeader(callIndex: number) {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit;
  return (init.headers as Record<string, string>).Authorization;
}

describe('apiRequest', () => {
  it('sends the access token', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await apiRequest('/me');

    expect(authHeader(0)).toBe('Bearer old-token');
  });

  it('refreshes an expired token once and retries the request', async () => {
    fetchMock
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(json(200, { accessToken: 'new-token', expiresIn: 900 }))
      .mockResolvedValueOnce(json(200, { ok: true }));

    const result = await apiRequest<{ ok: boolean }>('/me');

    expect(result).toEqual({ ok: true });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/refresh');
    expect(authHeader(2)).toBe('Bearer new-token');
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('shares one refresh between parallel requests', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(json(200, { accessToken: 'new-token', expiresIn: 900 }));
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return Promise.resolve(auth === 'Bearer new-token' ? json(200, { ok: true }) : expired());
    });

    await Promise.all([apiRequest('/a'), apiRequest('/b'), apiRequest('/c')]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('ends the session when the refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(expired())
      .mockResolvedValueOnce(
        json(401, { error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid' } }),
      );

    await expect(apiRequest('/me')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('turns error responses into ApiError with field errors', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ field: 'email', message: 'Invalid email address' }],
        },
        requestId: 'req-1',
      }),
    );

    const error = await apiRequest('/auth/register', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors()).toEqual({ email: 'Invalid email address' });
    expect((error as ApiError).requestId).toBe('req-1');
  });

  it('reports network failures clearly', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiRequest('/menu-items')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
