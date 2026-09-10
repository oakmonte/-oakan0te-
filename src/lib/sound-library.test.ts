import { test, expect, describe } from "bun:test";
import {
  MAX_TRACK_SECONDS,
  MIN_TRACK_SECONDS,
  type LibraryTrack,
  creditFor,
  creditLine,
  formatDuration,
  isLicenceUsable,
  isTrustedAudioSource,
  isUsableTrack,
  plainText,
  stripTracking,
} from "./sound-library";

// These rules fail silently, which is why they are worth pinning.
//
// A broken duration filter shows dictionary recordings as if they were songs.
// A broken attribution rule strips an artist's name off a post that is only
// licensed while the name is on it — no error, no crash, just an infringing
// post. And a broken host allowlist turns the publish handler into something
// that will fetch whatever a request asks it to.

function track(patch: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: "wikimedia:1",
    provider: "wikimedia",
    title: "Cascade",
    artist: "Hoving ft Laniakea",
    durationSeconds: 120,
    streamUrl: "https://upload.wikimedia.org/x.mp3",
    sizeBytes: 1000,
    licence: { name: "CC BY 3.0", url: null, attributionRequired: true },
    ...patch,
  };
}

describe("isUsableTrack", () => {
  test("keeps a normal song", () => {
    expect(isUsableTrack(track())).toBe(true);
  });

  test("drops a pronunciation clip", () => {
    // The actual false positive this exists for: Wiktionary recordings of the
    // *word* "afrobeat" outnumber afrobeat music on Commons.
    expect(isUsableTrack(track({ durationSeconds: 2 }))).toBe(false);
  });

  test("drops a DJ set", () => {
    expect(isUsableTrack(track({ durationSeconds: MAX_TRACK_SECONDS + 1 }))).toBe(false);
  });

  test("the bounds themselves are inclusive", () => {
    expect(isUsableTrack(track({ durationSeconds: MIN_TRACK_SECONDS }))).toBe(true);
    expect(isUsableTrack(track({ durationSeconds: MAX_TRACK_SECONDS }))).toBe(true);
  });

  test("drops anything with no playable url or no title", () => {
    expect(isUsableTrack(track({ streamUrl: "" }))).toBe(false);
    expect(isUsableTrack(track({ title: "   " }))).toBe(false);
  });

  test("drops a missing duration rather than treating it as zero", () => {
    expect(isUsableTrack(track({ durationSeconds: NaN }))).toBe(false);
  });
});

describe("isLicenceUsable", () => {
  const licence = (name: string) => ({ name, url: null, attributionRequired: true });

  test("allows the free licences", () => {
    for (const name of ["CC BY 3.0", "CC BY-SA 4.0", "CC0", "Public domain"]) {
      expect(isLicenceUsable(licence(name))).toBe(true);
    }
  });

  test("refuses non-commercial, which a shop cannot honour", () => {
    // Every post here advertises something with a price on it.
    expect(isLicenceUsable(licence("CC BY-NC 4.0"))).toBe(false);
    expect(isLicenceUsable(licence("Creative Commons Non-Commercial"))).toBe(false);
  });

  test("refuses no-derivatives", () => {
    expect(isLicenceUsable(licence("CC BY-ND 4.0"))).toBe(false);
  });
});

describe("plainText", () => {
  test("unwraps the wiki link Commons stores an artist as", () => {
    expect(plainText('<a href="/wiki/User:X" class="new">Manwithmetalpig</a>')).toBe(
      "Manwithmetalpig",
    );
  });

  test("strips markup rather than passing it through to be rendered", () => {
    // The artist field is text uploaded by a stranger. It must never reach the
    // page as markup.
    expect(plainText('<img src=x onerror="alert(1)">Bob')).toBe("Bob");
    expect(plainText("<script>alert(1)</script>")).toBe("alert(1)");
  });

  test("decodes the entities that actually show up in names", () => {
    expect(plainText("Simon &amp; Garfunkel")).toBe("Simon & Garfunkel");
    expect(plainText("Rock &#39;n&#39; Roll")).toBe("Rock 'n' Roll");
  });

  test("empty and missing collapse to null, not to an empty credit", () => {
    expect(plainText("")).toBe(null);
    expect(plainText(null)).toBe(null);
    expect(plainText("<b></b>")).toBe(null);
  });
});

