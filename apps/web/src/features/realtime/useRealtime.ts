import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { refreshAccessToken } from '../../lib/api-client';
import { useAuthStore } from '../auth/auth-store';
import {
  handleConnected,
  handleOrderCreated,
  handleOrderStatusChanged,
  type OrderCreatedEvent,
  type OrderStatusChangedEvent,
} from './realtime-handlers';
import { useRealtimeStore } from './realtime-store';

interface ServerToClientEvents {
  'order:created': (event: OrderCreatedEvent) => void;
  'order:status_changed': (event: OrderStatusChangedEvent) => void;
}

/**
 * Keeps one Socket.IO connection open while a user is logged in.
 * Same origin as the page: in development Vite proxies /socket.io to the API.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const role = useAuthStore((s) => s.user?.role);

  useEffect(() => {
    if (!userId || !role) return;
    const { setConnected } = useRealtimeStore.getState();

    const socket: Socket<ServerToClientEvents> = io({
      autoConnect: false,
      // WebSocket only. With the default HTTP long-polling start, a socket closed while it is
      // still connecting (React StrictMode mounts effects twice in development) can stay open.
      transports: ['websocket'],
      // A function, so every (re)connect sends the CURRENT access token.
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    });

    let refreshedForThisAttempt = false;

    socket.on('connect', () => {
      refreshedForThisAttempt = false;
      setConnected(true);
      handleConnected(queryClient);
    });

    socket.on('disconnect', () => setConnected(false));

    // The server checks the token only during the handshake. If it expired while we were
    // disconnected, the handshake fails: refresh once, then connect again.
    socket.on('connect_error', async (err) => {
      setConnected(false);
      if (err.message !== 'UNAUTHORIZED' || refreshedForThisAttempt) return;
      refreshedForThisAttempt = true;
      if (await refreshAccessToken()) socket.connect();
    });

    socket.on('order:status_changed', (event) =>
      handleOrderStatusChanged(queryClient, event, role),
    );
    socket.on('order:created', (event) => handleOrderCreated(queryClient, event, role));

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
    };
  }, [userId, role, queryClient]);
}
