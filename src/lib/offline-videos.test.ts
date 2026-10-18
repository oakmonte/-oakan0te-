import { describe, expect, test } from "bun:test";
import {
  downloadFraction,
  entryUrls,
  formatBytes,
  formatSavedAt,
  hasRoomFor,
  indexBytes,
  isQuotaError,
  normalizeMediaType,
  normalizeUrl,
  parseContentLength,
  parseIndex,
  removeEntry,
  serializeIndex,
  storedContentType,
  sumKnownLengths,
  upsertEntry,
  urlsToRelease,
  type OfflineEntry,
} from "./offline-videos";

const entry = (
  postId: string,
  savedAt: number,
  extra: Partial<OfflineEntry> = {},
): OfflineEntry => ({
  postId,
  caption: null,
  author: { displayName: "Ada", username: "ada" },
  savedAt,
  bytes: 100,
  media: [{ url: `https://cdn.example/${postId}/media-0.jpg`, type: "photo", bytes: 100 }],
  posterUrl: null,
  audio: null,
  ...extra,
});

describe("index round trip", () => {
  test("serialises and parses back to the same entries", () => {
    const list = [entry("b", 2), entry("a", 1)];
    expect(parseIndex(serializeIndex(list))).toEqual(list);
  });

  test("an empty, missing or broken value is an empty index, never a throw", () => {
    expect(parseIndex(null)).toEqual([]);
    expect(parseIndex("")).toEqual([]);
    expect(parseIndex("{not json")).toEqual([]);
    expect(parseIndex('{"entries":"nope"}')).toEqual([]);
    expect(parseIndex("[]")).toEqual([]);
  });

  test("malformed entries are dropped and the good ones survive", () => {
    const good = entry("good", 5);
    const raw = JSON.stringify({
      v: 1,
      entries: [
        good,
        { postId: "no-media", savedAt: 1, bytes: 0, media: [] },
        { postId: "", savedAt: 1, bytes: 0, media: good.media },
        { postId: "bad-bytes", savedAt: 1, bytes: -4, media: good.media },
        { postId: "bad-item", savedAt: 1, bytes: 1, media: [{ url: 7, bytes: 1 }] },
        null,
        "string",
      ],
    });
    expect(parseIndex(raw).map((e) => e.postId)).toEqual(["good"]);
  });

  test("a duplicated post id keeps only its first occurrence", () => {
    const raw = serializeIndex([entry("x", 9, { bytes: 1 }), entry("x", 3, { bytes: 2 })]);
    const parsed = parseIndex(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].bytes).toBe(1);
  });

  test("comes back newest first whatever order it was stored in", () => {
    const raw = serializeIndex([entry("old", 1), entry("new", 3), entry("mid", 2)]);
    expect(parseIndex(raw).map((e) => e.postId)).toEqual(["new", "mid", "old"]);
  });

  test("an unknown media type reads as a photo; missing author fields as null", () => {
    const raw = JSON.stringify({
      entries: [
        {
          postId: "p",
          savedAt: 1,
          bytes: 1,
          media: [{ url: "https://cdn.example/a", type: "carousel", bytes: 1 }],
        },
      ],
    });
    const [e] = parseIndex(raw);
    expect(e.media[0].type).toBe("photo");
    expect(e.author).toEqual({ displayName: null, username: null });
    expect(e.audio).toBeNull();
    expect(e.posterUrl).toBeNull();
  });
});

describe("index bookkeeping", () => {
  test("upsert replaces a post saved twice instead of listing it twice", () => {
    const list = upsertEntry([entry("a", 1), entry("b", 2)], entry("a", 5, { bytes: 999 }));
    expect(list.map((e) => e.postId)).toEqual(["a", "b"]);
    expect(list[0].bytes).toBe(999);
  });

  test("remove drops only the named post", () => {
    expect(removeEntry([entry("a", 1), entry("b", 2)], "a").map((e) => e.postId)).toEqual(["b"]);
    expect(removeEntry([entry("a", 1)], "missing")).toHaveLength(1);
  });

  test("total bytes is the sum of every post", () => {
    expect(indexBytes([])).toBe(0);
    expect(indexBytes([entry("a", 1, { bytes: 10 }), entry("b", 2, { bytes: 32 })])).toBe(42);
  });

  test("a post's urls are its media, poster and sound, without repeats", () => {
    const e = entry("p", 1, {
      media: [
        { url: "https://cdn.example/v", type: "video", bytes: 1 },
        { url: "https://cdn.example/i", type: "photo", bytes: 1 },
      ],
      posterUrl: "https://cdn.example/i",
      audio: { url: "https://cdn.example/s.mp3", label: null },
    });
    expect(entryUrls(e)).toEqual([
      "https://cdn.example/v",
      "https://cdn.example/i",
      "https://cdn.example/s.mp3",
    ]);
  });

  test("deleting a post never releases a file another saved post still uses", () => {
    const shared = "https://cdn.example/shared.mp3";
    const a = entry("a", 1, { audio: { url: shared, label: null } });
    const b = entry("b", 2, { audio: { url: shared, label: null } });
    const released = urlsToRelease([b], [a]);
    expect(released).toEqual([a.media[0].url]);
    expect(released).not.toContain(shared);
    // Once nothing is left, everything goes.
    expect(urlsToRelease([], [a, b]).sort()).toEqual(
      [a.media[0].url, b.media[0].url, shared].sort(),
    );
  });
});

