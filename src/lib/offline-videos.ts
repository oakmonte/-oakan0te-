// Posts saved for watching without a connection.
//
// Two stores, one job each:
//
//   - The BYTES live in Cache Storage (`oak-offline-v1`), one entry per media
//     URL, so a saved video is a real file on the phone rather than something
//     the browser's HTTP cache may or may not still hold tomorrow.
//   - The INDEX (which posts, who posted them, how big) is a small JSON list in
//     localStorage. Synchronous on purpose: the share sheet has to say "Saved
//     offline" on its first paint, and IndexedDB's async open would flash
//     "Save for offline" first. A few dozen entries is a few KB.
//
// The two can drift apart -- a browser short on space may evict Cache Storage
// without touching localStorage, and a tab killed mid-save leaves bytes no
// index entry points at. listOffline() reconciles both directions, so nothing
// here trusts the index to be the truth about what is actually on disk.
//
// Everything that needs a browser API is behind a function call: the module
// imports cleanly under SSR and under `bun test`, which exercises the pure
// bookkeeping at the top of the file.
import { useMemo, useSyncExternalStore } from "react";

export const OFFLINE_CACHE = "oak-offline-v1";
const INDEX_KEY = "oak-offline-index-v1";
const PERSIST_ASKED_KEY = "oak-offline-persist-asked";
// Stamped on every response we store, so the orphan sweep can tell a
// half-finished save that is still running (in this tab or another one) from
// one whose tab died. Cache Storage keeps no timestamps of its own.
const SAVED_AT_HEADER = "X-Oak-Saved-At";
const ORPHAN_GRACE_MS = 10 * 60 * 1000;

export type OfflineMediaType = "video" | "photo";

export type OfflineMedia = { url: string; type: OfflineMediaType; bytes: number };

export type OfflineEntry = {
  postId: string;
  caption: string | null;
  author: { displayName: string | null; username: string | null };
  /** Epoch ms. */
  savedAt: number;
  /** Everything this post stored: media, poster and sound. */
  bytes: number;
  /** Every carousel item, in order. Always at least one. */
  media: OfflineMedia[];
  /** A still for the grid. Null when the post had none, or it failed to save
   *  -- the post still plays, the grid falls back to the first photo. */
  posterUrl: string | null;
  /** The post's chosen sound, when it has one and it saved. */
  audio: { url: string; label: string | null } | null;
};

/** What a caller hands over to save a post. Mirrors the feed's own post shape
 *  rather than the table's, so the share sheet can pass what it already has. */
export type OfflinePostInput = {
  postId: string;
  caption: string | null;
  author: { displayName: string | null; username: string | null };
  media: { url: string; type: string }[];
  posterUrl: string | null;
  audioUrl: string | null;
  audioLabel: string | null;
};

export type OfflineProgress = { loaded: number; total: number | null };

export type OfflineErrorCode =
  | "unsupported"
  | "offline"
  | "network"
  | "http"
  | "quota"
  | "cancelled"
  | "empty";

/** A failed save, with a message fit to show as-is. */
export class OfflineSaveError extends Error {
  readonly code: OfflineErrorCode;
  constructor(code: OfflineErrorCode, message: string) {
    super(message);
    this.name = "OfflineSaveError";
    this.code = code;
  }
}

const MESSAGES: Record<Exclude<OfflineErrorCode, "http">, string> = {
  unsupported: "This browser can't keep posts for offline viewing.",
  offline: "You're offline. Connect to the internet to save this post.",
  // A CORS refusal and a dropped connection are the same TypeError from
  // fetch() -- the browser deliberately won't say which -- so the message
  // has to cover both rather than guess.
  network:
    "Couldn't download this post. Check your connection and try again. If it keeps failing, this post can't be saved offline.",
  quota: "Not enough storage space on this device. Delete some offline posts and try again.",
  cancelled: "Saving was cancelled.",
  empty: "This post has nothing to save.",
};

function offlineError(code: Exclude<OfflineErrorCode, "http">): OfflineSaveError {
  return new OfflineSaveError(code, MESSAGES[code]);
}

// ---------------------------------------------------------------------------
// Pure bookkeeping (unit-tested in offline-videos.test.ts)
// ---------------------------------------------------------------------------

/** Cache keys are compared as the browser serialises them (`Request.url`), so
 *  every URL is stored in that same form or a lookup would miss on something
 *  as small as a percent-encoding difference. */
