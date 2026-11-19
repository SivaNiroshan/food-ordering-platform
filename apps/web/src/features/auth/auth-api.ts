import { ApiError, apiRequest, refreshAccessToken } from '../../lib/api-client';
import type { User } from '../../lib/types';
import { useAuthStore } from './auth-store';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export async function login(input: LoginInput) {
  const res = await apiRequest<{ accessToken: string; user: User }>('/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });
  useAuthStore.getState().setSession(res.user, res.accessToken);
  return res.user;
}

export function register(input: RegisterInput) {
  return apiRequest<User>('/auth/register', { method: 'POST', body: input, auth: false });
}

export async function logout() {
  try {
    await apiRequest<void>('/auth/logout', { method: 'POST', auth: false });
  } finally {
    // Log out locally even if the server call fails.
    useAuthStore.getState().clearSession();
  }
}

/**
 * Runs when the app starts. The access token was lost on reload, but the
 * httpOnly refresh cookie survives, so we exchange it for a new access token.
 *
 * Three outcomes: logged in, logged out (the server said 401), or "unreachable"
 * (the server is down, so we don't know yet). Unreachable must NOT look like logged out.
 */
export async function restoreSession() {
  const { setSession, clearSession, setStatus } = useAuthStore.getState();
  setStatus('unknown');
  try {
    const token = await refreshAccessToken();
    if (!token) {
      clearSession();
      return;
    }
    const user = await apiRequest<User>('/me');
    setSession(user, token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) clearSession();
    else setStatus('unreachable');
  }
}
