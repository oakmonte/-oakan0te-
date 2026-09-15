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
 *  Normally uploaded beside the media, not mixed into it: the feed plays this
 *  and leaves the media muted, which is what lets a photo carousel carry a
 *  song without any of it becoming a video.
 *
 *  The video editor is the exception. It mixes the track into the MP4 during
 *  export, so it sets `bakedIn` and carries nothing but the credit — see the
 *  field's own note for why the credit still has to travel. */
export type CaptureAudio = {
  /** Always null today: every track comes from the catalogue, and a catalogue
   *  track travels as a `url` the server fetches — see `isTrustedAudioSource`.
   *
   *  The field stays because the *upload* path is what a recorded voiceover
   *  would use, and that is the one form of seller-supplied audio that can't
   *  infringe anything. Removing the type would mean rebuilding that path from
   *  both ends the day it's wanted. Nothing currently sets it. */
  blob: Blob | null;
  /** Empty string when `bakedIn`: there is no separate file to play, so there
   *  is nothing to point an `<audio>` at. */
  url: string;
  name: string;
  /** Provenance. Null only when the licence asks for no credit — a CC0 or
   *  public-domain track. */
  credit?: SoundCredit | null;
  /** The track is already inside the media (the video editor mixed it into the
   *  MP4). Nothing extra is uploaded and the feed plays no second source — but
   *  the post is still playing that track, so the credit travels anyway. A row
   *  that carries the music and not the attribution is the licence breach; the
   *  missing file is not. */
  bakedIn?: boolean;
};

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