export function normalizeUrl(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

export function normalizeMediaType(type: string): OfflineMediaType {
  return type === "video" ? "video" : "photo";
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function nullableString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function isFiniteNonNegative(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function parseEntry(raw: unknown): OfflineEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.postId) || !r.postId) return null;
  if (!isFiniteNonNegative(r.savedAt) || !isFiniteNonNegative(r.bytes)) return null;
  if (!Array.isArray(r.media) || r.media.length === 0) return null;
  const media: OfflineMedia[] = [];
  for (const m of r.media) {
    if (!m || typeof m !== "object") return null;
    const mm = m as Record<string, unknown>;
    if (!isString(mm.url) || !mm.url || !isFiniteNonNegative(mm.bytes)) return null;
    media.push({ url: mm.url, type: normalizeMediaType(String(mm.type)), bytes: mm.bytes });
  }
  const author = (r.author && typeof r.author === "object" ? r.author : {}) as Record<
    string,
    unknown
  >;
  const audioRaw = (r.audio && typeof r.audio === "object" ? r.audio : null) as Record<
    string,
    unknown
  > | null;
  return {
    postId: r.postId,
    caption: nullableString(r.caption),
    author: {
      displayName: nullableString(author.displayName),
      username: nullableString(author.username),
    },
    savedAt: r.savedAt,
    bytes: r.bytes,
    media,
    posterUrl: nullableString(r.posterUrl),
    audio:
      audioRaw && isString(audioRaw.url) && audioRaw.url
        ? { url: audioRaw.url, label: nullableString(audioRaw.label) }
        : null,
  };
}

/** The stored index, newest first. Anything malformed is dropped rather than
 *  thrown on: a hand-edited or half-written value must not take the page down,
 *  and the bytes it pointed at are collected by the orphan sweep. */
export function parseIndex(raw: string | null): OfflineEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list =
    parsed && typeof parsed === "object" && Array.isArray((parsed as { entries?: unknown }).entries)
      ? (parsed as { entries: unknown[] }).entries
      : [];
  const seen = new Set<string>();
  const out: OfflineEntry[] = [];
  for (const raw of list) {
    const entry = parseEntry(raw);
    if (!entry || seen.has(entry.postId)) continue;
    seen.add(entry.postId);
    out.push(entry);
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function serializeIndex(entries: OfflineEntry[]): string {
  return JSON.stringify({ v: 1, entries });
}

/** Add or replace by post id; newest first. Saving a post twice keeps one. */
export function upsertEntry(entries: OfflineEntry[], entry: OfflineEntry): OfflineEntry[] {
  return [entry, ...entries.filter((e) => e.postId !== entry.postId)].sort(
    (a, b) => b.savedAt - a.savedAt,
  );
}

export function removeEntry(entries: OfflineEntry[], postId: string): OfflineEntry[] {
  return entries.filter((e) => e.postId !== postId);
}

export function indexBytes(entries: OfflineEntry[]): number {
  return entries.reduce((n, e) => n + e.bytes, 0);
}

/** Every cache key one saved post owns. */
export function entryUrls(entry: OfflineEntry): string[] {
  const urls = entry.media.map((m) => m.url);
  if (entry.posterUrl) urls.push(entry.posterUrl);
  if (entry.audio) urls.push(entry.audio.url);
  return [...new Set(urls)];
}

/** The cache keys that can go once `removed` is gone: theirs, minus anything a
 *  post that is staying still points at. Two posts sharing a file is rare, but
 *  deleting one must never break the other. */
export function urlsToRelease(remaining: OfflineEntry[], removed: OfflineEntry[]): string[] {
  const keep = new Set(remaining.flatMap(entryUrls));
  return [...new Set(removed.flatMap(entryUrls))].filter((u) => !keep.has(u));
}

/** Sum of Content-Lengths, or null when any is unknown -- a total that
 *  silently left a file out would let the bar hit 100% too early. */
export function sumKnownLengths(lengths: (number | null)[]): number | null {
  let total = 0;
  for (const n of lengths) {
    if (n === null) return null;
    total += n;
  }
  return total;
}

export function parseContentLength(header: string | null): number | null {
  if (!header) return null;
  const n = Number(header);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 0..1, or null when there is no total to measure against. Clamped: a
 *  compressed response can deliver more bytes than its Content-Length says. */
export function downloadFraction(progress: OfflineProgress): number | null {
  if (progress.total === null || progress.total <= 0) return null;
  return Math.min(1, Math.max(0, progress.loaded / progress.total));
}

/** Whether `needed` more bytes fit, with a margin for the index and for the
 *  browser's own per-entry overhead. Null when the browser won't say. */
export function hasRoomFor(
  estimate: { usage?: number | null; quota?: number | null } | null,
  needed: number,
): boolean | null {
  const quota = estimate?.quota;
  const usage = estimate?.usage;
  if (!isFiniteNonNegative(quota) || !isFiniteNonNegative(usage)) return null;
  return quota - usage >= needed * 1.05 + 1024 * 1024;
}

/** "0 B", "840 KB", "12.4 MB", "1.2 GB". Decimal units, the way phones report
 *  storage in their own settings, so the numbers here match those. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  // One decimal below 10 ("4.2 MB"), none above ("84 MB"): the extra digit
  // only means something while the number is small.
  const text = value < 10 ? value.toFixed(1).replace(/\.0$/, "") : String(Math.round(value));
  return `${text} ${units[unit]}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today", "Yesterday", "3 Oct", or "3 Oct 2025" once it's from another year.
 *  Calendar days in the phone's own timezone, not 24-hour windows. */
export function formatSavedAt(savedAt: number, now: number = Date.now()): string {
  const d = new Date(savedAt);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** The type the stored blob gets. iOS refuses to play a blob: URL whose type
 *  isn't video/*, and a CDN serving the original upload can label it
 *  application/octet-stream -- every video this app publishes is an MP4
 *  (post-media-upload.ts makes sure of that), so that is the safe default. */
export function storedContentType(
  kind: OfflineMediaType | "audio",
  header: string | null,
  url: string,
): string {
  const h = (header ?? "").split(";")[0].trim().toLowerCase();
  if (kind === "video") return h.startsWith("video/") ? h : "video/mp4";
  if (kind === "audio") return h.startsWith("audio/") ? h : "audio/mpeg";
  if (h.startsWith("image/")) return h;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

export function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; code?: unknown };
  // Firefox has used its own name for the same thing; 22 is the legacy code.
  return (
    e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22
  );
}

function isAbortError(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { name?: unknown }).name === "AbortError";
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    // Safari with storage blocked throws on the property access itself.
    return null;
  }
}

