// Typo-tolerant matching for the form's preset pickers (materials, colours).
//
// A seller typing on a phone misses letters, and these lists are full of
// words that are easy to get slightly wrong — "chifon", "polyster", "sterlin
// silver", "corderoy". An exact `includes` filter answers those with an empty
// screen, which reads as "we don't have it" and pushes them into typing a
// one-off spelling that then never matches the GSM table (see
// product-form/CLAUDE.md on why the spelling is load-bearing).
//
// Deliberately not a dependency: this is ~60 lines against a ~90-item list,
// and bunfig.toml's supply-chain guard means adding a fuzzy-search package is
// a decision to take explicitly, not a shortcut.

/** Lowercases, strips accents and punctuation, collapses whitespace. Accent
 *  stripping matters in both directions: a seller typing "pique" should find
 *  a "Piqué" entry, and one typing "Piqué" should find the "Pique" preset. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Levenshtein, capped: once every cell in a row exceeds `max` the answer can
// only grow, so it bails instead of finishing the matrix.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

// How wrong a query is allowed to be, by its length.
//
// Short queries get no typo budget at all: at 3 characters a single edit
// reaches a large share of the list, so "red" would start matching "bed",
// "rod" and "reed" — noise that buries the exact answer the seller almost
// certainly meant.
//
// Capped at 2 rather than scaling with length. A 3-edit budget let
// "vibranium" match "Titanium", which is a third of the word wrong and reads
// as the search being broken. Real typos in these lists are one or two
// characters ("polyster", "corderoy", "sterlin silver" are all a single
// edit), so the extra latitude bought nothing and cost precision.
function tolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 5) return 1;
  return 2;
}

function isSubsequence(query: string, candidate: string): boolean {
  let i = 0;
  for (const ch of candidate) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

/** Lower is a better match; `null` means no match at all. The bands are
 *  ordered so an exact or prefix hit always outranks a typo correction —
 *  typing "cotton" must never rank "Cotton blend" above "Cotton". */
export function fuzzyScore(rawQuery: string, rawCandidate: string): number | null {
  const query = normalizeForSearch(rawQuery);
  const candidate = normalizeForSearch(rawCandidate);
  if (!query) return 0;
  if (!candidate) return null;

  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;

  const words = candidate.split(" ");
  if (words.some((w) => w.startsWith(query))) return 2;
  if (candidate.includes(query)) return 3;

  const tol = tolerance(query.length);
  if (tol > 0) {
    const whole = editDistance(query, candidate, tol);
    if (whole <= tol) return 4 + whole;
    for (const word of words) {
      const d = editDistance(query, word, tol);
      if (d <= tol) return 7 + d;
    }
  }

  // Last resort: initials and heavy abbreviations ("stnls stl", "sterlingsl").
  if (query.length >= 3 && isSubsequence(query, candidate)) return 11;
  return null;
}

/** Filters and ranks, keeping the original order among equally-good matches
 *  so a curated list stays in its curated order until the query says
 *  otherwise. An empty query returns everything, unchanged. */
export function fuzzyFilter<T>(query: string, items: T[], toText: (item: T) => string): T[] {
  if (!normalizeForSearch(query)) return items;
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(query, toText(item)) }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.item);
}
