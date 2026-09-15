// The sound library: tracks a seller can put on a post without owning them.
//
// Sellers can already attach an audio file off their own device, which in
// practice means "have an mp3 lying around" — most won't. This is the
// catalogue side of that feature.
//
// Everything here is provider-agnostic. Wikimedia Commons is the first source
// wired up, not the only one intended, and the rules that must NOT be
// reimplemented per provider are exactly the ones in this file: what counts as
// a usable track, what a licence obliges us to say, and how a credit is
// worded. A second provider that gets any of those subtly different is a
// licensing bug, not a cosmetic one.
//
// Nothing here does I/O. Providers fetch and normalise into `LibraryTrack`;
// this module decides what to do with one.

export type SoundProviderId = "wikimedia" | "ccmixter" | "jamendo";

/** The genres the picker offers, and the only vocabulary the UI knows.
 *
 *  Canonical here rather than in any one provider because each source names
 *  its own music differently — Commons browses Free Music Archive categories,
 *  ccMixter matches uploader tags, Jamendo has its own taxonomy. A seller taps
 *  "Lo-fi"; translating that into whatever a given catalogue calls lo-fi is
 *  each provider's problem, and keeping the list here is what stops the chip
 *  row changing shape depending on which sources happen to be configured. */
export const SOUND_GENRES: { id: string; label: string }[] = [
  { id: "lofi", label: "Lo-fi" },
  { id: "chill", label: "Chill-out" },
  { id: "downtempo", label: "Downtempo" },
  { id: "ambient", label: "Ambient" },
  { id: "electronic", label: "Electronic" },
  { id: "hiphop", label: "Hip hop" },
  { id: "dance", label: "Dance" },
  { id: "techno", label: "Techno" },
  { id: "synthpop", label: "Synth-pop" },
  { id: "funk", label: "Funk" },
  { id: "jazz", label: "Jazz" },
  { id: "blues", label: "Blues" },
  { id: "piano", label: "Piano" },
  { id: "instrumental", label: "Instrumental" },
  { id: "rock", label: "Rock" },
  { id: "pop", label: "Pop" },
  { id: "chiptune", label: "Chiptune" },
  { id: "international", label: "International" },
];

export type TrackLicence = {
  /** Short human name as the provider states it: "CC BY 3.0", "CC0", "Public domain". */
  name: string;
  /** Deed URL, when the provider gives one. */
  url: string | null;
  /** Whether using the track obliges us to name the artist.
   *
   *  This is not decoration. CC BY and CC BY-SA are only free to use *if*
   *  credited; dropping the credit turns a licensed track into an infringing
   *  one. It is stored on the post and rendered in the feed for that reason,
   *  not as a nicety. */
  attributionRequired: boolean;
};

export type LibraryTrack = {
  /** Provider-scoped, e.g. "wikimedia:117454024". Unique across providers so a
   *  second source can't collide with the first. */
  id: string;
  provider: SoundProviderId;
  title: string;
  /** Plain text, already stripped of the provider's markup. Null when the
   *  provider names no one — which is normal for public-domain recordings. */
  artist: string | null;
  durationSeconds: number;
  /** An MP3, always — see `MIN_TRACK_SECONDS` note below on why the original
   *  file is not what we hand to an `<audio>` element. */
  streamUrl: string;
  sizeBytes: number | null;
  licence: TrackLicence;
  /** The provider's human-readable page for this file. Kept because a credit
   *  that can't be checked isn't much of a credit, and because CC deeds ask
   *  for a link to the source where reasonable. */
  sourceUrl: string;
  /** Proof that `streamUrl` came out of this catalogue, stamped by
   *  `/api/sounds` after the usability and licence filters have run. Only
   *  `/api/sound-file` reads it, and only to refuse URLs it never offered —
   *  see `sound-url-signature.server.ts`. Absent on a track built anywhere
   *  other than that route, which is why the proxy treats absent as a refusal
   *  rather than as "unsigned is fine". */
  access?: { sig: string; exp: number };
};

