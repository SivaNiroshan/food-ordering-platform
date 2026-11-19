import { create } from 'zustand';
import type { User } from '../../lib/types';

/**
 * The access token lives ONLY in memory (never localStorage), so an XSS attack
 * can't read it from storage. After a page reload it is gone, and the app gets a
 * new one from the httpOnly refresh cookie (see restoreSession in auth-api.ts).
 */
/** 'unreachable': we couldn't ask the server whether there's a session (it's down). */
type SessionStatus = 'unknown' | 'authenticated' | 'anonymous' | 'unreachable';

interface AuthState {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
  setSession: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setStatus: (status: 'unknown' | 'unreachable') => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => set({ status: 'authenticated', user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ status: 'anonymous', user: null, accessToken: null }),
  setStatus: (status) => set({ status }),
}));
