import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { usersRepository } from '../modules/users/users.repository.js';
import { ROOMS } from './events.js';

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  // Receives events published to Redis by the API or the worker.
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Authenticate once, during the handshake.
  io.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth.token;
      if (typeof token !== 'string') throw new Error('Missing token');

      const user = await usersRepository.findById(await verifyAccessToken(token));
      if (!user || !user.isActive) throw new Error('Inactive user');

      socket.data.user = { id: user.id, role: user.role };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  // The server decides which rooms a socket joins; clients never choose.
  io.on('connection', (socket) => {
    const user = socket.data.user as { id: string; role: string };
    void socket.join(ROOMS.user(user.id));
    if (user.role === 'STAFF' || user.role === 'ADMIN') void socket.join(ROOMS.staff);
    logger.debug({ userId: user.id }, 'Socket connected');
  });

  return {
    io,
    async close() {
      await io.close();
      await Promise.allSettled([pubClient.quit(), subClient.quit()]);
    },
  };
}