import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { redis } from '../lib/redis.js';

// Disabled in tests: integration tests log in far more than 5 times a minute.
export const authRateLimit: RequestHandler =
  env.NODE_ENV === 'test'
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 60_000,
        limit: 5,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        store: new RedisStore({
          prefix: 'rl:auth:',
          sendCommand: (command: string, ...args: string[]) =>
            redis.call(command, ...args) as Promise<RedisReply>,
        }),
        handler: (_req, _res, next) =>
          next(new AppError(429, 'RATE_LIMITED', 'Too many attempts, please try again later')),
      });
