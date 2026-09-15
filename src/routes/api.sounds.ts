// Search the sound library.
//
//   GET /api/sounds?genre=lofi&q=piano&offset=0
//   → { tracks: LibraryTrack[], nextOffset: number | null, sources: string[] }
//
// It searches every configured catalogue at once and returns one merged list —
// a seller wants a song, not a source, so which archive a track came from is
// our problem rather than a choice to put in front of them.
//
// Why this is a server route at all, when Commons would let the browser call
// it directly:
//
//  1. Wikimedia asks every automated client to identify itself in a
//     User-Agent, and a browser will not let a page set that header. Being
//     polite to a free service we depend on is worth one hop.
//  2. Jamendo needs a key, and a key in the browser is a public key.
//  3. Each source is over-fetched and then mostly discarded — that is a lot of
//     JSON to push down a Nigerian mobile connection so the phone can throw it
//     away. Filtering here means the phone receives only what it will draw.
//  4. One place decides what a usable track is, so a second source cannot
//     answer that differently from the first.
//
// The upstream URLs are built entirely from an allowlisted genre id plus
// escaped text — no request field can steer where this fetches from.

import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";
import { type LibraryTrack, isLicenceUsable, isUsableTrack } from "@/lib/sound-library";
import { activeProviders, interleave } from "@/lib/sound-providers";

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

        const providers = activeProviders();

        // All sources at once, and one slow or broken source must not take the
        // others down with it — hence allSettled and a per-request timeout
        // rather than a single await chain.
        const settled = await Promise.allSettled(
          providers.map(async (provider) => {
            const res = await fetch(provider.buildSearchUrl({ genre, text, offset }), {
              headers: { "User-Agent": provider.userAgent, Accept: "application/json" },
              signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            });
            if (!res.ok) throw new Error(`${provider.id} returned ${res.status}`);
            return provider.parseSearchResponse(await res.json());
          }),
        );

        const lists: LibraryTrack[][] = [];
        const reachedIds: string[] = [];
        settled.forEach((result, i) => {
          if (result.status === "rejected") {
            console.error("api/sounds:", providers[i].id, "failed", result.reason);
            return;
          }
          reachedIds.push(providers[i].id);
          lists.push(
            result.value.filter((track) => isUsableTrack(track) && isLicenceUsable(track.licence)),
          );
        });

        // Only an error when *nothing* answered. One source being down should
        // cost the seller some choices, not the feature.
        if (reachedIds.length === 0) {
          return Response.json({ error: "Couldn't reach the sound library" }, { status: 502 });
        }

        const merged = interleave(lists);

        // Stamp each track AFTER the filters above. The stamp is what
        // `/api/sound-file` checks before it will fetch anything, so it has to
        // mean "this URL passed `isUsableTrack` and `isLicenceUsable`" — which
        // it only does if nothing is signed before those have run.
        const { signTrackUrl } = await import("@/lib/sound-url-signature.server");
        const tracks = await Promise.all(
          merged.map(async (track) => {
            const access = await signTrackUrl(track.streamUrl);
            return access ? { ...track, access } : track;
          }),
        );

        // The offset is upstream's, not ours. Most of each page is dropped by
        // the filters, so paging by the number of tracks returned would skip
        // everything filtered out and show the same few results forever. One
        // offset drives every source: they page at different rates, so this is
        // approximate by construction, and "roughly a page further into each
        // catalogue" is exactly what the seller means by scrolling.
        const step = Math.min(...providers.map((p) => p.pageSize));
        const nextOffset = tracks.length > 0 ? offset + step : null;

        return Response.json(
          // `sources` is diagnostic. A provider that needs a key drops out of
          // `activeProviders()` when the key is missing, and the only symptom
          // is a slightly thinner list — indistinguishable from a quiet day
          // upstream. Naming the catalogues that answered turns "is Jamendo
          // configured on this deployment?" into something readable off the
          // response. Absent still means either unconfigured or failing; the
          // server log above tells those two apart. It exposes nothing — these
          // are the names of public archives, not the key.
          { tracks, nextOffset, sources: reachedIds },
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
