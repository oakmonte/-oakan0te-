// In-memory-only handoff between the camera route and the post-capture edit route.
// Not sessionStorage/localStorage — Blobs can't be stored there directly, and since
// client-side route navigation never reloads the page, a plain module variable
// survives the trip fine. Known limitation: a hard refresh on /create/edit loses
// this — that route falls back to /create if nothing's pending.
import type { SoundCredit } from "@/lib/sound-library";

/** The screen publish should return to.
 *
 *  Set by producers that hand straight to publish WITHOUT passing through the
 *  after-shot editor. The camera still routes via after-shot, so for it back
 *  means after-shot and the field stays unset. Add a value here only when a
 *  new screen genuinely skips that step, or back will send people to a screen
 *  they were never on. */
export type CaptureOrigin = "video-editor" | "photo-editor";

/** One extra carousel item, beyond the cover. */
export type ExtraMedia = { type: "photo" | "video"; blob: Blob; url: string };

/** A sound to play over the finished post.
 *
 *  Uploaded beside the media, not mixed into it: the feed plays this and
 *  leaves the media muted, which is what lets a photo carousel carry a song
 *  without any of it becoming a video. Posts from the video editor leave this
 *  unset — that screen bakes its music into the MP4 itself. */
export type CaptureAudio = {
  /** Bytes when the seller supplied the track. Null for a library track,
   *  whose `url` the server fetches instead — see `isTrustedAudioSource`. */
  blob: Blob | null;
  url: string;
  name: string;
  /** Provenance, for a library track. Null for one off the device, which owes
   *  nobody a credit. */
  credit?: SoundCredit | null;
};

/** "my-song (1).mp3" → "my-song (1)".
 *
 *  Lives here rather than in either editor because both of them produce a
 *  `CaptureAudio` and a track should not be named one way depending on which
 *  screen you picked it from. */
export function soundLabel(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  if (!base) return "Sound";
  return base.length > 28 ? `${base.slice(0, 27)}…` : base;
}

export type CapturedMedia = {
  type: "photo" | "video";
  blob: Blob;
  url: string;
  origin?: CaptureOrigin;
  /** Items 1..n of a carousel. The fields above stay the COVER, so every
   *  screen that only cares about one image — the publish thumbnail, the
   *  after-shot editor — keeps reading exactly what it always did, and only
   *  the upload has to know a post can be more than one thing. */
  extra?: ExtraMedia[];
  /** The post's sound, if one was chosen. */
  audio?: CaptureAudio;
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
