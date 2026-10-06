// "New video" edits, saved to the device as you go.
//
// The parked session (session.ts) survives a trip to publish, but not a
// reload, a crash, or iOS killing the tab in the background — which on a
// phone editing video is not rare. Losing a six-clip edit to that is the
// complaint this exists for. So the project is written to IndexedDB a moment
// after every change, with the media it needs, and "New video" offers to pick
// it back up.
//
// IndexedDB because it is the one browser store that holds Blobs; sources go
// in once each (by id — they never change), the project JSON on every save.
// Sticker images are object URLs that die with the page, so their bytes are
// saved too and re-attached on restore. Every call swallows failure: private
// browsing, a full disk or a refused quota must cost the safety net, never
// the edit itself.

import type { SoundCredit } from "@/lib/sound-library";
import type { SourceMap, StudioProject, StudioSource } from "./types";

const DB = "oakmonte-studio";
const VERSION = 1;
const META = "meta";
const BLOBS = "blobs";
const CURRENT = "current";

type StoredSource = Omit<StudioSource, "blob" | "url">;

type Saved = {
  project: StudioProject;
  sources: StoredSource[];
  inheritedCredit: SoundCredit | null;
  savedAt: number;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  name: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await open();
  try {
    return await fn(db.transaction(name, mode).objectStore(name));
  } finally {
    db.close();
  }
}

const stickerKey = (layerId: string) => `sticker:${layerId}`;

/** Save the edit. Media already saved is skipped, so after the first save
 *  this is a small JSON write. */
export async function autosaveStudio(
  project: StudioProject,
  sources: SourceMap,
  inheritedCredit: SoundCredit | null,
): Promise<void> {
  try {
    const have = new Set(
      (await withStore(BLOBS, "readonly", (s) => request(s.getAllKeys()))).map(String),
    );
    const blobs: [string, Blob][] = [];
    for (const source of Object.values(sources)) {
      if (!have.has(source.id)) blobs.push([source.id, source.blob]);
    }
    for (const layer of project.layers) {
      if (layer.kind !== "sticker" || !layer.assetUrl.startsWith("blob:")) continue;
      if (have.has(stickerKey(layer.id))) continue;
      blobs.push([stickerKey(layer.id), await (await fetch(layer.assetUrl)).blob()]);
    }
    for (const [key, blob] of blobs) {
      await withStore(BLOBS, "readwrite", (s) => request(s.put(blob, key)));
    }
    // Media the edit no longer uses — a deleted clip, a removed sticker —
    // goes, or a long session would keep every take it ever touched.
    const used = new Set([
      ...Object.keys(sources),
      ...project.layers.filter((l) => l.kind === "sticker").map((l) => stickerKey(l.id)),
    ]);
    for (const key of have) {
      if (!used.has(key)) await withStore(BLOBS, "readwrite", (s) => request(s.delete(key)));
    }
    const saved: Saved = {
      project,
      sources: Object.values(sources).map(({ blob: _b, url: _u, ...rest }) => rest),
      inheritedCredit,
      savedAt: Date.now(),
    };
    await withStore(META, "readwrite", (s) => request(s.put(saved, CURRENT)));
  } catch (err) {
    console.warn("Studio autosave failed", err);
  }
}

/** When the saved edit was made, without loading its media. */
export async function autosavedAt(): Promise<number | null> {
  try {
    const saved = await withStore(META, "readonly", (s) =>
      request(s.get(CURRENT) as IDBRequest<Saved | undefined>),
    );
    return saved && saved.project.clips.length > 0 ? saved.savedAt : null;
  } catch {
    return null;
  }
}

/** The saved edit with live object URLs, or null if any of it is missing. */
export async function loadAutosave(): Promise<{
  project: StudioProject;
  sources: SourceMap;
  inheritedCredit: SoundCredit | null;
} | null> {
  try {
    const saved = await withStore(META, "readonly", (s) =>
      request(s.get(CURRENT) as IDBRequest<Saved | undefined>),
    );
    if (!saved) return null;
    const sources: SourceMap = {};
    for (const meta of saved.sources) {
      const blob = await withStore(BLOBS, "readonly", (s) =>
        request(s.get(meta.id) as IDBRequest<Blob | undefined>),
      );
      if (!blob) return null;
      sources[meta.id] = { ...meta, blob, url: URL.createObjectURL(blob) };
    }
    const layers = [];
    for (const layer of saved.project.layers) {
      if (layer.kind === "sticker" && layer.assetUrl.startsWith("blob:")) {
        const blob = await withStore(BLOBS, "readonly", (s) =>
          request(s.get(stickerKey(layer.id)) as IDBRequest<Blob | undefined>),
        );
        if (!blob) continue;
        layers.push({ ...layer, assetUrl: URL.createObjectURL(blob) });
      } else {
        layers.push(layer);
      }
    }
    return {
      project: { ...saved.project, layers },
      sources,
      inheritedCredit: saved.inheritedCredit,
    };
  } catch (err) {
    console.warn("Studio autosave could not be read", err);
    return null;
  }
}

/** Forget the saved edit: it was posted, or thrown away on purpose. */
export async function clearAutosave(): Promise<void> {
  try {
    await withStore(META, "readwrite", (s) => request(s.clear()));
    await withStore(BLOBS, "readwrite", (s) => request(s.clear()));
  } catch {
    // Nothing to clear, or nowhere to clear it from.
  }
}
