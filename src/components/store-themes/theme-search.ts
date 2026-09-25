import { fuzzyScore, normalizeForSearch } from "@/lib/fuzzy-search";

type Searchable = {
  name: string;
  eyebrow: string;
  description: string;
  moods: string[];
  colors: string[];
};

export type ThemeMatch<T> = {
  theme: T;
  /** The colour/mood keywords the query hit, in query order. This is what the
   * picker shows under each card ("red · bold") so a seller can see WHY a
   * theme came up. A hit on the name alone adds nothing here, because the
   * name is already printed on the card. */
  matched: string[];
};

// Filler a seller types around the words that matter: "something dark and
// moody" has to search for "dark" and "moody", and "black background" for
// "black". A query of nothing but filler is treated as empty rather than
// searched, since "the" matching a dozen descriptions is noise.
const FILLER = new Set([
  "a",
  "an",
  "and",
  "the",
  "with",
  "for",
  "of",
  "in",
  "on",
  "or",
  "some",
  "something",
  "kind",
  "vibe",
  "vibes",
  "theme",
  "themes",
  "store",
  "look",
  "looking",
  "feel",
  "feeling",
  "very",
  "really",
  "i",
  "want",
  "like",
  "my",
  "one",
  "please",
  "colour",
  "color",
  "colours",
  "colors",
  "coloured",
  "colored",
  "background",
  "backgrounds",
  "bg",
  "accent",
  "accents",
  "mode",
  "tone",
  "toned",
  "shade",
]);

// Words people use that no theme spells, mapped onto one that some theme
// does. Spelling variants ("gray", "creme") must not depend on the typo
// fallback, because that fallback switches off whenever anything matches
// the word exactly. The rest are everyday ways of saying a keyword the
// catalogue already has ("nude" is beige, "pale" is pastel).
const SYNONYMS: Record<string, string> = {
  gray: "grey",
  greys: "grey",
  grays: "grey",
  cozy: "cosy",
  creme: "cream",
  creamy: "cream",
  // "lux", not "luxury": it prefixes all three of luxe, luxury and
  // luxurious, which the catalogue uses interchangeably.
  luxe: "lux",
  fancy: "lux",
  expensive: "lux",
  classy: "elegant",
  chic: "elegant",
  nude: "beige",
  pale: "pastel",
  simple: "minimal",
  minimalist: "minimal",
  cute: "playful",
  girly: "feminine",
  colorful: "bright",
  colourful: "bright",
  goth: "dark",
  gothic: "dark",
  boho: "earthy",
  sea: "blue",
  ocean: "blue",
  sunset: "orange",
  summer: "bright",
};

// Matched only against each theme's own "dark"/"light" tag (types.ts, from
// its background), never its name or copy: those words are what replaced the
// Light/Dark chips, and a near-black theme whose description says "catch the
// light" is not a light theme.
const TONE = new Set(["dark", "light"]);

// fuzzyScore's bands, as used here: 0-3 exact/prefix/contains, 4-10 typo
// corrections, 11 the loose subsequence fallback.
//
// Keywords and names take typos (a seller typing "burgandy" still means
// Burgundy) but never the subsequence fallback: that is how "red" matched
// "refined". They also skip band 3 (contains), since "red" is inside
// "structured". The eyebrow and description are prose, so they take only a
// whole word or a word prefix: a substring hit there is how "red" used to find
// every theme whose copy said "considered" or "tailored".
//
// Typos are a fallback, never a supplement. If ANY theme has a real hit on a
// word, typo corrections of that word are dropped across the whole catalogue,
// or "gold" drags in every "bold" and "cold" theme. When typos do apply, only
// the closest correction in the catalogue counts, so a word one letter from
// two different keywords doesn't show a chip for the wrong one.
const MAX_STRICT_SCORE = 2;
const MAX_KEYWORD_SCORE = 10;

function strictScore(token: string, text: string): number | null {
  const s = fuzzyScore(token, text);
  return s !== null && s <= MAX_STRICT_SCORE ? s : null;
}

function typoScore(token: string, text: string): number | null {
  const s = fuzzyScore(token, text);
  return s !== null && s >= 4 && s <= MAX_KEYWORD_SCORE ? s : null;
}

type WordHit = { score: number; keyword: string | null };

/** Filters and ranks themes for the picker's search box. Every meaningful
 *  word in the query has to hit something (a colour, a mood, the name, or a
 *  word of the copy), so "dark red" narrows rather than widens. A multi-word
 *  colour typed whole ("light blue", "forest green") ranks the theme that has
 *  exactly that colour first. Best matches come first, and ties keep the
 *  catalogue's own order. An empty query returns everything, unchanged and
 *  with nothing marked as matched. */
