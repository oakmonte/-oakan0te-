// Wikimedia Commons as a sound provider.
//
// Commons is the first catalogue wired up because it needs no key, no contract
// and no commercial negotiation: everything on it is already licensed for
// commercial reuse, which is Commons' own upload policy rather than something
// we have to check per file. That makes it the right thing to build the
// plumbing against while proper libraries are being sourced.
//
// It is also, honestly, a thin music library — see `MIN_TRACK_SECONDS` in
// sound-library.ts for what the catalogue is actually full of. What is here is
// real and usable; there is just not very much of it.
//
// Both functions below are pure. The fetch lives in the api.sounds route so
// this can be tested without a network, and so the User-Agent policy is
// honoured in exactly one place.

import {
  type LibraryTrack,
  type TrackLicence,
  plainText,
  stripTracking,
} from "@/lib/sound-library";

const API = "https://commons.wikimedia.org/w/api.php";

/** Namespace 6 is File:. Searching anything else returns articles about music
 *  rather than music. */
const FILE_NAMESPACE = 6;

/** We over-fetch and then throw most of it away.
 *
 *  The API cannot filter by duration, and duration is the whole of our quality
 *  filter — a search for "jazz" is over half pronunciation clips and
 *  two-second instrument samples. Asking for a page of 10 would routinely
 *  return 3 usable tracks. */
export const OVERFETCH = 50;

/** What the picker offers instead of an empty search box.
 *
 *  Commons quietly absorbed a bulk import of the Free Music Archive, and those
 *  files — unlike the rest of the audio on Commons — are real music, tagged by
 *  genre. Browsing those categories is a completely different experience from
 *  free-text search: `filetype:audio jazz` returns dictionary recordings of the
 *  word "jazz", while `incategory:"Jazz music from Free Music Archive"` returns
 *  jazz.
 *
 *  Counts were measured on 2026-09-10 and are here to justify the shortlist,
 *  not to be displayed — a genre with forty tracks is worth offering, one with
 *  one is not. */
export const SOUND_GENRES: { id: string; label: string; category: string }[] = [
  { id: "lofi", label: "Lo-fi", category: "Lo-fi music from Free Music Archive" }, // 197
  { id: "chill", label: "Chill-out", category: "Chill-out music from Free Music Archive" }, // 88
  { id: "downtempo", label: "Downtempo", category: "Downtempo music from Free Music Archive" }, // 107
  { id: "ambient", label: "Ambient", category: "Ambient music from Free Music Archive" }, // 933
  { id: "electronic", label: "Electronic", category: "Electronic music from Free Music Archive" }, // 1752
  { id: "hiphop", label: "Hip hop", category: "Hip hop music from Free Music Archive" }, // 233
  { id: "dance", label: "Dance", category: "Dance music from Free Music Archive" }, // 119
  { id: "techno", label: "Techno", category: "Techno music from Free Music Archive" }, // 127
  { id: "synthpop", label: "Synth-pop", category: "Synth-pop music from Free Music Archive" }, // 148
  { id: "funk", label: "Funk", category: "Funk music from Free Music Archive" }, // 43
  { id: "jazz", label: "Jazz", category: "Jazz music from Free Music Archive" }, // 89
  { id: "blues", label: "Blues", category: "Blues music from Free Music Archive" }, // 54
  { id: "piano", label: "Piano", category: "Piano music from Free Music Archive" }, // 58
  {
    id: "instrumental",
    label: "Instrumental",
    category: "Instrumental music from Free Music Archive",
  }, // 1161
  { id: "rock", label: "Rock", category: "Rock music from Free Music Archive" }, // 453
  { id: "pop", label: "Pop", category: "Pop music from Free Music Archive" }, // 125
  { id: "chiptune", label: "Chiptune", category: "Chiptune music from Free Music Archive" }, // 196
  {
    id: "international",
    label: "International",
    category: "International music from Free Music Archive",
  }, // 35
];

export type SoundQuery = { genre?: string; text?: string; offset?: number };

