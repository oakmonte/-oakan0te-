// Search the sound library.
//
//   GET /api/sounds?genre=lofi&q=piano&offset=0
//   → { tracks: LibraryTrack[], nextOffset: number | null }
//
// Why this is a server route at all, when the Commons API sends
// `Access-Control-Allow-Origin: *` and the browser could call it directly:
//
//  1. Wikimedia asks every automated client to identify itself in a
//     User-Agent, and a browser will not let a page set that header. Being
//     polite to a free service we depend on is worth one hop.
//  2. We ask upstream for fifty results to show ten (see OVERFETCH) — that is
//     a lot of JSON to push down a Nigerian mobile connection so the phone can
//     throw most of it away. Filtering here means the phone receives only what
//     it will draw.
//  3. One place decides what a usable track is. A second provider added later
//     lands beside this and inherits the same rules.
//
// No credentials are involved, and the upstream URL is built entirely from an
// allowlisted genre id plus escaped text — there is no request field that can
// steer where this fetches from.

import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";
import { isLicenceUsable, isUsableTrack } from "@/lib/sound-library";
import { OVERFETCH, buildSearchUrl, parseSearchResponse } from "@/lib/sound-providers/wikimedia";

/** Wikimedia's User-Agent policy asks for a descriptive string with a way to
 *  make contact, so they can reach whoever is responsible before they resort
 *  to blocking. A generic agent is what gets rate-limited first. */
const USER_AGENT = "Oakmonte/1.0 (https://oakmonte.com; support@oakmonte.com) sound-library";

/** Upstream is a third party we don't control; a slow day there must not
 *  become a hung worker here. */
const UPSTREAM_TIMEOUT_MS = 8000;

const MAX_TEXT_LENGTH = 80;

export const Route = createFileRoute("/api/sounds")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // The library is only reachable from the create flow, which is behind
        // sign-in. Keeping the check means this doesn't quietly become a
        // public proxy that anyone can point traffic through in our name.
        const user = await getRequestUser(request);
        if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

        const url = new URL(request.url);
        const genre = url.searchParams.get("genre") ?? undefined;
        const text = (url.searchParams.get("q") ?? "").slice(0, MAX_TEXT_LENGTH);
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

        let payload: unknown;
        try {
          const res = await fetch(buildSearchUrl({ genre, text, offset }), {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          });
          if (!res.ok) {
            console.error("api/sounds: Commons returned", res.status);
            return Response.json({ error: "Couldn't reach the sound library" }, { status: 502 });
          }
          payload = await res.json();
        } catch (error) {
          console.error("api/sounds: Commons request failed", error);
          return Response.json({ error: "Couldn't reach the sound library" }, { status: 502 });
        }

        const tracks = parseSearchResponse(payload).filter(
          (track) => isUsableTrack(track) && isLicenceUsable(track.licence),
        );

        // The offset is upstream's, not ours. We dropped most of that page on
        // the floor, so paging by the number of tracks we returned would skip
        // everything filtered out and show the same few results forever.
        const hasMore = Boolean(
          (payload as { continue?: { gsroffset?: number } })?.continue?.gsroffset,
        );

        return Response.json(
          { tracks, nextOffset: hasMore ? offset + OVERFETCH : null },
          {
            headers: {
              // The catalogue is the same for everyone and barely changes.
              // `private` because the response went through an authenticated
              // request — the caching that matters here is the phone's own,
              // for a seller flicking back and forth between genres.
              "Cache-Control": "private, max-age=300",
            },
          },
        );
      },
    },
  },
});
