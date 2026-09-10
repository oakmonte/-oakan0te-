import type { SoundCredit } from "@/lib/sound-library";
import type { Layer } from "@/lib/after-shot-layers";
import type { CropRect } from "@/lib/crop-rect";
import { NEUTRAL_ADJUST, type PhotoAdjust } from "@/lib/photo-adjust";

// The photo editor's carousel, and how it survives a trip to the publish
// screen.
//
// The type lives here rather than in the route because this file is what
// persists it: a shape that outlives its own screen belongs next to the thing
// that keeps it alive. Same arrangement, and the same reasoning, as
// video-sequence.ts and video-editor-session.ts next door.

/** One image in the carousel, with the whole edit stack that belongs to it.
 *
 *  Nothing here is baked until export — `blob` stays the untouched original
 *  for the life of the session, exactly as the after-shot screen keeps its
 *  capture, so auditioning six filters costs zero generations of re-encode. */
/** How long a clip can be and still count as a live photo.
 *
 *  The number is a judgement, not a constraint: past about this length nobody
 *  reads it as a moving picture any more, they read it as a short video, and
 *  the video editor is the screen for those. */
export const LIVE_MAX_SECONDS = 6;

/** A still, or a live photo: a short silent clip that loops.
 *
 *  A live photo occupies the whole post — it cannot share a carousel with
 *  stills. Mixing the two would mean a post that is sometimes swiped and
 *  sometimes watched, and the feed can only pick one. */
export type PhotoKind = "photo" | "live";

export type CarouselPhoto = {
  id: string;
  kind: PhotoKind;
  blob: Blob;
  url: string;
  /** True when `url` is a remote Supabase URL not yet fetched into a blob.
   *  Export needs real bytes; browsing doesn't. */
  remote: boolean;
  naturalSize: { w: number; h: number } | null;
  aspect: number;
  filterId: string;
  filterIntensity: number;
  crop: CropRect | null;
  adjust: PhotoAdjust;
};

export function newPhotoId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function blankPhotoEdits() {
  return {
    naturalSize: null,
    aspect: 1,
    filterId: "natural",
    filterIntensity: 100,
    crop: null as CropRect | null,
    adjust: NEUTRAL_ADJUST,
  };
}

// ---------------------------------------------------------------------------

/** A sound chosen for the post.
 *
 *  One per post rather than one per photo, which is both what the schema
 *  stores and what anyone actually means by "put a song on this".
 *
 *  It is never mixed into the pixels. The feed plays the track over the post
 *  and leaves the media muted, so choosing a sound costs no re-encode and a
 *  carousel of six photos still exports exactly six times. That is also why
 *  nothing in the export pipeline knows this type exists. */
export type PhotoSound = {
  /** Real bytes when the track came off the device. Null while it is still
   *  only a remote URL — a draft reopened with a sound already on it — in
   *  which case Next fetches it before handing it to publish. */
  blob: Blob | null;
  url: string;
  name: string;
  /** Set when the track came from the sound library rather than the seller's
   *  own device. Two things follow from it: `url` points at the provider
   *  rather than at us, so the bytes are fetched server-side at publish; and
   *  the credit has to reach the post, because for a CC BY track the licence
   *  only holds while the artist is named. */
  credit?: SoundCredit | null;
};

export type PhotoEditorSession = {
  photos: CarouselPhoto[];
  layersByPhoto: Record<string, Layer[]>;
  activeId: string | null;
  sound: PhotoSound | null;
  /** Object URLs the editor created. Ownership moves here so they outlive the
   *  unmount — see the note in the editor about StrictMode. */
  ownedUrls: string[];
};

let parked: PhotoEditorSession | null = null;

/** Park a session, freeing only what the new one no longer references.
 *
 *  The diff matters: replacing a parked session happens with the SAME object
 *  URLs in it, so a blanket discard would revoke the blobs the incoming
 *  session is built on and leave every photo broken. */
export function parkPhotoEditorSession(session: PhotoEditorSession) {
  if (parked && parked !== session) {
    const keep = new Set(session.ownedUrls);
    parked.ownedUrls.forEach((url) => {
      if (!keep.has(url)) URL.revokeObjectURL(url);
    });
  }
  parked = session;
}

export function takePhotoEditorSession(): PhotoEditorSession | null {
  const session = parked;
  parked = null;
  return session;
}

/** Throw the parked carousel away and free its blobs — the post was sent, or
 *  the user backed out of the editor on purpose. */
export function discardPhotoEditorSession() {
  if (!parked) return;
  parked.ownedUrls.forEach((url) => URL.revokeObjectURL(url));
  parked = null;
}
