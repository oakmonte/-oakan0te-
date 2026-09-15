import { test, expect, describe } from "bun:test";
import { buildSearchExpression, parseSearchResponse } from "./wikimedia";
import { SOUND_GENRES } from "@/lib/sound-library";

// Shapes below are trimmed copies of real Commons responses.

function page(over: Record<string, unknown> = {}, info: Record<string, unknown> = {}) {
  return {
    pageid: 1,
    title: "File:Cascade.ogg",
    index: 1,
    videoinfo: [
      {
        url: "https://upload.wikimedia.org/wikipedia/commons/0/03/Cascade.ogg?utm_source=commons",
        mime: "application/ogg",
        size: 2088081,
        duration: 205.7,
        descriptionurl: "https://commons.wikimedia.org/wiki/File:Cascade.ogg",
        derivatives: [
          { src: "https://upload.wikimedia.org/a/Cascade.ogg", transcodekey: undefined },
          {
            src: "https://upload.wikimedia.org/transcoded/0/03/Cascade.ogg/Cascade.ogg.mp3",
            type: "audio/mpeg",
            transcodekey: "mp3",
          },
        ],
        extmetadata: {
          Artist: { value: '<a href="/wiki/User:H">Hoving</a>' },
          LicenseShortName: { value: "CC BY 3.0" },
          AttributionRequired: { value: "true" },
        },
        ...info,
      },
    ],
    ...over,
  };
}

const wrap = (pages: unknown[]) => ({ query: { pages } });