/** False on the server, outside a secure context (Cache Storage only exists on
 *  https and localhost), and where storage is blocked -- private modes and
 *  some in-app browsers. */
export function isOfflineSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext || typeof caches === "undefined") return false;
  return storage() !== null;
}

// ---------------------------------------------------------------------------
// Index store
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
const EMPTY: OfflineEntry[] = [];
// Parsed once and kept until something writes, so useSyncExternalStore gets
// the same array back on every render (a fresh parse each time would loop).
let indexCache: OfflineEntry[] | null = null;
let storageListening = false;

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Another tab saving or deleting writes the same key; the storage event is
  // how this one finds out.
  if (!storageListening && typeof window !== "undefined") {
    storageListening = true;
    window.addEventListener("storage", (e) => {
      if (e.key !== null && e.key !== INDEX_KEY) return;
      indexCache = null;
      emit();
    });
  }
  return () => {
    listeners.delete(fn);
  };
}

export function readIndex(): OfflineEntry[] {
  if (indexCache) return indexCache;
  const s = storage();
  if (!s) return EMPTY;
  let raw: string | null = null;
  try {
    raw = s.getItem(INDEX_KEY);
  } catch {
    raw = null;
  }
  indexCache = parseIndex(raw);
  return indexCache;
}

function writeIndex(entries: OfflineEntry[]) {
  const s = storage();
  if (!s) throw offlineError("unsupported");
  try {
    if (entries.length === 0) s.removeItem(INDEX_KEY);
    else s.setItem(INDEX_KEY, serializeIndex(entries));
  } catch (err) {
    if (isQuotaError(err)) throw offlineError("quota");
    throw err;
  }
  indexCache = entries;
  emit();
}

export function isSavedOffline(postId: string): boolean {
  return readIndex().some((e) => e.postId === postId);
}

// ---------------------------------------------------------------------------
// Storage space
// ---------------------------------------------------------------------------