/** Below this, it isn't a song.
 *
 *  This single number does almost all the quality filtering, and it earns its
 *  place empirically rather than by taste. Free-media archives are dominated
 *  by dictionary pronunciations, animal noises and instrument samples — a
 *  search for "afrobeat" on Commons returns five German Wiktionary recordings
 *  of the *word* "Afrobeat" before it returns any music. Every one of those is
 *  under three seconds; every actual track is over twenty. */
export const MIN_TRACK_SECONDS = 20;

/** Above this we don't list it.
 *
 *  Not a quality judgement — a 40-minute DJ set is a fine recording and a
 *  terrible thing to put behind a photo of a dress. It also has to travel:
 *  the track is copied into our own storage when the post goes out, and an
 *  hour of audio is tens of megabytes to move for a clip nobody will hear
 *  past the first verse. */
export const MAX_TRACK_SECONDS = 12 * 60;

export function isUsableTrack(track: LibraryTrack): boolean {
  if (!track.streamUrl || !track.title.trim()) return false;
  if (!Number.isFinite(track.durationSeconds)) return false;
  return track.durationSeconds >= MIN_TRACK_SECONDS && track.durationSeconds <= MAX_TRACK_SECONDS;
}

/** Licences we will not put on a post, matched loosely on the stated name.
 *
 *  Oakmonte is a shop. A post is an advert for something with a price on it,
 *  which makes every use here commercial — so a "non-commercial" track is not
 *  merely discouraged, it is outside its own licence the moment a seller
 *  attaches it, and the seller is the one who carries that.
 *
 *  Wikimedia Commons already refuses NC-only uploads as a matter of policy, so
 *  on today's only provider this should never fire. It is here anyway, because
 *  the next provider will not have that policy and this is the check that
 *  would otherwise be forgotten. */
const FORBIDDEN_LICENCE = /\bnon-?commercial\b|\bNC\b|\bND\b|\bno-?derivat/i;

/** Licences we affirmatively know we may use: public dedication, or Creative
 *  Commons Attribution with or without ShareAlike.
 *
 *  A licence has to match this to pass — being merely *not* on the forbidden
 *  list is not enough, and that distinction is the whole point. Providers fall
 *  back to "Unknown licence" whenever a response omits the field, which is
 *  easy to cause by accident: asking ccMixter for a reduced set of fields
 *  silently drops `license_name` and turns every track in the page into an
 *  unknown. Under a deny-list those all sail through as usable, and the
 *  non-commercial tracks the deny-list exists to catch go with them.
 *
 *  So the rule is inverted: if we cannot name the licence, we cannot publish
 *  the track. Wrongly hiding a usable song is a missing row in a picker;
 *  wrongly publishing an NC one is the seller's problem with a rights
 *  holder. */
const PERMITTED_LICENCE =
  /^(cc0|public domain|creative commons zero|attribution(?!\s+(non|no))|cc[-\s]?by(?![-\s]?(nc|nd)))/i;

export function isLicenceUsable(licence: TrackLicence): boolean {
  const name = licence.name.trim();
  if (!name) return false;
  if (FORBIDDEN_LICENCE.test(name)) return false;
  return PERMITTED_LICENCE.test(name);
}

/** Providers hand back HTML — Commons stores the artist as a wiki link, not a
 *  name. Strip to text and never render the original.
 *
 *  Two reasons, and the second is the one that matters: an artist field is
 *  arbitrary text uploaded by a stranger, so rendering it as markup is a
 *  script-injection hole in a field nobody would think to look at. */
export function plainText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/** Tracking parameters the provider bolts onto its own URLs.
 *
 *  Commons appends `utm_source`/`utm_campaign` to file URLs returned by the
 *  API. We store this URL on the post and hand it to an `<audio>` element, so
 *  keeping them would mean quietly reporting our users' listening back to a
 *  third party's analytics for no benefit to anyone. */