describe("parseSearchResponse", () => {
  test("hands back the mp3, never the original", () => {
    // The single most important behaviour here. Commons stores audio as Ogg
    // Vorbis, which Safari on iOS will not play — shipping the original url
    // gives a library that works on a laptop and is silently dead on an
    // iPhone.
    const [t] = parseSearchResponse(wrap([page()]));
    expect(t.streamUrl).toBe(
      "https://upload.wikimedia.org/transcoded/0/03/Cascade.ogg/Cascade.ogg.mp3",
    );
  });

  test("accepts a file that was already an mp3 and has no derivative", () => {
    const [t] = parseSearchResponse(
      wrap([
        page(
          {},
          {
            mime: "audio/mpeg",
            derivatives: [],
            url: "https://upload.wikimedia.org/x.mp3?utm_source=commons",
          },
        ),
      ]),
    );
    expect(t.streamUrl).toBe("https://upload.wikimedia.org/x.mp3");
  });

  test("drops a file whose transcode does not exist yet", () => {
    // Better a shorter list than a row that plays nothing when tapped.
    expect(
      parseSearchResponse(wrap([page({}, { derivatives: [], mime: "application/ogg" })])),
    ).toEqual([]);
  });

  test("tidies the title into something worth showing", () => {
    const [t] = parseSearchResponse(wrap([page()]));
    expect(t.title).toBe("Cascade");
  });

  describe("title tidying", () => {
    const titled = (title: string, artist: string) =>
      parseSearchResponse(
        wrap([page({ title }, { extmetadata: { Artist: { value: artist } } })]),
      )[0].title;

    test("drops the artist and track number the FMA filename repeats", () => {
      // Otherwise the credit reads "Scroach - 04 - hangin — Scroach".
      expect(titled("File:Scroach - 04 - hangin.ogg", "Scroach")).toBe("hangin");
    });

    test("drops just the artist when there is no track number", () => {
      expect(titled("File:Stellardrone - Cepheid.ogg", "Stellardrone")).toBe("Cepheid");
    });

    test("drops a leading track number on its own", () => {
      expect(titled("File:07 - Bicycle.ogg", "Tardiss")).toBe("Bicycle");
    });

    test("leaves a title that does not carry either prefix", () => {
      expect(titled("File:Livery Stable Blues.ogg", "Original Dixieland Jass Band")).toBe(
        "Livery Stable Blues",
      );
    });

    test("does not strip an artist name that merely appears inside the title", () => {
      expect(titled("File:Ode to Scroach.ogg", "Scroach")).toBe("Ode to Scroach");
    });

    test("treats an artist name containing regex characters as a name", () => {
      // "Sunn O)))" is an unbalanced group; built into a pattern unescaped it
      // throws and takes the whole result list down with it.
      expect(titled("File:Sunn O))) - 02 - Aghartha.ogg", "Sunn O)))")).toBe("Aghartha");
    });

    test("matches an artist the filename spells without its punctuation", () => {
      // Real pair from Commons: the credit says "C. Scott", the filename can't.
      expect(titled("File:C Scott - 04 - Determinate.ogg", "C. Scott")).toBe("Determinate");
      expect(titled("File:Vanatei ft Semi - 17 - Barbie.ogg", "Vanatei ft. Semi")).toBe("Barbie");
    });

    test("keeps a trailing number that is part of the title", () => {
      expect(titled("File:Miles - 1959.ogg", "Miles")).toBe("1959");
      expect(titled("File:Take - 3 - Reprise.ogg", "Nobody")).toBe("Take - 3 - Reprise");
    });

    test("keeps the original rather than reducing a title to nothing", () => {
      expect(titled("File:Scroach.ogg", "Scroach")).toBe("Scroach");
      expect(titled("File:12.ogg", "Someone")).toBe("12");
    });
  });

  test("reduces the artist to text", () => {
    const [t] = parseSearchResponse(wrap([page()]));
    expect(t.artist).toBe("Hoving");
  });

  test("orders by search relevance, not by page id", () => {
    // `generator=search` returns pages in arbitrary order; relevance is in
    // `index`. Missing this produces a list that looks randomly shuffled.
    const out = parseSearchResponse(
      wrap([
        page({ pageid: 10, index: 3, title: "File:Third.ogg" }),
        page({ pageid: 11, index: 1, title: "File:First.ogg" }),
        page({ pageid: 12, index: 2, title: "File:Second.ogg" }),
      ]),
    );
    expect(out.map((t) => t.title)).toEqual(["First", "Second", "Third"]);
  });

  test("keeps the id unique across providers", () => {
    const [t] = parseSearchResponse(wrap([page({ pageid: 42 })]));
    expect(t.id).toBe("wikimedia:42");
  });

  test("carries the duration the filter runs on", () => {
    const [t] = parseSearchResponse(wrap([page()]));
    expect(t.durationSeconds).toBe(205.7);
  });

  describe("provider links", () => {
    const licenceUrlFrom = (value: string) =>
      parseSearchResponse(
        wrap([
          page(
            {},
            {
              extmetadata: {
                LicenseShortName: { value: "CC BY 3.0" },
                LicenseUrl: { value },
              },
            },
          ),
        ]),
      )[0].licence.url;

    test("keeps an ordinary deed url, http included", () => {
      // Most CC deed URLs recorded on Commons are still plain http.
      expect(licenceUrlFrom("http://creativecommons.org/licenses/by/3.0")).toBe(
        "http://creativecommons.org/licenses/by/3.0",
      );
    });

    test("refuses a script url, which uploader-authored wikitext can carry", () => {
      // Harmless while nothing renders it as an href — and stored XSS the
      // first time somebody adds the obvious "what licence is this?" link.
      expect(licenceUrlFrom("javascript:alert(1)")).toBe(null);
      expect(licenceUrlFrom("data:text/html,<script>alert(1)</script>")).toBe(null);
      expect(licenceUrlFrom("not a url")).toBe(null);
    });

    test("falls back to a known-good source url when the given one is unusable", () => {
      const [t] = parseSearchResponse(
        wrap([page({ pageid: 7 }, { descriptionurl: "javascript:alert(1)" })]),
      );
      expect(t.sourceUrl).toBe("https://commons.wikimedia.org/?curid=7");
    });
  });

  test("survives a response with no pages at all", () => {
    expect(parseSearchResponse({})).toEqual([]);
    expect(parseSearchResponse(wrap([]))).toEqual([]);
    expect(parseSearchResponse(null)).toEqual([]);
  });
});