export type StorageInfo = {
  /** Everything this origin stores, not just offline posts. */
  usage: number | null;
  quota: number | null;
  /** True once the browser has promised not to evict without asking. */
  persisted: boolean | null;
};

export async function getStorageInfo(): Promise<StorageInfo> {
  const s = typeof navigator !== "undefined" ? navigator.storage : undefined;
  let usage: number | null = null;
  let quota: number | null = null;
  let persisted: boolean | null = null;
  try {
    const est = await s?.estimate?.();
    const u = est?.usage;
    const q = est?.quota;
    usage = isFiniteNonNegative(u) ? u : null;
    quota = isFiniteNonNegative(q) ? q : null;
  } catch {
    // Not available (older Safari); the page just doesn't show the bar.
  }
  try {
    persisted = (await s?.persisted?.()) ?? null;
  } catch {
    persisted = null;
  }
  return { usage, quota, persisted };
}

/** Ask, once per device, for storage the browser won't evict under pressure.
 *  Chrome decides silently from engagement; Firefox shows a prompt, which is
 *  why this runs from the first save (a tap) and never again after that. */
export async function requestPersistenceOnce(): Promise<boolean | null> {
  const s = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!s?.persist) return null;
  try {
    if (await s.persisted?.()) return true;
  } catch {
    // Fall through and ask.
  }
  const ls = storage();
  try {
    if (ls?.getItem(PERSIST_ASKED_KEY)) return null;
    ls?.setItem(PERSIST_ASKED_KEY, "1");
  } catch {
    // Can't remember having asked; asking is still harmless.
  }
  try {
    return await s.persist();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

// URLs a save in THIS tab has fetched but not yet indexed. The orphan sweep
// must leave them alone; another tab's are covered by the saved-at grace.
const inflightUrls = new Set<string>();

type Part = { url: string; kind: OfflineMediaType | "audio"; required: boolean };

async function fetchPart(part: Part, signal?: AbortSignal): Promise<Response | null> {
  let res: Response;
  try {
    // `cors` rather than `no-cors`: an opaque response can be stored but its
    // bytes can never be read back, so nothing could ever be played from it.
    // credentials omitted -- public CDN files, and cookies would only make the
    // CDN's CORS answer stricter.
    res = await fetch(part.url, { mode: "cors", credentials: "omit", signal });
  } catch (err) {
    if (isAbortError(err)) throw offlineError("cancelled");
    if (!part.required) return null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw offlineError("offline");
    }
    throw offlineError("network");
  }
  if (!res.ok || res.type === "opaque") {
    if (!part.required) return null;
    throw new OfflineSaveError(
      "http",
      `This post's media isn't available right now (error ${res.status || "unknown"}).`,
    );
  }
  return res;
}

async function readBody(res: Response, onChunk: (bytes: number) => void): Promise<Blob> {
  if (!res.body) {
    const blob = await res.blob();
    onChunk(blob.size);
    return blob;
  }
  // Read by hand rather than res.blob() so progress can be reported as the
  // bytes arrive. Aborting the fetch's signal errors read() with an
  // AbortError, which is how cancel reaches into this loop.
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onChunk(value.byteLength);
  }
  return new Blob(chunks as BlobPart[]);
}

/** Download every carousel item (plus poster and sound) into Cache Storage and
 *  index the post. Resolves with the new entry; rejects with an
 *  OfflineSaveError whose message can be shown as-is. Anything stored before a
 *  failure or a cancel is removed again. */
