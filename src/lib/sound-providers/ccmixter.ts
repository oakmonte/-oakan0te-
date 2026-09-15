// ccMixter as a sound provider.
//
// A remix community rather than an archive, which makes it the opposite of
// Commons in the way that matters: everything on it is already music, so none
// of the pronunciation-clip filtering Commons needs applies here. It also
// needs no key, and it serves plain MP3 — no transcode hunting.
//
// The catch is licensing, and it is the reverse of Commons'. Commons refuses
// non-commercial uploads as a matter of policy; ccMixter is *full* of them —
// the first result of an unfiltered query is usually `by-nc`. Oakmonte is a
// shop, so an NC track is outside its own licence the moment a seller attaches
// it. Two things guard that: `lic=open` asks ccMixter to return only
// commercially-usable licences, and `isLicenceUsable` checks again on the way
// out, because a server-side filter we don't control is not a guarantee.
//
// Pure, like the Commons provider: the fetch lives in api.sounds.ts.

import {
  type LibraryTrack,
  type TrackLicence,
  plainText,
  stripTracking,
} from "@/lib/sound-library";

const API = "https://ccmixter.org/api/query";

/** ccMixter matches uploader-written tags, so this maps our genre vocabulary
 *  onto words its community actually uses. A few of ours have no sensible
 *  equivalent — "chiptune" and "international" are not ccMixter idiom — and
 *  those deliberately fall through to an untagged query rather than returning
 *  nothing, since an unfiltered page of ccMixter is still music. */
const GENRE_TAGS: Record<string, string> = {
  lofi: "lo_fi",
  chill: "chill",
  downtempo: "downtempo",
  ambient: "ambient",
  electronic: "electronic",
  hiphop: "hip_hop",
  dance: "dance",
  techno: "techno",
  synthpop: "synth",
  funk: "funk",
  jazz: "jazz",
  blues: "blues",
  piano: "piano",
  instrumental: "instrumental",
  rock: "rock",
  pop: "pop",
};

export const CCMIXTER_PAGE = 30;

export type SoundQuery = { genre?: string; text?: string; offset?: number };

export function buildSearchUrl({ genre, text, offset = 0 }: SoundQuery): string {
  const params = new URLSearchParams({
    f: "json",
    limit: String(CCMIXTER_PAGE),
    offset: String(offset),
    // Commercially-usable licences only. This is the single most important
    // parameter in the file — without it most of what comes back is `by-nc`,
    // which no post on a marketplace is allowed to use.
    lic: "open",
  });
  const tag = genre ? GENRE_TAGS[genre] : undefined;
  if (tag) params.set("tags", tag);
  const typed = (text ?? "").replace(/[^\p{L}\p{N}\s'-]/gu, " ").trim();
  if (typed) params.set("search", typed);
  return `${API}?${params.toString()}`;
}

/** "2:37" → 157. ccMixter reports length as a clock string in
 *  `file_format_info.ps`, and there is no numeric duration anywhere in the
 *  response — so this parse is the only way the shared duration filter can
 *  apply to these tracks at all. */
export function clockToSeconds(clock: string | null | undefined): number {
  if (!clock) return 0;
  const parts = clock.trim().split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

type CcFile = {
  download_url?: string;
  file_filesize?: number | string;
  file_format_info?: { ps?: string; mime_type?: string };
};
type CcUpload = {
  upload_id?: number | string;
  upload_name?: string;
  user_real_name?: string;
  user_name?: string;
  license_name?: string;
  license_url?: string;
  file_page_url?: string;
  files?: CcFile[];
};

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

/** The MP3, or nothing. An upload can carry stems and archives alongside the
 *  mix, so the first file is not reliably the one to play. */
function playable(files: CcFile[] | undefined): CcFile | null {
  return (
    files?.find(
      (f) => f.download_url && (f.file_format_info?.mime_type ?? "").startsWith("audio/"),
    ) ?? null
  );
}

export function parseSearchResponse(json: unknown): LibraryTrack[] {
  if (!Array.isArray(json)) return [];

  const tracks: LibraryTrack[] = [];
  for (const upload of json as CcUpload[]) {
    const file = playable(upload.files);
    const streamUrl = safeLink(file?.download_url);
    if (!streamUrl || !upload.upload_id || !upload.upload_name) continue;

    const licenceName = plainText(upload.license_name) ?? "Unknown licence";
    const licence: TrackLicence = {
      name: licenceName,
      url: safeLink(upload.license_url),
      // Everything ccMixter carries is a Creative Commons licence of some
      // kind, and every CC licence except CC0 requires attribution. There is
      // no "attribution required" flag in the response, so this is derived —
      // and derived towards crediting, which is the safe direction.
      attributionRequired: !/^(cc0|public domain)\b/i.test(licenceName.trim()),
    };

    const size = Number(file?.file_filesize);

    tracks.push({
      id: `ccmixter:${upload.upload_id}`,
      provider: "ccmixter",
      title: plainText(upload.upload_name) ?? "Untitled",
      artist: plainText(upload.user_real_name) ?? plainText(upload.user_name),
      durationSeconds: clockToSeconds(file?.file_format_info?.ps),
      streamUrl,
      sizeBytes: Number.isFinite(size) && size > 0 ? size : null,
      licence,
      sourceUrl:
        safeLink(upload.file_page_url) ?? `https://ccmixter.org/files/x/${upload.upload_id}`,
    });
  }
  return tracks;
}
