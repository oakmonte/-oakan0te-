import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { config } from '../config';
import * as db from '../db/db';
import { getQueueFor, defaultJobOptions } from '../queue/queue';
import type { MediaType, BatchMappingEntry, MediaJobRow } from '../types/domain';

const router = express.Router();

fs.mkdirSync(config.uploadTmpDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadTmpDir),
  filename: (_req, file, cb) => cb(null, `${nanoid()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB cap, tune as needed

function mediaTypeFor(file: Express.Multer.File): MediaType {
  return file.mimetype.startsWith('video/') ? 'video' : 'image';
}

/**
 * POST /uploads/batch
 *
 * multipart/form-data body:
 *   - files: one or more files (images/videos)
 *   - mapping: JSON string array, same length/order as files, e.g.
 *       [
 *         { "shopifyProductGid": "gid://shopify/Product/123", "bumpaProductId": "abc" },
 *         { "shopifyProductGid": "gid://shopify/Product/124" }   // bumpa optional per item
 *       ]
 *     Omit a platform's id on an item to skip that platform for that file.
 */
router.post('/batch', upload.array('files'), (req: Request, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded (field name must be "files").' });
    }

    let mapping: BatchMappingEntry[];
    try {
      mapping = JSON.parse(req.body.mapping || '[]');
    } catch {
      return res.status(400).json({ error: 'mapping must be valid JSON.' });
    }
    if (mapping.length !== files.length) {
      return res
        .status(400)
        .json({ error: `mapping length (${mapping.length}) must match files length (${files.length}).` });
    }

    const batchId = nanoid();
    const jobRows: MediaJobRow[] = [];

    files.forEach((file, i) => {
      const { shopifyProductGid, bumpaProductId } = mapping[i] || {};
      const mediaType = mediaTypeFor(file);

      if (shopifyProductGid) {
        jobRows.push({
          id: nanoid(),
          batchId,
          platform: 'shopify',
          productRef: shopifyProductGid,
          filePath: file.path,
          mediaType,
        });
      }
      if (bumpaProductId) {
        jobRows.push({
          id: nanoid(),
          batchId,
          platform: 'bumpa',
          productRef: bumpaProductId,
          filePath: file.path,
          mediaType,
        });
      }
    });

    if (!jobRows.length) {
      return res.status(400).json({ error: 'No mapping entries referenced a target product on either platform.' });
    }

    db.createBatch(batchId, jobRows.length);

    for (const row of jobRows) {
      db.insertMediaJob(row);
      getQueueFor(row.platform).add(
        'upload-media',
        {
          jobRowId: row.id,
          productRef: row.productRef,
          filePath: row.filePath,
          mediaType: row.mediaType,
        },
        defaultJobOptions
      );
    }

    res.status(202).json({ batchId, queued: jobRows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal error queuing batch.' });
  }
});

// GET /uploads/batch/:id -> status summary (counts by status + failed job details)
router.get('/batch/:id', (req: Request, res: Response) => {
  const summary = db.getBatchSummary(req.params.id);
  if (!summary) return res.status(404).json({ error: 'Batch not found.' });
  res.json(summary);
});

export default router;
