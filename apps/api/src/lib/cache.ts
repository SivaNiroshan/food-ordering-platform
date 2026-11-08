import { env } from '../config/env.js';
import { logger } from './logger.js';
import { redis } from './redis.js';

// Disabled in tests: the test database is wiped before each test, so cached data would be stale.
const enabled = env.NODE_ENV !== 'test';

/**
 * Cache-aside with versioned keys.
 * Every key contains the namespace's current version; invalidating a namespace
 * just increments the version, so old keys are never read again and expire on their own.
 * Any Redis failure falls back to the database instead of failing the request.
 */
export async function cacheGetOrLoad<T>(
  namespace: string,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  if (!enabled) return load();

  let cacheKey: string | undefined;
  try {
    const version = (await redis.get(`${namespace}:version`)) ?? '0';
    cacheKey = `${namespace}:v${version}:${key}`;
    const hit = await redis.get(cacheKey);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err, namespace }, 'Cache read failed, using database');
  }

  const value = await load();

  if (cacheKey) {
    redis
      .set(cacheKey, JSON.stringify(value), 'EX', ttlSeconds)
      .catch((err: unknown) => logger.warn({ err, cacheKey }, 'Cache write failed'));
  }
  return value;
}

/** Call only AFTER the database write has succeeded. */
export async function invalidateNamespace(namespace: string) {
  if (!enabled) return;
  try {
    await redis.incr(`${namespace}:version`);
  } catch (err) {
    logger.error({ err, namespace }, 'Cache invalidation failed');
  }
}
