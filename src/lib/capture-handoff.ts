// In-memory-only handoff between the camera route and the post-capture edit route.
// Not sessionStorage/localStorage — Blobs can't be stored there directly, and since
// client-side route navigation never reloads the page, a plain module variable
// survives the trip fine. Known limitation: a hard refresh on /create/edit loses
// this — that route falls back to /create if nothing's pending.
/** The screen publish should return to.
 *
 *  Only set by producers that hand straight to publish WITHOUT passing through
 *  the after-shot editor — which today is the video editor alone. The camera
 *  and the photo editor both route via after-shot, so for them back means
 *  after-shot and the field stays unset. Add a value here only when a new
 *  screen genuinely skips that step, or back will send people to a screen they
 *  were never on. */
export type CaptureOrigin = "video-editor";

export type CapturedMedia = {
  type: "photo" | "video";
  blob: Blob;
  url: string;
  origin?: CaptureOrigin;
  /** Chosen listing thumbnail, set by the studio's Cover tool. A video has no
   *  single obvious still, and the marketplace needs one — so whoever composes
   *  the post reads this instead of grabbing frame zero. */
  poster?: { blob: Blob; url: string };
};

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
