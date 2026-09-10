// A draft the user tapped, on its way into an editor.
//
// Same in-memory technique as capture-handoff.ts: client-side navigation never
// reloads the page, so a module variable survives the trip. This one is only a
// URL and a kind, so it could have gone in the route's search params — it
// doesn't, because a media URL in the address bar is a signed storage link
// sitting in history and in any referrer the page later sends.
//
// The editor re-adds the draft through its own normal "add media" path rather
// than being handed a ready-made clip. That is what keeps duration, poster and
// filmstrip extraction working: they belong to that path, and a shortcut
// around it would arrive with none of them.

export type PendingDraft = {
  /** The draft's stored media. Remote, so the editor treats it as a URL until
   *  export actually needs the bytes. */
  url: string;
  kind: "photo" | "video";
  /** The posts row this came from. Held so a future "update this draft rather
   *  than make a new one" has the id it needs; nothing reads it yet. */
  postId: string;
  /** The draft's own poster, when it has one — saves the editor grabbing a
   *  frame off a remote file, which CORS may not allow. */
  thumbnailUrl: string | null;
  /** The sound saved with the draft, so reopening it doesn't silently drop
   *  the track. Remote — the editor keeps it as a URL and only fetches the
   *  bytes if the draft is posted. */
  audioUrl?: string | null;
  audioName?: string | null;
  /** A draft made with a catalogue track still owes that track's credit, so
   *  it has to survive the round trip. Without this, saving a draft and
   *  republishing it would quietly strip the artist's name off a post that is
   *  only licensed while the name is there. */
  audioAttribution?: string | null;
  audioLicence?: string | null;
  audioSourceUrl?: string | null;
};

let pending: PendingDraft | null = null;

export function setPendingDraft(draft: PendingDraft) {
  pending = draft;
}

export function takePendingDraft(): PendingDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}
