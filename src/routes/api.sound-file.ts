// Stream one catalogue track to the phone.
//
//   GET /api/sound-file?url=<a track's streamUrl>
//   → the audio bytes, or JSON { error } on anything else
//
// Every other screen keeps a track as a *reference*: the post stores the URL
// and the server copies the bytes at publish, so a seller on mobile data never
// downloads a song only to upload it again. The video editor cannot work that
// way. It mixes the music into the MP4 itself, which means the bytes have to
// be in the browser before the export runs.
//
// Why proxy instead of letting the page fetch the provider directly:
//
//  1. CORS. Commons sends permissive headers; Jamendo's storage and ccMixter
//     are not ours to depend on, and "works for two of three catalogues" is
//     a bug that only shows up for whichever seller picked the third.
//  2. The allowlist. `fetchTrustedAudio` is the one thing standing between a
//     `url` parameter and an arbitrary fetch, and it only exists server-side.
//  3. One User-Agent. Wikimedia asks automated clients to identify themselves
//     and a browser will not let a page set that header.
//
// This is deliberately NOT a general-purpose proxy: the allowlist is by exact
// hostname, https only, no ports, redirects unfollowed.

import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";

/** Tracks one seller may pull per window. Picking a track, changing your mind
 *  and picking again is normal; twelve in a minute is not a person editing. */
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 60_000;

const recent = new Map<string, number[]>();

/** Per-user rate limit, held in the isolate's memory.
 *
 *  Honest about what that is worth: serverless means several isolates, each
 *  with its own map, and a cold start forgets everything. So this is a brake
 *  on a loop rather than a guarantee — the real ceiling for a determined
 *  abuser is however many isolates they can spread across. It costs nothing
 *  and removes the trivial case; a real limit needs shared state, which is a
 *  Durable Object or a table, and is worth building when there is traffic to
 *  justify it rather than now. */
function allow(userId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(userId, hits);
  // The map would otherwise grow one entry per user for the isolate's life.
  if (recent.size > 500) {
    for (const [key, times] of recent) {
      if (times.every((t) => now - t >= RATE_WINDOW_MS)) recent.delete(key);
    }
  }
  return hits.length <= RATE_LIMIT;
}

export const Route = createFileRoute("/api/sound-file")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Same gate as the catalogue itself. Without it this is an open relay
        // that anyone can push traffic through in our name — and it is the
        // relay, not the catalogue, that would carry the bandwidth.
        const user = await getRequestUser(request);
        if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

        const params = new URL(request.url).searchParams;
        const source = params.get("url");
        const sig = params.get("sig") ?? "";
        const exp = Number(params.get("exp"));
        if (!source) return Response.json({ error: "Missing url" }, { status: 400 });

        // One track is a few megabytes of our egress under a User-Agent that
        // names us to Wikimedia. Signing up is free, so the auth gate alone
        // bounds who can spend it but not how much.
        if (!allow(user.id)) {
          return Response.json({ error: "Too many sounds, too fast" }, { status: 429 });
        }

        // The allowlist says the host is one we fetch from; the signature says
        // this exact URL is one the catalogue offered, having already passed
        // `isUsableTrack` and `isLicenceUsable`. Without it an allowlisted host
        // is enough to pull a track the picker filtered out on licence grounds.
        const { verifyTrackUrl } = await import("@/lib/sound-url-signature.server");
        if (!(await verifyTrackUrl(source, sig, exp))) {
          return Response.json({ error: "That sound link has expired" }, { status: 403 });
        }

        const { fetchTrustedAudio } = await import("@/lib/trusted-audio.server");
        // Our own CDN counts as trusted here too, so reopening a draft whose
        // track is already in storage takes the same path as picking a new one.
        const pullZone = process.env.BUNNY_PULL_ZONE_HOSTNAME ?? "";
        const audio = await fetchTrustedAudio(source, pullZone ? [pullZone] : []);

        // Deliberately not distinguishing "not on the allowlist" from "the
        // provider was down". The caller can do nothing different about either,
        // and the difference is only interesting to whoever is probing.
        if (!audio) {
          return Response.json({ error: "Couldn't load that sound" }, { status: 502 });
        }

        return new Response(audio.blob, {
          headers: {
            "Content-Type": audio.type,
            "Content-Length": String(audio.size),
            // The catalogue barely changes and the seller is about to scrub
            // back and forth over this track while they edit. `private`
            // because it came through an authenticated request.
            "Cache-Control": "private, max-age=3600",
            // It is audio, and it is not ours to let anything sniff into
            // something else.
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