export async function saveForOffline(
  input: OfflinePostInput,
  opts: { signal?: AbortSignal; onProgress?: (p: OfflineProgress) => void } = {},
): Promise<OfflineEntry> {
  const { signal, onProgress } = opts;
  if (!isOfflineSupported()) throw offlineError("unsupported");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw offlineError("offline");
  }
  // Not awaited: the answer doesn't change whether this save goes ahead.
  void requestPersistenceOnce();

  const media = input.media
    .filter((m) => typeof m.url === "string" && m.url)
    .map((m) => ({ url: normalizeUrl(m.url), type: normalizeMediaType(m.type) }));
  if (media.length === 0) throw offlineError("empty");

  // Media is required -- a carousel missing a slide isn't the post. The poster
  // and the sound are not: a post that saves without its thumbnail still
  // plays, and one without its sound still shows.
  const parts: Part[] = [];
  const seen = new Set<string>();
  for (const m of media) {
    if (seen.has(m.url)) continue;
    seen.add(m.url);
    parts.push({ url: m.url, kind: m.type, required: true });
  }
  const posterUrl = input.posterUrl ? normalizeUrl(input.posterUrl) : null;
  if (posterUrl && !seen.has(posterUrl)) {
    seen.add(posterUrl);
    parts.push({ url: posterUrl, kind: "photo", required: false });
  }
  const audioUrl = input.audioUrl ? normalizeUrl(input.audioUrl) : null;
  if (audioUrl && !seen.has(audioUrl)) {
    seen.add(audioUrl);
    parts.push({ url: audioUrl, kind: "audio", required: false });
  }

  for (const p of parts) inflightUrls.add(p.url);
  const stored: string[] = [];
  const sizes = new Map<string, number>();
  let cache: Cache | null = null;

  try {
    cache = await caches.open(OFFLINE_CACHE);
    // Every request starts at once so the Content-Lengths -- and so the
    // progress total and the space check -- are known before any body is
    // read. Bodies are then read one at a time; the browser applies
    // backpressure to the rest, so this doesn't buffer the whole post twice.
    const responses = await Promise.all(parts.map((p) => fetchPart(p, signal)));
    const fetched = parts.flatMap((p, i) => {
      const res = responses[i];
      return res ? [{ part: p, res }] : [];
    });
    const total = sumKnownLengths(
      fetched.map(({ res }) => parseContentLength(res.headers.get("Content-Length"))),
    );

    if (total !== null) {
      const info = await getStorageInfo();
      if (hasRoomFor(info, total) === false) throw offlineError("quota");
    }

    let loaded = 0;
    onProgress?.({ loaded, total });
    for (const { part, res } of fetched) {
      let blob: Blob;
      try {
        blob = await readBody(res, (n) => {
          loaded += n;
          onProgress?.({ loaded, total });
        });
      } catch (err) {
        if (isAbortError(err) || signal?.aborted) throw offlineError("cancelled");
        if (!part.required) continue;
        throw offlineError("network");
      }
      if (signal?.aborted) throw offlineError("cancelled");
      const type = storedContentType(part.kind, res.headers.get("Content-Type"), part.url);
      const typed = blob.type === type ? blob : new Blob([blob], { type });
      await cache.put(
        part.url,
        new Response(typed, {
          headers: {
            "Content-Type": type,
            "Content-Length": String(typed.size),
            [SAVED_AT_HEADER]: String(Date.now()),
          },
        }),
      );
      stored.push(part.url);
      sizes.set(part.url, typed.size);
    }

    const entry: OfflineEntry = {
      postId: input.postId,
      caption: input.caption,
      author: { displayName: input.author.displayName, username: input.author.username },
      savedAt: Date.now(),
      bytes: [...sizes.values()].reduce((n, b) => n + b, 0),
      media: media.map((m) => ({ url: m.url, type: m.type, bytes: sizes.get(m.url) ?? 0 })),
      posterUrl: posterUrl && sizes.has(posterUrl) ? posterUrl : null,
      audio: audioUrl && sizes.has(audioUrl) ? { url: audioUrl, label: input.audioLabel } : null,
    };
    // A cancel (or Delete all) that landed during the last write still wins.
    if (signal?.aborted) throw offlineError("cancelled");
    writeIndex(upsertEntry(readIndex(), entry));
    return entry;
  } catch (err) {
    // Release what this attempt stored -- but not a file a post that is
    // already saved also uses, which re-saving would otherwise delete.
    if (cache && stored.length > 0) {
      const keep = new Set(readIndex().flatMap(entryUrls));
      await Promise.all(
        stored.filter((u) => !keep.has(u)).map((u) => cache!.delete(u).catch(() => false)),
      );
    }
    if (err instanceof OfflineSaveError) throw err;
    if (isAbortError(err) || signal?.aborted) throw offlineError("cancelled");
    if (isQuotaError(err)) throw offlineError("quota");
    console.error("offline-videos: save failed", err);
    throw offlineError("network");
  } finally {
    for (const p of parts) inflightUrls.delete(p.url);
  }
}

// ---------------------------------------------------------------------------
// Listing, reading back, deleting
// ---------------------------------------------------------------------------

