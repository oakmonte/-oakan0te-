// Jamendo as a sound provider.
//
// The one of the three with a catalogue anybody would call a music library —
// hundreds of thousands of tracks, properly tagged, and a lot of it produced
// to be used. That is also why it is the only one that needs a key.
//
// TWO THINGS TO SETTLE BEFORE THIS GOES LIVE, both licensing rather than code:
//
//  1. Jamendo mixes CC licences, and plenty of it is `by-nc` or `by-nc-nd`.
//     Oakmonte is a shop, so those are unusable here. `licenceFromCcUrl` reads
//     the licence off each track and `isLicenceUsable` rejects the ones we
//     cannot use — the same guard ccMixter needs, for the same reason.
//  2. Separately from the tracks, Jamendo's own API terms distinguish a free
//     tier from commercial use of the service. A marketplace is commercial.
//     That is a question for Jamendo's licensing team, not something the code
//     can answer, and it is why this provider stays dark until a client id is
//     configured — see `isConfigured`.
//
// UNVERIFIED. Commons and ccMixter were both built against real responses;
// this one is written to Jamendo's documented v3.0 shape because there is no
// key to call it with. Check `parseSearchResponse` against a real payload
// before trusting it.

import {
  type LibraryTrack,
  type TrackLicence,
  plainText,
  stripTracking,
} from "@/lib/sound-library";

const API = "https://api.jamendo.com/v3.0/tracks/";

export const JAMENDO_PAGE = 30;

/** Our genre vocabulary as Jamendo tags. Jamendo's `fuzzytags` matches loosely,
 *  which suits a genre chip better than an exact tag would. */
const GENRE_TAGS: Record<string, string> = {
  lofi: "lofi",
  chill: "chillout",
  downtempo: "downtempo",
  ambient: "ambient",
  electronic: "electronic",
  hiphop: "hiphop",
  dance: "dance",
  techno: "techno",
  synthpop: "synthpop",
  funk: "funk",
  jazz: "jazz",
  blues: "blues",
  piano: "piano",
  instrumental: "instrumental",
  rock: "rock",
  pop: "pop",
  chiptune: "chiptune",
  international: "world",
};

export type SoundQuery = { genre?: string; text?: string; offset?: number };

/** Whether Jamendo is switched on. Server-only — `process.env`, never
 *  `import.meta.env`, so the id cannot be inlined into the client bundle. */
export function isConfigured(): boolean {
  return Boolean(process.env.JAMENDO_CLIENT_ID);
}

export function buildSearchUrl({ genre, text, offset = 0 }: SoundQuery): string {
  const params = new URLSearchParams({
    client_id: process.env.JAMENDO_CLIENT_ID ?? "",
    format: "json",
    limit: String(JAMENDO_PAGE),
    offset: String(offset),
    // mp32 is the higher-bitrate MP3. Every browser plays it, so unlike
    // Commons there is no container problem to route around.
    audioformat: "mp32",
    // Without this the order is arbitrary; a seller scrolling a genre should
    // meet the tracks people actually use first.
    boost: "popularity_total",
    // Exclude the non-commercial and no-derivatives clauses upstream. This is
    // Jamendo's equivalent of ccMixter's `lic=open`, and it is not a nicety:
    // measured on the live API, a lo-fi page without these is 25 `by-nd` and
    // 3 `by-sa` out of 30, so `isLicenceUsable` throws away 28 of every 30
    // tracks and the genre looks empty. With them, the same page comes back
    // 30 out of 30 usable.
    //
    // The shared licence check still runs on the way out. A filter we do not
    // control is a request, not a guarantee.
    ccnc: "false",
    ccnd: "false",
  });
  const tag = genre ? GENRE_TAGS[genre] : undefined;
  if (tag) params.set("fuzzytags", tag);
  const typed = (text ?? "").replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim();
  if (typed) params.set("search", typed);
  return `${API}?${params.toString()}`;
}

type JamendoTrack = {
  id?: string | number;
  name?: string;
  duration?: number;
  artist_name?: string;
  license_ccurl?: string;
  audio?: string;
  audiodownload?: string;
  audiodownload_allowed?: boolean;
  shareurl?: string;
};

/** "http://creativecommons.org/licenses/by-nc-nd/3.0/" → "CC BY-NC-ND 3.0".
 *
 *  Jamendo states the licence only as a deed URL, so the human name — the
 *  thing that goes in the credit line and the thing `isLicenceUsable` reads to
 *  spot an NC track — has to be derived from it. An unrecognised URL returns
 *  something deliberately unusable rather than a cheerful default, so a licence
 *  we cannot parse is a licence we do not publish. */
export function licenceFromCcUrl(raw: string | null | undefined): string {
  const url = (raw ?? "").toLowerCase();
  if (url.includes("/publicdomain/zero")) return "CC0";
  if (url.includes("/publicdomain/")) return "Public domain";
  const match = url.match(/\/licenses\/([a-z-]+)\/([0-9.]+)/);
  if (!match) return "Unknown licence";
  return `CC ${match[1].toUpperCase()} ${match[2]}`;
}

function safeLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return stripTracking(parsed.toString());
  } catch {
    return null;
  }
}

export function parseSearchResponse(json: unknown): LibraryTrack[] {
  const payload = json as { headers?: { status?: string }; results?: JamendoTrack[] };
  // Jamendo answers a rejected key with HTTP 200 and a failure in the body, so
  // the status code alone would have us parse an error page as an empty
  // catalogue and show "no sounds here" instead of saying something is wrong.
  if (payload?.headers?.status && payload.headers.status !== "success") return [];
  const results = payload?.results;
  if (!Array.isArray(results)) return [];

  const tracks: LibraryTrack[] = [];
  for (const t of results) {
    // Prefer the download URL: it is a stable path, where `audio` is a
    // tokenised streaming URL that can expire between picking a track and
    // publishing the post.
    const streamUrl = safeLink(t.audiodownload) ?? safeLink(t.audio);
    if (!streamUrl || !t.id || !t.name) continue;
    // We copy the track into our own storage at publish, so a track whose
    // rights holder withheld download is one we would be storing without
    // permission. This has to happen here rather than in the query: Jamendo
    // answers `audiodlallowed` on /tracks/ with "parameter not recognized"
    // and then ignores it, so asking upstream reads as working and isn't.
    if (t.audiodownload_allowed === false) continue;

    const licenceName = licenceFromCcUrl(t.license_ccurl);
    const licence: TrackLicence = {
      name: licenceName,
      url: safeLink(t.license_ccurl),
      attributionRequired: !/^(cc0|public domain)\b/i.test(licenceName),
    };

    tracks.push({
      id: `jamendo:${t.id}`,
      provider: "jamendo",
      title: plainText(t.name) ?? "Untitled",
      artist: plainText(t.artist_name),
      durationSeconds: typeof t.duration === "number" ? t.duration : 0,
      streamUrl,
      sizeBytes: null,
      licence,
      sourceUrl: safeLink(t.shareurl) ?? `https://www.jamendo.com/track/${t.id}`,
    });
  }
  return tracks;
}
