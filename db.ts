import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { config } from '../config';
import type { MediaJobRow, JobStatus, Platform } from '../types/domain';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    total_items INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS media_jobs (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    product_ref TEXT NOT NULL,
    file_path TEXT NOT NULL,
    media_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    remote_media_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  );

  CREATE INDEX IF NOT EXISTS idx_media_jobs_batch ON media_jobs(batch_id);
  CREATE INDEX IF NOT EXISTS idx_media_jobs_status ON media_jobs(status);
`);

export interface BatchRecord {
  id: string;
  created_at: string;
  total_items: number;
  status: string;
}

export interface StatusCount {
  status: JobStatus;
  count: number;
}

export interface FailedJobSummary {
  id: string;
  platform: Platform;
  product_ref: string;
  error: string | null;
}

export interface BatchSummary {
  batch: BatchRecord;
  counts: StatusCount[];
  failedJobs: FailedJobSummary[];
}

export function createBatch(id: string, totalItems: number): void {
  db.prepare(
    `INSERT INTO batches (id, created_at, total_items, status) VALUES (?, datetime('now'), ?, 'pending')`
  ).run(id, totalItems);
}

export function insertMediaJob(job: MediaJobRow): void {
  db.prepare(
    `INSERT INTO media_jobs
      (id, batch_id, platform, product_ref, file_path, media_type, status, attempts, created_at, updated_at)
     VALUES (@id, @batchId, @platform, @productRef, @filePath, @mediaType, 'queued', 0, datetime('now'), datetime('now'))`
  ).run(job);
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  patch: Record<string, string | null> = {}
): void {
  const fields = { status, ...patch };
  const setClause = Object.keys(fields)
    .map((k) => `${k} = @${k}`)
    .join(', ');
  db.prepare(`UPDATE media_jobs SET ${setClause}, updated_at = datetime('now') WHERE id = @id`).run({
    ...fields,
    id,
  });
}

export function incrementAttempts(id: string): void {
  db.prepare(`UPDATE media_jobs SET attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?`).run(id);
}

export function getBatchSummary(batchId: string): BatchSummary | null {
  const batch = db.prepare(`SELECT * FROM batches WHERE id = ?`).get(batchId) as BatchRecord | undefined;
  if (!batch) return null;

  const counts = db
    .prepare(`SELECT status, COUNT(*) as count FROM media_jobs WHERE batch_id = ? GROUP BY status`)
    .all(batchId) as StatusCount[];

  const failedJobs = db
    .prepare(`SELECT id, platform, product_ref, error FROM media_jobs WHERE batch_id = ? AND status = 'failed'`)
    .all(batchId) as FailedJobSummary[];

  return { batch, counts, failedJobs };
}

export { db };