export function searchThemes<T extends Searchable>(query: string, themes: T[]): ThemeMatch<T>[] {
  const everything = () => themes.map((theme) => ({ theme, matched: [] }));
  const words = normalizeForSearch(query)
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .map((w) => SYNONYMS[w] ?? w);
  if (words.length === 0) return everything();

  // Multi-word colours present in the query, longest first, pulled out as
  // one unit. The words stay in the query too: a theme without that exact
  // colour can still match them one by one, it just ranks below.
  const phrases = [
    ...new Set(
      themes.flatMap((t) => t.colors.map(normalizeForSearch).filter((c) => c.includes(" "))),
    ),
  ].sort((a, b) => b.length - a.length);
  const joined = ` ${words.join(" ")} `;
  const queryPhrases = phrases.filter((p) => joined.includes(` ${p} `));

  const keywordsOf = (theme: T) => [...theme.colors, ...theme.moods];

  // Per word: does anything match it strictly? If not, which typo distance
  // is the closest the catalogue gets? See the note on MAX_STRICT_SCORE.
  const typoBand = new Map<string, number | null>();
  for (const word of new Set(words)) {
    if (TONE.has(word)) continue;
    const strict = themes.some(
      (t) =>
        [...keywordsOf(t), t.name].some((k) => strictScore(word, k) !== null) ||
        strictScore(word, t.eyebrow) !== null ||
        strictScore(word, t.description) !== null,
    );
    if (strict) {
      typoBand.set(word, null);
      continue;
    }
    let closest: number | null = null;
    for (const t of themes) {
      for (const k of [...keywordsOf(t), t.name]) {
        const s = typoScore(word, k);
        if (s !== null && (closest === null || s < closest)) closest = s;
      }
    }
    typoBand.set(word, closest);
  }

  function scoreWord(word: string, theme: T): WordHit | null {
    if (TONE.has(word)) {
      return theme.colors.includes(word) ? { score: 0, keyword: word } : null;
    }
    const band = typoBand.get(word) ?? null;
    const score = (text: string) => {
      const strict = strictScore(word, text);
      if (strict !== null) return strict;
      if (band === null) return null;
      return typoScore(word, text) === band ? band : null;
    };

    let best: WordHit | null = null;
    for (const keyword of keywordsOf(theme)) {
      const s = score(keyword);
      if (s !== null && (best === null || s < best.score)) best = { score: s, keyword };
    }
    const rawName = score(theme.name);
    if (rawName !== null) {
      // An exact or corrected name hit edges ahead of an equal keyword hit:
      // "burgundy" is a colour on Bordeaux and Merlot too, and the theme
      // called Burgundy has to come first. A name that merely STARTS with the
      // word edges behind instead, or "blu" puts Blush above every blue
      // theme. The name is on the card, so a name hit adds no chip.
      const nameScore = rawName === 1 || rawName === 2 ? rawName + 0.25 : rawName - 0.25;
      if (best === null || nameScore < best.score) best = { score: nameScore, keyword: null };
    }
    for (const prose of [theme.eyebrow, theme.description]) {
      const s = strictScore(word, prose);
      // Prose ranks below an equal keyword hit, since the keywords are the
      // curated answer and the copy only happens to contain the word.
      if (s !== null && (best === null || s + 0.5 < best.score)) {
        best = { score: s + 0.5, keyword: null };
      }
    }
    return best;
  }

  const results: { theme: T; matched: string[]; score: number; index: number }[] = [];
  themes.forEach((theme, index) => {
    const matched: string[] = [];
    let total = 0;

    // A whole-phrase colour hit covers its words, and is worth more than
    // matching them separately.
    const covered = new Set<string>();
    const colors = theme.colors.map(normalizeForSearch);
    for (const phrase of queryPhrases) {
      const i = colors.indexOf(phrase);
      if (i === -1) continue;
      total -= 1;
      matched.push(theme.colors[i]);
      for (const w of phrase.split(" ")) covered.add(w);
    }

    for (const word of words) {
      if (covered.has(word)) continue;
      const hit = scoreWord(word, theme);
      if (!hit) return; // this word hit nothing, so the theme is out
      total += hit.score;
      if (hit.keyword && !matched.includes(hit.keyword)) matched.push(hit.keyword);
    }

    results.push({ theme, matched, score: total, index });
  });

  return results
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ theme, matched }) => ({ theme, matched }));
}