describe("stripTracking", () => {
  test("removes the analytics parameters Commons bolts on", () => {
    expect(
      stripTracking("https://upload.wikimedia.org/a.ogg?utm_source=commons&utm_campaign=imageinfo"),
    ).toBe("https://upload.wikimedia.org/a.ogg");
  });

  test("leaves parameters that are part of the address", () => {
    expect(stripTracking("https://example.org/f?curid=12")).toBe("https://example.org/f?curid=12");
  });

  test("a url it cannot parse is returned untouched rather than lost", () => {
    expect(stripTracking("not a url")).toBe("not a url");
  });
});

describe("creditLine", () => {
  test("names artist and licence when attribution is required", () => {
    expect(creditLine(track())).toBe("Cascade — Hoving ft Laniakea (CC BY 3.0)");
  });

  test("still names the licence when nobody is credited", () => {
    expect(creditLine(track({ artist: null }))).toBe("Cascade (CC BY 3.0)");
  });

  test("public domain gets the plain title, not a licence banner", () => {
    // A feed with "CC0 1.0 Universal" under every post trains people to ignore
    // the line that sometimes matters.
    const pd = track({ licence: { name: "CC0", url: null, attributionRequired: false } });
    expect(creditLine(pd)).toBe("Cascade");
  });
});

describe("creditFor", () => {
  test("stores no attribution when none is owed", () => {
    const pd = track({ licence: { name: "CC0", url: null, attributionRequired: false } });
    expect(creditFor(pd).attribution).toBe(null);
    expect(creditFor(pd).licence).toBe("CC0");
  });

  test("stores the line to render when one is owed", () => {
    expect(creditFor(track()).attribution).toBe("Cascade — Hoving ft Laniakea (CC BY 3.0)");
  });
});

describe("isTrustedAudioSource", () => {
  test("allows the provider's media host", () => {
    expect(isTrustedAudioSource("https://upload.wikimedia.org/x.mp3")).toBe(true);
  });

  test("allows our own cdn only when it is passed in", () => {
    expect(isTrustedAudioSource("https://cdn.oakmonte.net/a.mp3")).toBe(false);
    expect(isTrustedAudioSource("https://cdn.oakmonte.net/a.mp3", ["cdn.oakmonte.net"])).toBe(true);
  });

  test("refuses the addresses an ssrf actually aims at", () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "https://169.254.169.254/",
      "http://localhost/",
      "https://192.168.0.1/",
      "file:///etc/passwd",
    ]) {
      expect(isTrustedAudioSource(url)).toBe(false);
    }
  });

  test("refuses plain http even on an allowed host", () => {
    expect(isTrustedAudioSource("http://upload.wikimedia.org/x.mp3")).toBe(false);
  });

  test("refuses a non-default port, which hostname alone does not see", () => {
    expect(isTrustedAudioSource("https://upload.wikimedia.org:1234/x.mp3")).toBe(false);
    expect(isTrustedAudioSource("https://cdn.oakmonte.net:9000/a.mp3", ["cdn.oakmonte.net"])).toBe(
      false,
    );
  });

  test("is not fooled by credentials in the authority", () => {
    // `https://upload.wikimedia.org@evil.com/` has hostname evil.com.
    expect(isTrustedAudioSource("https://upload.wikimedia.org@evil.com/x.mp3")).toBe(false);
  });

  test("is not fooled by a lookalike hostname", () => {
    // Substring matching here would accept every one of these.
    expect(isTrustedAudioSource("https://upload.wikimedia.org.evil.com/x.mp3")).toBe(false);
    expect(isTrustedAudioSource("https://evil.com/upload.wikimedia.org/x.mp3")).toBe(false);
    expect(isTrustedAudioSource("https://notupload.wikimedia.org/x.mp3")).toBe(false);
  });

  test("refuses a url that does not parse", () => {
    expect(isTrustedAudioSource("upload.wikimedia.org/x.mp3")).toBe(false);
  });
});

describe("formatDuration", () => {
  test("pads seconds so the column does not jitter", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(600)).toBe("10:00");
  });
});
