import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const ORDER_QUEUE = 'order-processing';

export const JOBS = {
  expireOrder: 'expire-order',
  sweepOverdue: 'sweep-overdue-orders',
} as const;

// BullMQ requires maxRetriesPerRequest: null for its connections.
export const bullConnection = { url: env.REDIS_URL, maxRetriesPerRequest: null };

let queue: Queue | undefined;

function getQueue() {
  if (!queue) {
    queue = new Queue(ORDER_QUEUE, { connection: bullConnection });
    queue.on('error', (err) => logger.error({ err }, 'Order queue error'));
  }
  return queue;
}

// Methods live on an object so tests can spy on them.
export const orderJobs = {
  async scheduleExpiry(orderId: string, deadline: Date) {
    if (env.NODE_ENV === 'test') return;
    await getQueue().add(
      JOBS.expireOrder,
      { orderId },
      {
        jobId: `expire-${orderId}`, // one expiry job per order, even if called twice
        delay: Math.max(0, deadline.getTime() - Date.now()),
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 1000,
      },
    );
  },

  async close() {
    await queue?.close();
  },
};

export function getOrderQueue() {
  return getQueue();
}
