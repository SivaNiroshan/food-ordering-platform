import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

type CheckResult = 'ok' | 'error';

async function check(fn: () => Promise<unknown>, timeoutMs = 2000): Promise<CheckResult> {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return 'ok';
  } catch {
    return 'error';
  }
}

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const [database, redisStatus] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    check(() => redis.ping()),
  ]);
  const healthy = database === 'ok' && redisStatus === 'ok';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: { database, redis: redisStatus },
    uptimeSeconds: Math.round(process.uptime()),
  });
});