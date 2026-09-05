import type { Layer } from "@/lib/after-shot-layers";
import type { Clip, ProjectRatio } from "@/lib/video-sequence";

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

export type VideoEditorSession = {
  clips: Clip[];
  layersByClip: Record<string, Layer[]>;
  ratio: ProjectRatio;
  time: number;
  /** The added music track, if any. A File, so it needs no URL of its own. */
  music: { file: File; name: string; volume: number } | null;
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
}
