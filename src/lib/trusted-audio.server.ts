// Fetching a catalogue track, server-side.
//
// Two routes need this and they must not drift: `api.posts` copies a track
// into our storage when a post is published, and `api.sound-file` streams one
// to the phone so the video editor can mix it into an MP4. If one of them
// grew a weaker check than the other, the weaker one would be the one that
// matters — so the check lives here, once.
//
// `.server.ts` is load-bearing: this is server-only by TanStack Start
// convention, and nothing here should ever be reachable from a client bundle.

import { isTrustedAudioSource } from "@/lib/sound-library";

/** Ceiling for a single track, applied twice — once to the declared length and
 *  again to what actually arrived. Twelve minutes of MP3 sits well inside it. */
export const MAX_AUDIO_BYTES = 30 * 1024 * 1024;

const UA = "Oakmonte/1.0 (https://oakmonte.com; oakmonte.store@gmail.com) sound-library";

export type TrustedAudio = { blob: Blob; type: string; size: number };

/** Pull a catalogue track from its provider, so the phone doesn't have to.
 *
 *  The seller's browser sends a URL instead of 3-5 MB of MP3 it would have had
 *  to download first — see the note on `isTrustedAudioSource`, which is also
 *  what stops this being a request-controlled fetch of anything on the
 *  network.
 *
 *  Returns null on anything unexpected rather than throwing. Callers differ on
 *  what that should mean — a post still goes out without its music, a sound
 *  the seller is waiting on has to say so — so the decision is theirs.
 *
 *  `extraHosts` is for our own CDN: a track already copied into storage is
 *  fetched back by the same path when a draft is reopened. */
export async function fetchTrustedAudio(
  url: string,
  extraHosts: string[] = [],
): Promise<TrustedAudio | null> {
  if (!isTrustedAudioSource(url, extraHosts)) {
    console.error("trusted-audio: refused source", url);
    return null;
  }
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(15_000),
      // The allowlist above checked the URL we were given. It says nothing
      // about where a redirect would take us, and `follow` — the default —
      // would obediently go there, which quietly turns the check into no check
      // at all. No current host redirects off-site; that is a property of
      // today's hosts rather than of this code, and it stops being true the
      // moment another provider is added.
      redirect: "manual",
    });
    if (!res.ok) return null;

    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!type.startsWith("audio/")) return null;

    // Required, not merely respected. Absent reads as 0 and malformed reads as
    // NaN, and waving either through to `.blob()` buffers the whole body into
    // the worker before any size is known. Every host we use sends it on
    // static files, so demanding it costs nothing and closes the case where a
    // chunked response gets to decide our memory ceiling.
    const declared = Number(res.headers.get("content-length"));
    if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_AUDIO_BYTES) return null;

    // Still checked again after reading: the header is a claim, `blob.size` is
    // the fact, and a response is free to lie about the former.
    const blob = await res.blob();
    if (blob.size === 0 || blob.size > MAX_AUDIO_BYTES) return null;
    return { blob, type, size: blob.size };
  } catch (error) {
    console.error("trusted-audio: could not fetch library track", error);
    return null;
  }
}
