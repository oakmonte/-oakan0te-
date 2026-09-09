import { uploadProductImage } from "@/lib/upload-product-image";
import { uploadStoreThemeImage } from "@/lib/upload-store-theme-image";

// Every image-upload sheet in the /store section (product photos, variant
// photos, store theme logo/slideshow) ran its upload as local useState inside
// whichever popover started it: closing that popover, or navigating away,
// unmounted the component mid-upload and orphaned the file on Bunny with no
// URL ever attached to anything, and the caller couldn't retry a failed
// upload without picking the file again. This is the same "module-level
// state + listener + useSyncExternalStore toast" pattern already proven in
// post-upload.ts/product-save.ts, adapted for uploads specifically:
//
// - Keyed by a Map rather than a single pendingPayload, since a seller can
//   have several uploads in flight at once (a few product photos, or a photo
//   AND a theme logo) -- post-upload.ts/product-save.ts are both explicitly
//   single-in-flight, which doesn't fit here.
// - Retry re-sends the original File (kept on the upload record itself),
//   closer to post-upload.ts's "resend the original FormData" than to
//   product-save.ts's "replay a multi-step payload" -- there's no multi-step
//   sequence here, just one PUT.
// - onBackgroundUploadDone lets a caller that OUTLIVES the popover that
//   started the upload (the page the popover was opened from) find out when
//   it resolves and patch its own state -- the actual fix for "keep doing
//   whatever you're doing even if the upload isn't done yet". A caller that
//   started the upload and is still mounted when it resolves doesn't need
//   this at all; the toast covers everyone regardless.
//
// Deliberately NOT covered: the seller navigating fully away from the
// route entirely (not just closing a nested popover). That would need
// patching localStorage's product-draft autosave (or an equivalent) from
// outside any component, has no equivalent storage to patch for the
// theme-preview or collection-image paths, and is a meaningfully rarer
// repro than a popover closing while its parent page stays mounted.

export type UploadKind = "product-image" | "store-theme-image";

export type BackgroundUpload = {
  id: string;
  kind: UploadKind;
  status: "uploading" | "success" | "error";
  /** URL.createObjectURL(file) -- lets the caller show the real image
   *  immediately instead of a spinner, before the real URL exists. Revoked
   *  on success/dismiss. */
  previewUrl: string;
  file: File;
  url: string | null;
  error: string | null;
  /** "product photo" / "theme logo" / "slideshow photo" -- for the toast. */
  label: string;
};

const uploads = new Map<string, BackgroundUpload>();
const listeners = new Set<() => void>();
const doneCallbacks = new Map<string, Set<(u: BackgroundUpload) => void>>();
// Rebuilt only when something actually changes -- useSyncExternalStore
// re-renders on every snapshot call that returns a new reference, so a fresh
// array on every read (even an unrelated one) would loop.
let snapshot: BackgroundUpload[] = [];

function rebuildSnapshot() {
  snapshot = [...uploads.values()];
}

function notify() {
  rebuildSnapshot();
  listeners.forEach((l) => l());
}

export function subscribeBackgroundUploads(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getBackgroundUploadsSnapshot(): BackgroundUpload[] {
  return snapshot;
}

function uploaderFor(kind: UploadKind): (file: File) => Promise<string> {
  return kind === "product-image" ? uploadProductImage : uploadStoreThemeImage;
}

async function run(id: string) {
  const upload = uploads.get(id);
  if (!upload) return;
  uploads.set(id, { ...upload, status: "uploading", error: null });
  notify();
  try {
    const url = await uploaderFor(upload.kind)(upload.file);
    // Re-read rather than trusting the pre-await snapshot: a concurrent
    // dismissBackgroundUpload could have deleted this id while the request
    // was in flight.
    const cur = uploads.get(id);
    if (!cur) return;
    const done: BackgroundUpload = { ...cur, status: "success", url };
    uploads.set(id, done);
    notify();
    doneCallbacks.get(id)?.forEach((cb) => cb(done));
    doneCallbacks.delete(id);
    setTimeout(() => {
      // Only clear if nothing newer happened to this id since (a retry).
      if (uploads.get(id)?.status === "success") {
        URL.revokeObjectURL(done.previewUrl);
        uploads.delete(id);
        notify();
      }
    }, 2500);
  } catch (err) {
    const cur = uploads.get(id);
    if (!cur) return;
    const failed: BackgroundUpload = {
      ...cur,
      status: "error",
      error: err instanceof Error ? err.message : "Couldn't upload that image",
    };
    uploads.set(id, failed);
    notify();
    // Fired, but deliberately NOT deleted here (unlike the success branch) --
    // a retry can still succeed later and needs this same registration to
    // still be listening. Callers that only care about a real URL already
    // no-op on a non-success status; callers that need to know "this is
    // stuck, stop waiting on it" (see ThemePreviewSheet's pendingUploadIds)
    // rely on this firing rather than hanging forever.
    doneCallbacks.get(id)?.forEach((cb) => cb(failed));
  }
}

/** Starts one upload in the background and returns immediately -- the
 *  caller (a popover, a form section) can use the returned previewUrl for an
 *  optimistic local preview right away, and either await the result itself
 *  (if it's confident it'll still be mounted) or register onBackgroundUploadDone
 *  from whichever longer-lived parent actually needs the eventual URL. */
export function startBackgroundUpload(file: File, kind: UploadKind, label: string) {
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const previewUrl = URL.createObjectURL(file);
  uploads.set(id, {
    id,
    kind,
    status: "uploading",
    previewUrl,
    file,
    url: null,
    error: null,
    label,
  });
  notify();
  void run(id);
  return { id, previewUrl };
}

/** Fires `cb` once this upload settles -- immediately, if it already has by
 *  the time this is called (a fast upload racing a slightly-late subscribe).
 *  Returns an unsubscribe function; call it if the caller unmounts first. */
export function onBackgroundUploadDone(id: string, cb: (u: BackgroundUpload) => void): () => void {
  const existing = uploads.get(id);
  if (existing && existing.status !== "uploading") {
    cb(existing);
    return () => {};
  }
  const set = doneCallbacks.get(id) ?? new Set();
  set.add(cb);
  doneCallbacks.set(id, set);
  return () => set.delete(cb);
}

export function retryBackgroundUpload(id: string) {
  if (uploads.has(id)) void run(id);
}

export function dismissBackgroundUpload(id: string) {
  const upload = uploads.get(id);
  if (upload) {
    URL.revokeObjectURL(upload.previewUrl);
    // Told once, explicitly, that this is never coming back -- a caller
    // gating something on "this upload is still pending" (see
    // ThemePreviewSheet's pendingUploadIds) would otherwise stay stuck
    // forever once the seller dismisses instead of retrying.
    doneCallbacks.get(id)?.forEach((cb) => cb({ ...upload, status: "error", error: "Dismissed" }));
  }
  uploads.delete(id);
  doneCallbacks.delete(id);
  notify();
}

/** Whether ANY upload anywhere is still in flight -- a blunt, global check
 *  rather than per-caller tracking, since in practice a seller only ever has
 *  one product form (or theme sheet) open at a time and uploads settle in
 *  seconds. Used to gate a page's own Save so a still-uploading blob:
 *  preview can never reach a database write (see product-save.ts and
 *  full-previews.tsx's handleSave for the pattern this generalizes). */
export function hasPendingUploads(): boolean {
  return [...uploads.values()].some((u) => u.status === "uploading");
}