describe("attribution inference", () => {
  const withMeta = (extmetadata: Record<string, unknown>) =>
    parseSearchResponse(wrap([page({}, { extmetadata })]))[0].licence;

  test("believes Commons when it says attribution is required", () => {
    expect(
      withMeta({
        LicenseShortName: { value: "CC BY 3.0" },
        AttributionRequired: { value: "true" },
      }).attributionRequired,
    ).toBe(true);
  });

  test("believes Commons when it says it is not", () => {
    expect(
      withMeta({ LicenseShortName: { value: "CC0" }, AttributionRequired: { value: "false" } })
        .attributionRequired,
    ).toBe(false);
  });

  test("infers no credit owed for public domain when Commons is silent", () => {
    expect(withMeta({ LicenseShortName: { value: "Public domain" } }).attributionRequired).toBe(
      false,
    );
    expect(withMeta({ LicenseShortName: { value: "CC0" } }).attributionRequired).toBe(false);
  });

  test("errs towards crediting when it cannot tell", () => {
    // Naming someone who did not need naming costs nothing. Failing to name
    // someone who did is the actual failure.
    expect(withMeta({ LicenseShortName: { value: "CC BY-SA 4.0" } }).attributionRequired).toBe(
      true,
    );
    expect(withMeta({}).attributionRequired).toBe(true);
  });
});

describe("buildSearchExpression", () => {
  test("browses a genre's category", () => {
    expect(buildSearchExpression({ genre: "jazz" })).toBe(
      'filetype:audio incategory:"Jazz music from Free Music Archive"',
    );
  });

  test("searches within a genre when both are given", () => {
    expect(buildSearchExpression({ genre: "jazz", text: "piano" })).toBe(
      'filetype:audio incategory:"Jazz music from Free Music Archive" piano',
    );
  });

  test("ignores a genre it does not know rather than injecting it", () => {
    expect(buildSearchExpression({ genre: 'x" OR 1=1' })).toBe("filetype:audio");
  });

  test("strips quotes, which are search syntax", () => {
    expect(buildSearchExpression({ text: 'say "hi"' })).toBe("filetype:audio say hi");
  });

  test("strips the operators that make an expensive upstream query", () => {
    // `insource:` with a regex is the class of search Wikimedia rate-limits,
    // and every seller here shares one User-Agent — so one person pasting this
    // would get the library throttled for all of them.
    expect(buildSearchExpression({ text: "insource:/(a|a)*b/" })).toBe(
      "filetype:audio insource a a b",
    );
    expect(buildSearchExpression({ text: "intitle:foo" })).toBe("filetype:audio intitle foo");
  });

  test("leaves an ordinary search of punctuated words alone", () => {
    expect(buildSearchExpression({ text: "don't stop" })).toBe("filetype:audio don't stop");
    // Unbalanced brackets would otherwise make CirrusSearch reject the query
    // outright, so someone typing "(remix" would see an error, not results.
    expect(buildSearchExpression({ text: "(remix" })).toBe("filetype:audio remix");
  });

  test("a genre chip still constrains a query that tried to escape it", () => {
    expect(buildSearchExpression({ genre: "jazz", text: 'incategory:"Something else"' })).toBe(
      'filetype:audio incategory:"Jazz music from Free Music Archive" incategory Something else',
    );
  });

  test("an empty query still constrains to audio", () => {
    expect(buildSearchExpression({})).toBe("filetype:audio");
  });
});

describe("genre coverage", () => {
  test("ids are unique, since one is the selected key", () => {
    expect(new Set(SOUND_GENRES.map((g) => g.id)).size).toBe(SOUND_GENRES.length);
  });

  test("every genre resolves to a Free Music Archive category", () => {
    // The rest of Commons audio is pronunciations and animal noises; the FMA
    // import is the part that is actually music. A genre chip that fell
    // through to an untagged Commons search would quietly serve those.
    for (const g of SOUND_GENRES) {
      const expression = buildSearchExpression({ genre: g.id });
      expect(expression).toContain('incategory:"');
      expect(expression).toContain("from Free Music Archive");
    }
  });
});
