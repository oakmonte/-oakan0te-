// Every catalogue the sound picker can draw on.
//
// Adding a provider is meant to be this file plus one module beside it. What a
// provider owes is narrow on purpose: turn our genre vocabulary into its own
// query, and turn its response into `LibraryTrack[]`. It decides nothing about
// what a usable track is, what a licence obliges us to say, or where the bytes
// may be fetched from — those live in sound-library.ts precisely so a second
// source cannot answer them differently from the first.

import type { LibraryTrack, SoundProviderId } from "@/lib/sound-library";
import * as ccmixter from "./ccmixter";
import * as jamendo from "./jamendo";
import * as wikimedia from "./wikimedia";

export type SoundQuery = { genre?: string; text?: string; offset?: number };

export type SoundProvider = {
  id: SoundProviderId;
  buildSearchUrl: (query: SoundQuery) => string;
  parseSearchResponse: (json: unknown) => LibraryTrack[];
  /** How far a page advances the offset for this source. */
  pageSize: number;
  /** Providers needing a key report whether they have one. A provider without
   *  its key is skipped rather than failing the whole search — the picker
   *  should quietly show fewer sources, not break. */
  isConfigured?: () => boolean;
  /** Sent as User-Agent. Wikimedia requires it; the others are merely happier
   *  for it, and a request that identifies itself is easier for them to
   *  whitelist than one that doesn't. */
  userAgent: string;
};

const UA = "Oakmonte/1.0 (https://oakmonte.com; oakmonte.store@gmail.com) sound-library";

export const PROVIDERS: SoundProvider[] = [
  {
    id: "wikimedia",
    buildSearchUrl: wikimedia.buildSearchUrl,
    parseSearchResponse: wikimedia.parseSearchResponse,
    pageSize: wikimedia.OVERFETCH,
    userAgent: UA,
  },
  {
    id: "ccmixter",
    buildSearchUrl: ccmixter.buildSearchUrl,
    parseSearchResponse: ccmixter.parseSearchResponse,
    pageSize: ccmixter.CCMIXTER_PAGE,
    userAgent: UA,
  },
  {
    id: "jamendo",
    buildSearchUrl: jamendo.buildSearchUrl,
    parseSearchResponse: jamendo.parseSearchResponse,
    pageSize: jamendo.JAMENDO_PAGE,
    isConfigured: jamendo.isConfigured,
    userAgent: UA,
  },
];

export function activeProviders(): SoundProvider[] {
  return PROVIDERS.filter((p) => !p.isConfigured || p.isConfigured());
}

/** One list from several, taken a track at a time from each source in turn.
 *
 *  Concatenating instead would put every Commons result above every ccMixter
 *  one, so the seller would have to scroll past a whole catalogue to discover
 *  the second exists — and since the sources differ a lot in character, the
 *  top of the list would misrepresent what the library holds. Round-robin also
 *  degrades well: if one source returns nothing, the list is simply the
 *  others, in their own order. */
export function interleave(lists: LibraryTrack[][]): LibraryTrack[] {
  const out: LibraryTrack[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }
  return out;
}