/** Typed text, reduced to something CirrusSearch will read as words.
 *
 *  A quote is syntax, so `say "hi"` would otherwise error rather than return
 *  nothing. `:` and `/` matter more: they are what turn a search box into
 *  `insource:/(a|a)*b/` — a regex query run against every file on Commons.
 *  Wikimedia rate-limits exactly those, and every seller here shares one
 *  User-Agent, so one person pasting that would get the sound library
 *  throttled for everybody.
 *
 *  The grouping and wildcard characters go too. Stripping the colon already
 *  defuses the expensive case, but what is left of such a paste is still
 *  boolean syntax, and an unbalanced bracket makes CirrusSearch reject the
 *  whole query — so a seller who types "(remix)" would get an error rather
 *  than results. Reducing typed text to plain words is both safer and the
 *  only version whose behaviour is obvious. Losing the slash out of "AC/DC"
 *  is a fair price; it still matches as two words. */
function quoteSafe(value: string): string {
  return value
    .replace(/["\\:/~()|*!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The `gsrsearch` string for a query.
 *
 *  A genre browses its category; free text searches everything; both together
 *  searches within the genre, which is what a genre chip plus a typed word
 *  should obviously do. */
export function buildSearchExpression({ genre, text }: SoundQuery): string {
  const parts = ["filetype:audio"];
  const known = SOUND_GENRES.find((g) => g.id === genre);
  if (known) parts.push(`incategory:"${known.category}"`);
  const typed = quoteSafe(text ?? "");
  if (typed) parts.push(typed);
  return parts.join(" ");
}

export function buildSearchUrl(query: SoundQuery): string {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    origin: "*",
    generator: "search",
    // `filetype:audio` is a CirrusSearch keyword, not a text term — it filters
    // to files the search index knows carry audio, which is what keeps images
    // and PDFs out without us matching on extension.
    gsrsearch: buildSearchExpression(query),
    gsrnamespace: String(FILE_NAMESPACE),
    gsrlimit: String(OVERFETCH),
    gsroffset: String(query.offset ?? 0),
    prop: "videoinfo",
    // `videoinfo` rather than `imageinfo` for one reason: `derivatives`, which
    // only the TimedMediaHandler extension exposes. Without it we would only
    // ever see the original file.
    //
    // `duration` is deliberately not listed: it is not a recognised viprop
    // value (the API warns if you ask for it) but it comes back on every audio
    // file anyway, which is lucky, because it is the field the whole quality
    // filter runs on.
    viprop: "url|mime|size|derivatives|extmetadata",
    viextmetadatafilter: "Artist|LicenseShortName|UsageTerms|AttributionRequired|LicenseUrl",
  });
  return `${API}?${params.toString()}`;
}

type Derivative = { src?: string; type?: string; transcodekey?: string };
type ExtMeta = Record<string, { value?: string } | undefined>;
type VideoInfo = {
  url?: string;
  mime?: string;
  size?: number;
  duration?: number;
  descriptionurl?: string;
  derivatives?: Derivative[];
  extmetadata?: ExtMeta;
};
type Page = { pageid?: number; title?: string; index?: number; videoinfo?: VideoInfo[] };

function meta(ext: ExtMeta | undefined, key: string): string | null {
  return plainText(ext?.[key]?.value ?? null);
}

/** A link from the provider, or nothing.
 *
 *  Both links this file produces are stored on the post and are the obvious
 *  thing to hang an `href` on later — "what licence is this?" in the picker,
 *  "where did this come from?" under a post. `LicenseUrl` in particular comes
 *  out of uploader-authored licence-template wikitext, so `javascript:` is a
 *  plausible value rather than a paranoid one, and a scheme check at parse
 *  time is what stops that becoming stored XSS the first time somebody adds
 *  the link nobody thought was dangerous.
 *
 *  `http:` is allowed alongside `https:` because most Creative Commons deed
 *  URLs recorded on Commons are still plain http. */
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

/** A song title, from a filename that was never meant to be one.
 *
 *  The Free Music Archive import names files "Artist - 04 - Song", so the
 *  filename already contains the artist and the track number. Left alone, the
 *  picker lists "Scroach - 04 - hangin" and the credit under the post reads
 *  "Scroach - 04 - hangin — Scroach (CC BY 4.0)", naming the artist twice and
 *  the track position for no reason.
 *
 *  Both prefixes are stripped only when they are actually there, and the
 *  original is kept if stripping would leave nothing — a track genuinely
 *  called "Untitled - 3" should survive. */
function tidyTitle(raw: string, artist: string | null): string {
  const base = raw
    .replace(/^File:/, "")
    .replace(/\.[^.]+$/, "")
    .trim();

  // Compared as segments rather than by building a regex out of the artist.
  // Two reasons: a name is not a pattern (an artist really is called
  // "Sunn O)))", which is an unbalanced group), and a filename cannot hold
  // every character a name can — Commons credits "C. Scott" for a file named
  // "C Scott - 04 - Determinate", so anything matching literally misses it.
  const parts = base.split(/\s+-\s+/);
  if (parts.length < 2) return base;

  const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

  let start = 0;
  if (artist && key(parts[0]) === key(artist)) start += 1;
  // Only when something is left afterwards, so "Miles - 1959" keeps its year.
  if (parts.length > start + 1 && /^\d{1,3}$/.test(parts[start].trim())) start += 1;

  return parts.slice(start).join(" - ").trim() || base;
}

/** The MP3, or nothing.
 *
 *  This is the single most important line in the file. Commons stores audio as
 *  Ogg Vorbis, Opus and FLAC — none of which Safari on iOS will play. Handing
 *  a page the original URL produces a sound library that works perfectly in
 *  testing on a laptop and is silently, completely dead on an iPhone.
 *
 *  Every Commons audio file is transcoded to MP3 by TimedMediaHandler, so the
 *  fix is free; it just has to be deliberate. A file whose transcode hasn't
 *  been generated yet is dropped rather than shown as an entry that won't
 *  play — except where the upload was already an MP3, which needs no
 *  derivative. */
function playableUrl(info: VideoInfo): string | null {
  const mp3 = info.derivatives?.find((d) => d.transcodekey === "mp3" && d.src);
  if (mp3?.src) return stripTracking(mp3.src);
  if (info.mime === "audio/mpeg" && info.url) return stripTracking(info.url);
  return null;
}

/** Whether the credit is owed.
 *
 *  Commons usually states this outright. When it doesn't, we infer — and the
 *  inference deliberately errs towards crediting: naming an artist who placed
 *  their work in the public domain costs nothing, while failing to name one
 *  who required it is the actual failure mode. So the only way to get "no
 *  attribution required" is to say so explicitly, or to be plainly marked
 *  public domain or CC0. */
function attributionRequired(ext: ExtMeta | undefined, licenceName: string): boolean {
  const stated = meta(ext, "AttributionRequired");
  if (stated === "true") return true;
  if (stated === "false") return false;
  return !/^(public domain|cc0|pd)\b/i.test(licenceName.trim());
}

export function parseSearchResponse(json: unknown): LibraryTrack[] {
  const pages = (json as { query?: { pages?: Page[] } })?.query?.pages;
  if (!Array.isArray(pages)) return [];

  // `generator=search` returns pages in no meaningful order — relevance lives
  // in `index`, which is easy to miss and produces a result list that looks
  // randomly shuffled if you do.
  const ordered = [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  const tracks: LibraryTrack[] = [];
  for (const page of ordered) {
    const info = page.videoinfo?.[0];
    if (!info || !page.pageid || !page.title) continue;

    const streamUrl = playableUrl(info);
    if (!streamUrl) continue;

    const artist = meta(info.extmetadata, "Artist");
    const licenceName = meta(info.extmetadata, "LicenseShortName") ?? "Unknown licence";
    const licence: TrackLicence = {
      name: licenceName,
      url: safeLink(meta(info.extmetadata, "LicenseUrl")),
      attributionRequired: attributionRequired(info.extmetadata, licenceName),
    };

    tracks.push({
      id: `wikimedia:${page.pageid}`,
      provider: "wikimedia",
      // "File:Scroach - 04 - hangin.ogg" → "hangin". The extension is the
      // container we just transcoded away from, so showing it would be both
      // ugly and wrong.
      title: tidyTitle(page.title, artist),
      artist,
      durationSeconds: info.duration ?? 0,
      streamUrl,
      sizeBytes: typeof info.size === "number" ? info.size : null,
      licence,
      sourceUrl:
        safeLink(info.descriptionurl) ?? `https://commons.wikimedia.org/?curid=${page.pageid}`,
    });
  }
  return tracks;
}
