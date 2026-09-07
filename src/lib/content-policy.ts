// What a post is not allowed to say.
//
// Oakmonte holds the money, the size chart, the dispute and the payout. A post
// that sends someone to a DM, a phone number or another app takes the buyer
// out of all of that — and it is the buyer, not the seller, who loses the
// protection. So the rule is: a post can sell anything, but it cannot point
// off the platform to do it.
//
// This is deliberately ONE module rather than a check per screen. The text
// tool is shared by the after-shot editor, the photo editor and the video
// editor, and a rule that lives in three places is a rule that will mean three
// different things within a month.
//
// It refuses; it never edits. Silently deleting what somebody typed is the
// worst version of this feature — they retype it, it vanishes again, and
// nothing on screen ever says why. Every caller shows the message.

export type BlockedKind = "link" | "email" | "phone" | "handle" | "platform" | "contact";

export type BlockedFinding = {
  kind: BlockedKind;
  /** The text that tripped it, for a message that can point at something. */
  match: string;
};

/** Our own links are fine — a post pointing at an Oakmonte product page is the
 *  opposite of the problem. Masked before anything else runs so the domain
 *  check never sees it. */
const OWN_DOMAIN = /\b(?:[a-z0-9-]+\.)*oakmonte\.[a-z]{2,}\b/gi;

const EMAIL = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/gi;

const EXPLICIT_URL = /\b(?:https?:\/\/|www\.)\S+/gi;

// A bare domain needs a real TLD behind it, or every decimal and abbreviation
// in the language becomes a link. This list is the common ones plus the ones
// that actually get used for shopfronts and short links.
const TLDS = [
  "com",
  "net",
  "org",
  "co",
  "io",
  "me",
  "ng",
  "uk",
  "us",
  "eu",
  "shop",
  "store",
  "app",
  "link",
  "bio",
  "xyz",
  "info",
  "biz",
  "online",
  "site",
  "page",
  "tv",
  "cc",
  "ly",
  "gg",
  "to",
  "be",
  "ru",
  "de",
  "fr",
  "es",
  "it",
  "ca",
  "au",
  "za",
  "ke",
  "gh",
  "fashion",
  "boutique",
];
const BARE_DOMAIN = new RegExp(
  `\\b[a-z0-9][a-z0-9-]*\\.(?:${TLDS.join("|")})\\b(?:\\/\\S*)?`,
  "gi",
);

/** `@` plus a handle. Runs after emails are masked, so an address can't be
 *  reported twice for the same characters. */
const HANDLE = /@[a-z0-9._]{2,30}/gi;

// The named ones, plus the short forms of the same words — "insta" is no more
// a new rule than "ig" is, and "whats app" is how half of people spell it.
//
// What is deliberately NOT here is as considered as what is. "snap" on its own
// stays out: this is a clothing marketplace and snap buttons, snap fastenings
// and snapped photos are all ordinary things to write. Same for "tg" and "wa"
// — two letters is not enough signal to accuse someone of anything. wa.me and
// t.me links are already caught as links, which is how those actually get
// shared anyway.
const PLATFORM =
  /\b(?:instagram|insta|ig|tiktok|tik\s?tok|whats\s?app|snap\s?chat|telegram|facebook)\b/gi;

/** Asking to be reached elsewhere without naming where.
 *
 *  "DM me" doesn't mention a platform and contains no digits, so none of the
 *  other patterns see it — and it is the single most common way this actually
 *  gets written. */
const CONTACT_INTENT = /\b(?:dm\s?me|call\s?me|text\s?me)\b/gi;

/** Anything that looks like it could be dialled. */
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{6,}\d/g;

/** Is this run of digits a phone number, or is it a price, a size run, a date?
 *
 *  Two tests, and the second is the one that earns its keep. Nine digits is
 *  past any realistic garment price (₦150,000,000 for a dress is not the case
 *  we are protecting). And requiring one unbroken group of four kills the
 *  false positive that would otherwise be constant here: "sizes 6 8 10 12 14
 *  16 18 20 22 24" is eleven digits and not a phone number, while every real
 *  number — 08012345678, +234 801 234 5678 — has a four-run in it somewhere. */
function looksDialable(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return false;
  const longestRun = raw.split(/\D+/).reduce((max, group) => Math.max(max, group.length), 0);
  return longestRun >= 4;
}

/** Replace every match with spaces so later passes can't re-report the same
 *  characters under a different heading, and so offsets stay put. */
function sweep(
  text: string,
  pattern: RegExp,
  kind: BlockedKind | null,
  found: BlockedFinding[],
  accept?: (match: string) => boolean,
): string {
  return text.replace(pattern, (match) => {
    if (accept && !accept(match)) return match;
    if (kind) found.push({ kind, match: match.trim() });
    return " ".repeat(match.length);
  });
}

export type ContentPolicyOptions = {
  /** Allow a bare `@name`.
   *
   *  True only for the post caption, where `@` is Oakmonte's own mention
   *  affordance — the publish screen has a button that types one. Blocking it
   *  there would break a shipped feature to enforce a rule about other
   *  platforms. A handle next to "ig" or "instagram" is still refused, because
   *  the platform word is caught on its own. */
  allowHandles?: boolean;
};

/** Everything in `text` that a post isn't allowed to carry. Empty means fine. */
export function findBlockedContent(
  text: string,
  { allowHandles = false }: ContentPolicyOptions = {},
): BlockedFinding[] {
  if (!text.trim()) return [];
  const found: BlockedFinding[] = [];

  // Order matters: the allowlist first, then the patterns that contain other
  // patterns (an email holds a domain; a URL holds one too).
  let rest = sweep(text, OWN_DOMAIN, null, found);
  rest = sweep(rest, EMAIL, "email", found);
  rest = sweep(rest, EXPLICIT_URL, "link", found);
  rest = sweep(rest, BARE_DOMAIN, "link", found);
  rest = sweep(rest, PHONE_CANDIDATE, "phone", found, looksDialable);
  if (!allowHandles) rest = sweep(rest, HANDLE, "handle", found);
  rest = sweep(rest, PLATFORM, "platform", found);
  sweep(rest, CONTACT_INTENT, "contact", found);

  return found;
}

const LABELS: Record<BlockedKind, string> = {
  link: "links",
  email: "email addresses",
  phone: "phone numbers",
  handle: "usernames",
  platform: "other apps",
  contact: "ways to be reached elsewhere",
};

/** One sentence naming what has to come out, and why. The why matters: told
 *  only that something is "not allowed", a seller reads it as the app being
 *  broken or petty rather than as the thing that makes buyers trust them. */
export function blockedContentMessage(found: BlockedFinding[]): string {
  if (found.length === 0) return "";
  const kinds = [...new Set(found.map((f) => f.kind))].map((k) => LABELS[k]);
  const list =
    kinds.length === 1
      ? kinds[0]
      : `${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}`;
  return `Take out the ${list} — buying and selling stays on Oakmonte, where you and the buyer are both covered.`;
}
