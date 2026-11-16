import { apiRequest, refreshAccessToken } from '../../lib/api-client';
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
 * Runs once when the app starts. The access token was lost on reload, but the
 * httpOnly refresh cookie survives, so we exchange it for a new access token.
 */
export async function restoreSession() {
  const { setSession, clearSession } = useAuthStore.getState();
  const token = await refreshAccessToken();
  if (!token) {
    clearSession();
    return;
  }
  try {
    const user = await apiRequest<User>('/me');
    setSession(user, token);
  } catch {
    clearSession();
  }
}
