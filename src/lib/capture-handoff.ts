// In-memory-only handoff between the camera route and the post-capture edit route.
// Not sessionStorage/localStorage — Blobs can't be stored there directly, and since
// client-side route navigation never reloads the page, a plain module variable
// survives the trip fine. Known limitation: a hard refresh on /create/edit loses
// this — that route falls back to /create if nothing's pending.
export type CapturedMedia = { type: "photo" | "video"; blob: Blob; url: string };

let pending: CapturedMedia | null = null;

export function setPendingCapture(media: CapturedMedia) {
  if (pending) URL.revokeObjectURL(pending.url);
  pending = media;
}

export function takePendingCapture(): CapturedMedia | null {
  const media = pending;
  pending = null;
  return media;
}