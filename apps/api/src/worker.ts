import { Worker } from 'bullmq';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { bullConnection, getOrderQueue, JOBS, ORDER_QUEUE } from './jobs/queues.js';
import { ordersService } from './modules/orders/orders.service.js';

/*
 * Background worker: a separate process from the API (same codebase).
 * - expire-order:         runs at each order's acceptance deadline (delayed job)
 * - sweep-overdue-orders: runs every minute and catches any order whose job was lost
 */
const worker = new Worker(
  ORDER_QUEUE,
  async (job) => {
    switch (job.name) {
      case JOBS.expireOrder: {
        const { orderId } = job.data as { orderId: string };
        const result = await ordersService.expireIfOverdue(orderId);
        logger.info({ orderId, result }, 'Processed order expiry');
        return result;
      }
      case JOBS.sweepOverdue: {
        const expired = await ordersService.sweepOverdue();
        if (expired > 0) logger.warn({ expired }, 'Sweep expired overdue orders');
        return expired;
      }
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  { connection: bullConnection, concurrency: 5 },
);

worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'Job failed'));
worker.on('error', (err) => logger.error({ err }, 'Worker error'));

// Idempotent: re-running on every start just updates the existing schedule.
await getOrderQueue().upsertJobScheduler(
  JOBS.sweepOverdue,
  { every: 60_000 },
  { name: JOBS.sweepOverdue },
);
logger.info('Worker started');

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Worker shutting down');
  await worker.close(); // waits for running jobs to finish
  await Promise.allSettled([getOrderQueue().close(), prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));