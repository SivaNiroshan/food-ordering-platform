import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// Shared client for caching, rate limiting and publishing realtime events.
// Fails fast (1 retry, 1s timeout) so a Redis outage never hangs HTTP requests.
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  commandTimeout: 1000,
});

redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));
