import { useAuthStore } from '../features/auth/auth-store';
import type { ApiErrorBody } from './types';

export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors from a 400 VALIDATION_ERROR, keyed by field name. */
  fieldErrors(): Record<string, string> {
    if (this.code !== 'VALIDATION_ERROR' || !Array.isArray(this.details)) return {};
    const result: Record<string, string> = {};
    for (const item of this.details as { field?: string; message?: string }[]) {
      if (item.field && item.message && !result[item.field]) result[item.field] = item.message;
    }
    return result;
  }
}

// ---------- Refresh ----------

let refreshInFlight: Promise<string | null> | null = null;

async function callRefreshEndpoint(): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
  }
  // Only a 401 means "your session is over". A 5xx or a proxy error means the server is
  // down or restarting: the session may be perfectly valid, so we must not log the user out.
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new ApiError(res.status, 'SERVICE_UNAVAILABLE', 'The server isn’t responding right now.');
  }
  const body = (await res.json()) as { accessToken: string };
  useAuthStore.getState().setAccessToken(body.accessToken);
  return body.accessToken;
}

/**
 * Gets a new access token from the refresh cookie.
 *
 * Refresh tokens are single-use (rotation + reuse detection on the server), so two
 * refreshes with the same cookie would look like token theft and end every session.
 * Two guards prevent that:
 *  - within one tab, concurrent callers share one in-flight request;
 *  - across tabs, the Web Locks API runs one refresh at a time. The browser shares
 *    cookies between tabs, so the second tab sends the already-rotated cookie.
 *
 * Resolves to the new token, or null when the session has ended (401).
 * Throws an ApiError when the server can't be reached, so callers keep the session.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        return await navigator.locks.request('foodflow-token-refresh', callRefreshEndpoint);
      }
      return await callRefreshEndpoint();
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// ---------- Requests ----------

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Send the access token. Default: true. */
  auth?: boolean;
}

async function send(path: string, options: RequestOptions, token: string | null) {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(
      res.status,
      body.error.code,
      body.error.message,
      body.error.details,
      body.requestId,
    );
  } catch {
    return new ApiError(res.status, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
  }
}

/**
 * Every API call goes through here. When the access token has expired, it refreshes
 * once and retries the original request, so pages never have to deal with token expiry.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  let res = await send(path, options, accessToken);

  if (res.status === 401 && options.auth !== false && accessToken) {
    const error = await toApiError(res.clone());
    if (error.code === 'ACCESS_TOKEN_EXPIRED') {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await send(path, options, newToken);
      }
    }
    // (If the refresh threw because the server is down, the error propagates and we stay logged in.)
    // Still unauthorized: the session is over (expired refresh, logout elsewhere, deactivated).
    if (res.status === 401) useAuthStore.getState().clearSession();
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
