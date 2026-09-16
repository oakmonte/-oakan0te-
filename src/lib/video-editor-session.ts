import type { Layer } from "@/lib/after-shot-layers";
import type { Clip, ProjectRatio } from "@/lib/video-sequence";
import type { SoundCredit } from "@/lib/sound-library";
import { BlobManager } from "./blob-manager";

// The video editor's timeline, parked in memory while the user is on the
// publish screen.
//
// Without this, tapping Next and then backing out of publish would drop you
// into an empty editor with the whole edit gone — a photo carousel can be
// rebuilt in seconds, but a trimmed, split, captioned six-clip sequence
// cannot. Same technique as capture-handoff.ts, and for the same reason:
// client-side navigation never reloads the page, so a module variable
// survives the trip while a Blob could never go into sessionStorage anyway.
//
// The object URLs come with it. The editor revokes what it owns on unmount,
// which would leave a parked session pointing at dead blobs, so ownership
// transfers here instead and only `discardVideoEditorSession` frees them.

/** One music track on the timeline, with the provenance it has to keep. */
export type EditorMusic = {
  file: File;
  name: string;
  volume: number;
  credit: SoundCredit;
};

export type VideoEditorSession = {
  clips: Clip[];
  layersByClip: Record<string, Layer[]>;
  ratio: ProjectRatio;
  time: number;
  /** The added music track, if any. A File, so it needs no URL of its own.
   *
   *  `credit` rides with it because the export mixes the track into the MP4:
   *  after that there is nothing in the file to recover the attribution from,
   *  so parking the music without its credit would lose a licence condition
   *  every time someone backed out of the editor and came back. */
  music: EditorMusic | null;
  /** A credit for music already welded into one of the clips, carried in from
   *  a reopened draft. There is no file to go with it — the track cannot be
   *  removed, re-mixed or even heard separately, only credited. Parked with
   *  the rest so backing out of publish doesn't quietly drop a licence
   *  condition. */
  inheritedCredit: SoundCredit | null;
  inheritedName: string | null;
  /** Object URLs the editor created. Held so they outlive the unmount. */
  ownedUrls: string[];
};

let parked: VideoEditorSession | null = null;

/** Park a session, freeing only what the new one no longer references.
 *
 *  The diff is load-bearing. Replacing a parked session happens with the SAME
 *  object URLs in it — the editor parks on the way to publish and again on
 *  unmount — so a blanket discard here would revoke the blobs the incoming
 *  session is built on and leave every clip unplayable. */
export function parkVideoEditorSession(session: VideoEditorSession) {
  if (parked && parked !== session) {
    const keep = new Set(session.ownedUrls);
    parked.ownedUrls.forEach((url) => {
      if (!keep.has(url)) URL.revokeObjectURL(url);
    });
  }
  parked = session;
}

/** Hand the parked session back, clearing it. The caller now owns the URLs. */
export function takeVideoEditorSession(): VideoEditorSession | null {
  const session = parked;
  parked = null;
  return session;
}

export function hasVideoEditorSession(): boolean {
  return parked !== null;
}

/** Throw the parked edit away and free its blobs. Called when the post is
 *  actually sent, and when the user backs out of the editor on purpose —
 *  anything that means "this edit is finished with". */
export function discardVideoEditorSession() {
  if (!parked) return;
  parked.ownedUrls.forEach((url) => URL.revokeObjectURL(url));
  parked = null;

  // Clear memory
  BlobManager.revokeAll();
}
