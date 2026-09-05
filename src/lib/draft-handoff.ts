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
