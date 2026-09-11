// What the phone shows about us on the lock screen.
//
// Playing audio registers the page with the OS, which then draws a "now
// playing" card — lock screen and Control Centre on iOS, the notification
// shade on Android, the toolbar button in desktop Chrome. **That card cannot
// be removed.** No web API hides it, and every site with sound gets one. What
// this file does is decide what it SAYS and, as far as the platform allows,
// which buttons it offers.
//
// This is the counterpart to the attributes on the elements themselves. The
// two surfaces are different problems with different answers:
//
//   in the page   — `disablePictureInPicture`, `disableRemotePlayback` and no
//                   `controls`. Fully under our control; the result is bare
//                   media with nothing drawn on it.
//   outside it    — this file. Shapeable, never removable.
//
// Skip buttons in particular: a browser offers `nexttrack` / `previoustrack`
// only when a handler is registered for them, so NOT registering one is how
// they stay off the card — which is why nothing here sets them and why the
// unregistering below is explicit rather than assumed. Seek buttons are the
// platform's own call; Chrome derives them from the media element and there is
// no way to decline. Expect a card with play/pause and possibly a scrubber.

type NowPlaying = {
  /** Whatever the viewer would call this — a track title, or the post. */
  title: string;
  artist?: string | null;
  artworkUrl?: string | null;
};

/** Who currently owns the session.
 *
 *  The session is global to the document but the feed is a column of cards,
 *  each with its own audio and its own effects. Scrolling runs the incoming
 *  card's claim and the outgoing card's release in an order neither one
 *  controls, so a release that did not check would routinely wipe the metadata
 *  the next card had just set — the lock screen going blank a beat after a
 *  scroll, intermittently, which is exactly the sort of bug nobody can
 *  reproduce on demand. */
let owner: string | null = null;

/** Buttons we decline to offer.
 *
 *  These are already null on a fresh session; setting them is for the case
 *  where something else set them earlier and for the benefit of whoever reads
 *  this next, since "no skip buttons" is a decision rather than an oversight. */
const DECLINED = ["nexttrack", "previoustrack", "seekforward", "seekbackward"] as const;

export function claimMediaSession(id: string, now: NowPlaying): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const session = navigator.mediaSession;
  owner = id;
  try {
    session.metadata = new MediaMetadata({
      title: now.title,
      artist: now.artist ?? undefined,
      artwork: now.artworkUrl ? [{ src: now.artworkUrl }] : undefined,
    });
    session.playbackState = "playing";
    for (const action of DECLINED) {
      // Safari throws NotSupportedError for actions it does not implement
      // rather than ignoring them, so each one is caught on its own — a throw
      // on the first would skip the rest.
      try {
        session.setActionHandler(action, null);
      } catch {
        /* platform does not know this action; nothing to decline */
      }
    }
  } catch (error) {
    // Metadata is a nicety. A browser that rejects it must not take the
    // playback that triggered it down as well.
    console.error("media-session: could not set now-playing", error);
  }
}

/** Give the card up, but only if it is still ours — see `owner`. */
export function releaseMediaSession(id: string): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  if (owner !== id) return;
  owner = null;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  } catch (error) {
    console.error("media-session: could not clear now-playing", error);
  }
}
