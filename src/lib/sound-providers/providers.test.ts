import { describe, expect, test } from "bun:test";
import { interleave } from "./index";
import * as ccmixter from "./ccmixter";
import * as jamendo from "./jamendo";
import type { LibraryTrack } from "@/lib/sound-library";

const stub = (id: string, provider: LibraryTrack["provider"]): LibraryTrack => ({
  id,
  provider,
  title: id,
  artist: null,
  durationSeconds: 100,
  streamUrl: `https://example.com/${id}.mp3`,
  sizeBytes: null,
  licence: { name: "CC BY 4.0", url: null, attributionRequired: true },
  sourceUrl: "https://example.com",
});

describe("interleave", () => {
  test("takes one from each source in turn", () => {
    const merged = interleave([
      [stub("w1", "wikimedia"), stub("w2", "wikimedia"), stub("w3", "wikimedia")],
      [stub("c1", "ccmixter"), stub("c2", "ccmixter")],
    ]);
    expect(merged.map((t) => t.id)).toEqual(["w1", "c1", "w2", "c2", "w3"]);
  });

  test("a source returning nothing just leaves the others in order", () => {
    const merged = interleave([[], [stub("c1", "ccmixter"), stub("c2", "ccmixter")]]);
    expect(merged.map((t) => t.id)).toEqual(["c1", "c2"]);
  });

  test("no sources at all is empty, not a crash", () => {
    expect(interleave([])).toEqual([]);
  });
});

describe("ccmixter.clockToSeconds", () => {
  test("reads the clock string that is the only duration in the response", () => {
    expect(ccmixter.clockToSeconds("2:37")).toBe(157);
    expect(ccmixter.clockToSeconds("0:45")).toBe(45);
    expect(ccmixter.clockToSeconds("1:02:03")).toBe(3723);
  });

  test("a missing or broken clock reads as zero, so the duration filter drops it", () => {
    expect(ccmixter.clockToSeconds(undefined)).toBe(0);
    expect(ccmixter.clockToSeconds("")).toBe(0);
    expect(ccmixter.clockToSeconds("abc")).toBe(0);
    expect(ccmixter.clockToSeconds("-1:30")).toBe(0);
  });
});

describe("ccmixter.buildSearchUrl", () => {
  test("always asks for commercially-usable licences", () => {
    // Without lic=open most of what comes back is by-nc, which no post on a
    // marketplace may use.
    expect(ccmixter.buildSearchUrl({})).toContain("lic=open");
    expect(ccmixter.buildSearchUrl({ genre: "jazz" })).toContain("lic=open");
  });

  test("maps our genre vocabulary onto its tags", () => {
    expect(ccmixter.buildSearchUrl({ genre: "hiphop" })).toContain("tags=hip_hop");
    // A genre it has no idiom for falls through to an untagged query rather
    // than to a tag that matches nothing.
    expect(ccmixter.buildSearchUrl({ genre: "chiptune" })).not.toContain("tags=");
  });
});

describe("ccmixter.parseSearchResponse", () => {
  const upload = (over: Record<string, unknown> = {}) => ({
    upload_id: 42,
    upload_name: "Great Day",
    user_real_name: "Gabriel Shellington",
    license_name: "Attribution (3.0)",
    license_url: "https://creativecommons.org/licenses/by/3.0/",
    file_page_url: "https://ccmixter.org/files/x/42",
    files: [
      {
        download_url: "https://ccmixter.org/content/x/great_day.mp3",
        file_filesize: 4000,
        file_format_info: { ps: "2:37", mime_type: "audio/mpeg" },
      },
    ],
    ...over,
  });

  test("reads a track", () => {
    const [t] = ccmixter.parseSearchResponse([upload()]);
    expect(t.id).toBe("ccmixter:42");
    expect(t.durationSeconds).toBe(157);
    expect(t.artist).toBe("Gabriel Shellington");
    expect(t.licence.attributionRequired).toBe(true);
  });

  test("skips an upload whose files are not audio", () => {
    // An upload can carry stems and project archives beside the mix.
    const stems = upload({
      files: [
        {
          download_url: "https://ccmixter.org/content/x/stems.zip",
          file_format_info: { mime_type: "application/zip" },
        },
      ],
    });
    expect(ccmixter.parseSearchResponse([stems])).toEqual([]);
  });

  test("a non-array response is empty rather than a throw", () => {
    expect(ccmixter.parseSearchResponse({ error: "nope" })).toEqual([]);
    expect(ccmixter.parseSearchResponse(null)).toEqual([]);
  });
});

describe("jamendo.licenceFromCcUrl", () => {
  test("names the licence from its deed url", () => {
    expect(jamendo.licenceFromCcUrl("http://creativecommons.org/licenses/by/3.0/")).toBe(
      "CC BY 3.0",
    );
    expect(jamendo.licenceFromCcUrl("https://creativecommons.org/licenses/by-nc-nd/4.0/")).toBe(
      "CC BY-NC-ND 4.0",
    );
    expect(jamendo.licenceFromCcUrl("https://creativecommons.org/publicdomain/zero/1.0/")).toBe(
      "CC0",
    );
  });

  test("an unreadable url names nothing usable, so the track is not published", () => {
    expect(jamendo.licenceFromCcUrl(null)).toBe("Unknown licence");
    expect(jamendo.licenceFromCcUrl("https://example.com/terms")).toBe("Unknown licence");
  });
});

describe("jamendo.parseSearchResponse", () => {
  test("treats a failure body as empty, not as an empty catalogue", () => {
    // Jamendo answers a rejected key with HTTP 200 and the failure in the
    // body, so trusting the status code would show "no sounds here" when the
    // real problem is the key.
    const failure = {
      headers: { status: "failed", error_message: "Invalid Client Id" },
      results: [],
    };
    expect(jamendo.parseSearchResponse(failure)).toEqual([]);
  });

  test("drops a track whose rights holder forbids download", () => {
    // We copy the file into our own storage at publish, so a stream-only
    // track is one we would be storing without permission.
    const body = {
      headers: { status: "success" },
      results: [
        {
          id: "1",
          name: "Nope",
          duration: 120,
          audiodownload: "https://prod-1.storage.jamendo.com/download/track/1/mp32/",
          audiodownload_allowed: false,
          license_ccurl: "http://creativecommons.org/licenses/by/3.0/",
        },
      ],
    };
    expect(jamendo.parseSearchResponse(body)).toEqual([]);
  });
});