export function stripTracking(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_")) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** How long a track reads as, for a chip that has to fit on a phone. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** What has to appear next to the post, in one line.
 *
 *  Public-domain and CC0 tracks carry no obligation, so they get the plain
 *  title — a feed cluttered with "CC0 1.0 Universal" on every post helps
 *  nobody and trains people to ignore the line that sometimes matters. When
 *  the licence *does* require attribution, the artist and the licence name are
 *  both part of the credit and neither is optional. */
export function creditLine(track: {
  title: string;
  artist: string | null;
  licence: TrackLicence;
}): string {
  if (!track.licence.attributionRequired) return track.title;
  const artist = track.artist?.trim();
  return artist
    ? `${track.title} — ${artist} (${track.licence.name})`
    : `${track.title} (${track.licence.name})`;
}

// ---------------------------------------------------------------------------

/** Provenance that travels with a chosen track, from the picker to the post.
 *
 *  Separate from the track itself because by the time this reaches the feed
 *  the audio lives in our own storage and the `LibraryTrack` is long gone —
 *  this is the part that still has to be true. */
export type SoundCredit = {
  /** The line to render, or null when the licence asks for nothing. */
  attribution: string | null;
  licence: string;
  sourceUrl: string;
};

/** Hosts the server will copy a track from.
 *
 *  A catalogue track is handed to the upload as a URL rather than as bytes:
 *  Commons' MP3s run 3-5 MB, and making the phone download one only to
 *  immediately upload it again costs a seller on mobile data roughly eight
 *  megabytes to attach a song. The server fetches it instead, over a
 *  connection nobody is paying by the megabyte for.
 *
 *  That means a request field decides what our server fetches, which is the
 *  shape of every SSRF hole ever written — a crafted `audioUrl` pointing at
 *  `169.254.169.254` or at something inside the private network would
 *  otherwise be fetched with our credentials and stored somewhere readable.
 *  So the allowlist is exact-hostname and HTTPS-only, and adding a provider
 *  means adding its host here on purpose. */
/** Hosts the server will fetch a track from at publish.
 *
 *  One entry per provider, and deliberately exact hostnames rather than
 *  suffixes: a suffix match on `.jamendo.com` would trust anything anyone can
 *  get a subdomain of, which is the usual way an allowlist quietly stops being
 *  one. If a provider serves audio from a host that isn't here, its tracks
 *  fail to publish — a loud failure, and the correct one. */
const TRUSTED_AUDIO_HOSTS = [
  "upload.wikimedia.org",
  "ccmixter.org",
  // Jamendo serves audio off numbered storage nodes; these are the ones it
  // currently hands out. See the note in jamendo.ts about pinning them.
  "prod-1.storage.jamendo.com",
  "prod-2.storage.jamendo.com",
  "storage-new.jamendo.com",
];

/** `extraHosts` is for our own storage host, which is configured rather than
 *  compiled in and so cannot live in the list above. It matters when a draft
 *  is republished: by then the track has already been copied to our CDN, so
 *  the URL being re-submitted is ours, and re-fetching it there is both safe
 *  and the reason reopening a draft doesn't cost the seller another download. */
export function isTrustedAudioSource(url: string, extraHosts: string[] = []): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    // `hostname` drops the port, so without this `upload.wikimedia.org:1234`
    // passes as the real thing. Neither allowed host serves on another port,
    // so refusing every port but the default costs nothing.
    if (parsed.port !== "") return false;
    return [...TRUSTED_AUDIO_HOSTS, ...extraHosts.filter(Boolean)].includes(parsed.hostname);
  } catch {
    return false;
  }
}

/** The credit a track obliges, ready to store on the post. */
export function creditFor(track: LibraryTrack): SoundCredit {
  return {
    attribution: track.licence.attributionRequired ? creditLine(track) : null,
    licence: track.licence.name,
    sourceUrl: track.sourceUrl,
  };
}
