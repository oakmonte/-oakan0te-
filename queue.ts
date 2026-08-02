import { Queue, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import type { Platform, MediaJobData } from '../types/domain';

export const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

// Separate queues per platform so each can have its own concurrency/rate-limit
// tuned to that platform's API limits without one platform's backlog starving
// the other.
export const shopifyQueue = new Queue<MediaJobData>('media-upload:shopify', { connection });
export const bumpaQueue = new Queue<MediaJobData>('media-upload:bumpa', { connection });

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 3000 },
  removeOnComplete: 1000,
  removeOnFail: false, // keep failed jobs visible for inspection/retry
};

export function getQueueFor(platform: Platform): Queue<MediaJobData> {
  if (platform === 'shopify') return shopifyQueue;
  if (platform === 'bumpa') return bumpaQueue;
  throw new Error(`Unknown platform: ${platform satisfies never}`);
}
