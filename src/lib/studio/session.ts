// The studio's edit, parked in memory while the seller is on the publish
// screen (or anywhere else) after "New video".
//
// Without this, tapping Next and backing out of publish would land on an
// empty editor with the whole edit gone. Same technique as capture-handoff.ts
// and video-editor-session.ts: client-side navigation never reloads the page,
// so a module variable survives the trip, where a Blob could never go into
// sessionStorage.
//
// The object URLs come with it. The studio revokes what it owns on unmount,
// which would leave a parked session pointing at dead blobs, so ownership
// transfers here instead and only `discardStudioSession` frees them.

import type { SoundCredit } from "@/lib/sound-library";
import type { SourceMap, StudioProject } from "./types";

export type StudioSession = {
  project: StudioProject;
  sources: SourceMap;
  /** Every object URL the edit uses — sources and stickers. */
  ownedUrls: string[];
  /** Credit for music already inside a reopened draft's video. There is no
   *  file to go with it; it can only be carried. */
  inheritedCredit: SoundCredit | null;
};

let parked: StudioSession | null = null;

/** Park a session, freeing only what the new one no longer references — the
 *  same URLs are parked again on every visit, and revoking them wholesale
 *  would kill the blobs the incoming session is built on. */
export function parkStudioSession(session: StudioSession) {
  if (parked && parked !== session) {
    const keep = new Set(session.ownedUrls);
    for (const url of parked.ownedUrls) if (!keep.has(url)) URL.revokeObjectURL(url);
  }
  parked = session;
}

/** Hand the parked session back, clearing it. The caller now owns the URLs. */
export function takeStudioSession(): StudioSession | null {
  const session = parked;
  parked = null;
  return session;
}

/** Throw the parked edit away and free its blobs: the post went out, or the
 *  seller backed out of the edit on purpose. */
export function discardStudioSession() {
  if (!parked) return;
  for (const url of parked.ownedUrls) URL.revokeObjectURL(url);
  parked = null;
}