/** The index, checked against what Cache Storage actually holds. A post whose
 *  media the browser evicted is dropped (there is nothing left to play), and
 *  bytes no post points at are deleted once they're past the grace period.
 *  `pruned` is how many posts went, so the page can say so. */
export async function listOffline(): Promise<{ entries: OfflineEntry[]; pruned: number }> {
  if (!isOfflineSupported()) return { entries: [], pruned: 0 };
  const cache = await caches.open(OFFLINE_CACHE);
  const keys = await cache.keys();
  const present = new Set(keys.map((r) => r.url));

  const entries = readIndex();
  const kept: OfflineEntry[] = [];
  const pruned: OfflineEntry[] = [];
  let changed = false;
  for (const e of entries) {
    if (!e.media.every((m) => present.has(m.url))) {
      pruned.push(e);
      changed = true;
      continue;
    }
    // A missing poster or sound costs a still or the music, not the post.
    const posterGone = e.posterUrl !== null && !present.has(e.posterUrl);
    const audioGone = e.audio !== null && !present.has(e.audio.url);
    if (posterGone || audioGone) {
      changed = true;
      kept.push({
        ...e,
        posterUrl: posterGone ? null : e.posterUrl,
        audio: audioGone ? null : e.audio,
      });
    } else {
      kept.push(e);
    }
  }
  if (changed) writeIndex(kept);

  const referenced = new Set(kept.flatMap(entryUrls));
  const now = Date.now();
  await Promise.all(
    keys.map(async (req) => {
      if (referenced.has(req.url) || inflightUrls.has(req.url)) return;
      const res = await cache.match(req);
      const savedAt = Number(res?.headers.get(SAVED_AT_HEADER) ?? 0);
      if (Number.isFinite(savedAt) && now - savedAt < ORPHAN_GRACE_MS) return;
      await cache.delete(req).catch(() => false);
    }),
  );

  return { entries: kept, pruned: pruned.length };
}

/** A stored file as a Blob, or null when it isn't there (evicted, or never
 *  saved). The caller owns any object URL it makes from it. */
