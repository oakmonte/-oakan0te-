import { authedFetch } from "@/lib/authed-fetch";
import type { LibraryTrack } from "@/lib/sound-library";

/** A catalogue track's actual bytes, for an editor that mixes it into the
 *  video.
 *
 *  Most screens that pick a sound keep it as a URL and let the server copy it
 *  at publish. An editor that MIXES the sound into the MP4 can't: the mixer's
 *  `OfflineAudioContext` cannot decode a URL the page isn't allowed to read,
 *  and the browser is not permitted to reach the catalogue hosts directly —
 *  on purpose. So the file comes down through `/api/sound-file`, the same
 *  allowlisted server-side fetch the publish path uses.
 *
 *  The access stamp travels with the track from `/api/sounds`. Without it the
 *  proxy refuses — it only serves URLs the catalogue issued, so a track
 *  assembled anywhere else cannot be laundered through it. */
export async function fetchLibraryTrack(track: LibraryTrack): Promise<File> {
  const query = new URLSearchParams({ url: track.streamUrl });
  if (track.access) {
    query.set("sig", track.access.sig);
    query.set("exp", String(track.access.exp));
  }
  const res = await authedFetch(`/api/sound-file?${query.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn't load that sound");
  }
  const blob = await res.blob();
  // A name for the decoder, not for the seller — the credit is what the post
  // shows. The extension keeps `decodeAudioData` from having to guess.
  return new File([blob], "track.mp3", { type: blob.type || "audio/mpeg" });
}