describe("progress", () => {
  test("a total exists only when every length is known", () => {
    expect(sumKnownLengths([10, 20])).toBe(30);
    expect(sumKnownLengths([])).toBe(0);
    expect(sumKnownLengths([10, null, 20])).toBeNull();
  });

  test("content-length parsing ignores junk", () => {
    expect(parseContentLength("1234")).toBe(1234);
    expect(parseContentLength(null)).toBeNull();
    expect(parseContentLength("")).toBeNull();
    expect(parseContentLength("abc")).toBeNull();
    expect(parseContentLength("-5")).toBeNull();
  });

  test("fraction is clamped and null without a total", () => {
    expect(downloadFraction({ loaded: 50, total: 200 })).toBe(0.25);
    expect(downloadFraction({ loaded: 300, total: 200 })).toBe(1);
    expect(downloadFraction({ loaded: 5, total: null })).toBeNull();
    expect(downloadFraction({ loaded: 5, total: 0 })).toBeNull();
  });

  test("room check leaves a margin and admits when it can't tell", () => {
    const mb = 1024 * 1024;
    expect(hasRoomFor({ usage: 0, quota: 100 * mb }, 10 * mb)).toBe(true);
    expect(hasRoomFor({ usage: 95 * mb, quota: 100 * mb }, 10 * mb)).toBe(false);
    // Exactly the space needed is not enough: the margin is the point.
    expect(hasRoomFor({ usage: 90 * mb, quota: 100 * mb }, 10 * mb)).toBe(false);
    expect(hasRoomFor(null, 10)).toBeNull();
    expect(hasRoomFor({ usage: null, quota: 10 }, 1)).toBeNull();
  });
});

describe("formatting", () => {
  test("bytes read the way phone storage settings report them", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1000)).toBe("1 KB");
    expect(formatBytes(1500)).toBe("1.5 KB");
    expect(formatBytes(840_000)).toBe("840 KB");
    expect(formatBytes(4_200_000)).toBe("4.2 MB");
    expect(formatBytes(84_400_000)).toBe("84 MB");
    expect(formatBytes(1_230_000_000)).toBe("1.2 GB");
  });

  test("saved dates are calendar days, not 24-hour windows", () => {
    const now = new Date(2026, 9, 8, 9, 0).getTime();
    expect(formatSavedAt(new Date(2026, 9, 8, 0, 5).getTime(), now)).toBe("Today");
    // Late last night is yesterday even though it's under 24 hours ago.
    expect(formatSavedAt(new Date(2026, 9, 7, 23, 50).getTime(), now)).toBe("Yesterday");
    expect(formatSavedAt(new Date(2026, 9, 3, 12, 0).getTime(), now)).toBe("3 Oct");
    expect(formatSavedAt(new Date(2025, 11, 31, 12, 0).getTime(), now)).toBe("31 Dec 2025");
    // A clock that moved backwards still says today rather than a future day.
    expect(formatSavedAt(now + 60_000, now)).toBe("Today");
  });
});

describe("stored content types", () => {
  test("videos are always playable video types", () => {
    expect(storedContentType("video", "video/mp4", "https://x/original")).toBe("video/mp4");
    expect(storedContentType("video", "application/octet-stream", "https://x/original")).toBe(
      "video/mp4",
    );
    expect(storedContentType("video", null, "https://x/original")).toBe("video/mp4");
    expect(storedContentType("video", "video/quicktime; charset=x", "https://x")).toBe(
      "video/quicktime",
    );
  });

  test("photos fall back on the extension, then jpeg", () => {
    expect(storedContentType("photo", "image/webp", "https://x/a.jpg")).toBe("image/webp");
    expect(storedContentType("photo", null, "https://x/a.png")).toBe("image/png");
    expect(storedContentType("photo", "binary/octet-stream", "https://x/a.webp")).toBe(
      "image/webp",
    );
    expect(storedContentType("photo", null, "https://x/thumbnail")).toBe("image/jpeg");
  });

  test("sound is an audio type", () => {
    expect(storedContentType("audio", "audio/mp4", "https://x/s.m4a")).toBe("audio/mp4");
    expect(storedContentType("audio", null, "https://x/s")).toBe("audio/mpeg");
  });
});

describe("small helpers", () => {
  test("urls are stored the way the cache serialises them", () => {
    expect(normalizeUrl("https://CDN.example/a b")).toBe("https://cdn.example/a%20b");
    expect(normalizeUrl("not a url")).toBe("not a url");
  });

  test("only 'video' is a video", () => {
    expect(normalizeMediaType("video")).toBe("video");
    expect(normalizeMediaType("photo")).toBe("photo");
    expect(normalizeMediaType("image")).toBe("photo");
  });

  test("quota errors are recognised across engines", () => {
    expect(isQuotaError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaError({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error("nope"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});