export async function readCachedBlob(url: string): Promise<Blob | null> {
  if (!isOfflineSupported()) return null;
  try {
    const cache = await caches.open(OFFLINE_CACHE);
    const res = await cache.match(url);
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

export async function deleteOffline(postId: string): Promise<void> {
  const entries = readIndex();
  const target = entries.find((e) => e.postId === postId);
  if (!target) return;
  const remaining = removeEntry(entries, postId);
  // Index first, so the post disappears from every screen straight away. If
  // the byte deletion below fails, the orphan sweep collects them later.
  writeIndex(remaining);
  if (!isOfflineSupported()) return;
  const cache = await caches.open(OFFLINE_CACHE);
  await Promise.all(
    urlsToRelease(remaining, [target]).map((u) => cache.delete(u).catch(() => false)),
  );
}

export async function deleteAllOffline(): Promise<void> {
  for (const controller of controllers.values()) controller.abort();
  writeIndex([]);
  if (isOfflineSupported()) await caches.delete(OFFLINE_CACHE);
}

// ---------------------------------------------------------------------------
// Opening with no connection at all (public/sw.js)
// ---------------------------------------------------------------------------

const SW_URL = "/sw.js";
const PRIME_MESSAGE = "oak-prime-offline-shell";
// Once per page load is plenty: the shell only changes with a deploy, and a
// deploy means a fresh page load. "full" also carries what this page loaded.
let primed: "none" | "basic" | "full" = "none";

function loadedAssetPaths(): string[] {
  try {
    return performance.getEntriesByType("resource").flatMap((entry) => {
      const u = new URL(entry.name);
      return u.origin === window.location.origin &&
        /^\/assets\/[^?#]+\.(?:js|css)$/.test(u.pathname)
        ? [u.pathname]
        : [];
    });
  } catch {
    return [];
  }
}

/** Make /offline-videos openable on a cold start with no connection: register
 *  the service worker (only ever from here, so only people who use offline
 *  posts get one) and have it store the current Offline videos page and its
 *  assets. Fire-and-forget; without it, saved posts still play whenever the
 *  page is already open.
 *
 *  `includeLoaded` is for the Offline videos page itself: what it actually
 *  loaded is the most reliable list of what it needs. */
export function primeOfflineShell(opts: { includeLoaded?: boolean } = {}): void {
  const want = opts.includeLoaded ? "full" : "basic";
  if (primed === "full" || primed === want) return;
  if (typeof window === "undefined" || !window.isSecureContext) return;
  if (!("serviceWorker" in navigator) || navigator.onLine === false) return;
  const previous = primed;
  primed = want;
  const assets = opts.includeLoaded ? loadedAssetPaths() : [];
  navigator.serviceWorker
    .register(SW_URL, { scope: "/" })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => reg.active?.postMessage({ type: PRIME_MESSAGE, assets }))
    .catch((err: unknown) => {
      primed = previous;
      console.warn("offline-videos: couldn't set up opening offline", err);
    });
}

// ---------------------------------------------------------------------------
// Save jobs: progress that outlives the sheet that started it
// ---------------------------------------------------------------------------

export type OfflineJob =
  | { status: "saving"; loaded: number; total: number | null }
  | { status: "error"; error: OfflineSaveError };

// Module-level, like dark-overlay.ts: closing the share sheet mid-download
// must not cancel it, and reopening the sheet on the same post (or opening
// it from a different card) has to find the same progress.
const jobs = new Map<string, OfflineJob>();
const controllers = new Map<string, AbortController>();
// Progress lands per network chunk -- hundreds a second on a fast link.
// Re-rendering on every one would be pure waste; ~8 a second reads as smooth.
const PROGRESS_INTERVAL_MS = 120;

function setJob(postId: string, job: OfflineJob | null) {
  if (job) jobs.set(postId, job);
  else jobs.delete(postId);
  emit();
}

export function startOfflineSave(input: OfflinePostInput): void {
  if (jobs.get(input.postId)?.status === "saving") return;
  const controller = new AbortController();
  controllers.set(input.postId, controller);
  setJob(input.postId, { status: "saving", loaded: 0, total: null });

  let lastEmit = 0;
  saveForOffline(input, {
    signal: controller.signal,
    onProgress: ({ loaded, total }) => {
      const now = Date.now();
      if (now - lastEmit < PROGRESS_INTERVAL_MS && loaded !== total) return;
      lastEmit = now;
      setJob(input.postId, { status: "saving", loaded, total });
    },
  })
    .then(() => {
      setJob(input.postId, null);
      primeOfflineShell();
    })
    .catch((err: unknown) => {
      const error = err instanceof OfflineSaveError ? err : offlineError("network");
      // A cancel is the user's own decision; it needs no error state.
      setJob(input.postId, error.code === "cancelled" ? null : { status: "error", error });
    })
    .finally(() => {
      if (controllers.get(input.postId) === controller) controllers.delete(input.postId);
    });
}

export function cancelOfflineSave(postId: string): void {
  controllers.get(postId)?.abort();
}

export function dismissOfflineSaveError(postId: string): void {
  if (jobs.get(postId)?.status === "error") setJob(postId, null);
}

// ---------------------------------------------------------------------------
// React bindings
// ---------------------------------------------------------------------------

const serverEntries = () => EMPTY;

/** The saved posts as the index has them, re-rendering on any change in this
 *  tab or another. Synchronous -- for a page that must show what is actually
 *  on disk, use listOffline() as well. */
export function useOfflineEntries(): OfflineEntry[] {
  return useSyncExternalStore(subscribe, readIndex, serverEntries);
}

export type OfflineSaveState =
  | { status: "unsupported" }
  | { status: "idle" }
  | { status: "saved"; entry: OfflineEntry }
  | { status: "saving"; progress: OfflineProgress }
  | { status: "error"; error: OfflineSaveError };

const serverJob = () => null;

export function useOfflineSave(postId: string): OfflineSaveState {
  const entries = useOfflineEntries();
  const job = useSyncExternalStore(subscribe, () => jobs.get(postId) ?? null, serverJob);
  return useMemo((): OfflineSaveState => {
    if (job?.status === "saving") {
      return { status: "saving", progress: { loaded: job.loaded, total: job.total } };
    }
    if (job?.status === "error") return { status: "error", error: job.error };
    const entry = entries.find((e) => e.postId === postId);
    if (entry) return { status: "saved", entry };
    // Checked last and only on the client: during SSR nothing is supported,
    // and a saved post must still read as saved on the first client render.
    if (typeof window !== "undefined" && !isOfflineSupported()) return { status: "unsupported" };
    return { status: "idle" };
  }, [job, entries, postId]);
}
