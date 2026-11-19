import { create } from 'zustand';

interface RealtimeState {
  connected: boolean;
  /** True after a working connection dropped, until it comes back. Not set on the first connect. */
  lost: boolean;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>()((set) => ({
  connected: false,
  lost: false,
  setConnected: (connected) =>
    set((state) => ({ connected, lost: !connected && (state.connected || state.lost) })),
  reset: () => set({ connected: false, lost: false }),
}));
