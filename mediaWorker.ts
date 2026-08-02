import { Worker, type Job } from 'bullmq';
import fs from 'fs';
import { config } from '../config';
import { connection } from '../queue/queue';
import * as db from '../db/db';
import * as shopifyAdapter from '../adapters/shopifyAdapter';
import * as bumpaAdapter from '../adapters/bumpaAdapter';
import type { MediaJobData, Platform } from '../types/domain';

function makeProcessor(platform: Platform) {
  return async (job: Job<MediaJobData>) => {
    const { jobRowId, productRef, filePath, mediaType } = job.data;

    if (!fs.existsSync(filePath)) {
      db.updateJobStatus(jobRowId, 'failed', { error: 'Local file missing (was it cleaned up early?)' });
      throw new Error('Local file missing');
    }

    db.updateJobStatus(jobRowId, 'processing');
    db.incrementAttempts(jobRowId);

    try {
      // Shopify wants a GID (gid://shopify/Product/123); Bumpa's adapter takes
      // whatever product identifier your Bumpa catalog uses. Caller is
      // responsible for supplying the right productRef per platform when
      // enqueuing (see routes/uploads.ts).
      const result =
        platform === 'shopify'
          ? await shopifyAdapter.uploadMedia({ productGid: productRef, filePath, mediaType })
          : await bumpaAdapter.uploadMedia({ productRef, filePath, mediaType });

      db.updateJobStatus(jobRowId, 'done', { remote_media_id: result.remoteMediaId });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      db.updateJobStatus(jobRowId, 'failed', { error: message });
      throw err; // rethrow so BullMQ applies its retry/backoff policy
    }
  };
}

export function startWorkers() {
  const shopifyWorker = new Worker<MediaJobData>('media-upload:shopify', makeProcessor('shopify'), {
    connection,
    concurrency: config.shopify.concurrency,
  });

  const bumpaWorker = new Worker<MediaJobData>('media-upload:bumpa', makeProcessor('bumpa'), {
    connection,
    concurrency: config.bumpa.concurrency,
  });

  for (const worker of [shopifyWorker, bumpaWorker]) {
    worker.on('failed', (job, err) => {
      console.error(`[${worker.name}] job ${job?.id} failed (attempt ${job?.attemptsMade}): ${err.message}`);
    });
    worker.on('completed', (job) => {
      console.log(`[${worker.name}] job ${job.id} done`);
    });
  }

  console.log('Media upload workers started.');
  return { shopifyWorker, bumpaWorker };
}

if (require.main === module) {
  startWorkers();
}
