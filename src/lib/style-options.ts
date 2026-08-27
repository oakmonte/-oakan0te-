// Curated seed options for /whats-your-style. Grouped by category so the page
// can render three chip clusters instead of one long undifferentiated list —
// fashion, cosmetics and art cover the three kinds of creator/curator work
// the recommendation algorithm needs to distinguish between.

export type StyleCategory = "Fashion" | "Cosmetics" | "Art";

export const STYLE_CATEGORIES: Record<StyleCategory, readonly string[]> = {
  Fashion: [
    "Streetwear",
    "Minimalist",
    "Old Money",
    "Vintage",
    "Bohemian",
    "Preppy",
    "Grunge",
    "Y2K",
    "Techwear",
    "Cottagecore",
    "Punk",
    "Business Casual",
    "Avant-Garde",
    "Athleisure",
    "Coastal",
    "Maximalist",
  ],
  Cosmetics: [
    "Clean Girl",
    "Soft Glam",
    "Full Glam",
    "Editorial",
    "Korean Beauty",
    "Bold Color",
    "No-Makeup Makeup",
    "Dark/Gothic",
    "Bridal",
    "Graphic Liner",
  ],
  Art: [
    "Illustration",
    "Photography",
    "Digital Art",
    "Painting",
    "Graphic Design",
    "Mixed Media",
    "Sculpture",
    "Fashion Illustration",
    "Textile & Pattern",
    "Street Art",
  ],
};

// A short blocklist, not an exhaustive profanity filter — this only exists to
// stop the obvious cases (slurs, common swears) from landing in a field that
// feeds recommendations and is visible to other users. Anything sneakier than
// this needs real moderation, which doesn't exist yet — see the onboarding
// audit notes for that gap.
const BLOCKED_TERMS = new Set([
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "whore",
  "slut",
  "rape",
  "porn",
  "sex",
  "nazi",
  "kill",
]);

/** Custom style entries are free text, so this exists to keep out anything
 *  that obviously isn't a style/aesthetic name — profanity, numbers-only
 *  strings, URLs, single letters — without pretending to be a full content
 *  moderation system. */
export function validateCustomStyle(
  raw: string,
  existing: readonly string[],
): { ok: true; value: string } | { ok: false; reason: string } {
  const value = raw.trim().replace(/\s+/g, " ");

  if (value.length < 2) return { ok: false, reason: "Too short." };
  if (value.length > 30) return { ok: false, reason: "Keep it under 30 characters." };
  if (!/^[a-zA-Z][a-zA-Z\s&/-]*$/.test(value)) {
    return { ok: false, reason: "Letters only, please." };
  }

  const lower = value.toLowerCase();
  const words = lower.split(/[\s/&-]+/);
  if (words.some((w) => BLOCKED_TERMS.has(w))) {
    return { ok: false, reason: "That word isn't allowed." };
  }

  if (existing.some((e) => e.toLowerCase() === lower)) {
    return { ok: false, reason: "Already added." };
  }

  return { ok: true, value };
}
