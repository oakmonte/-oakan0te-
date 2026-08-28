// Heuristic guardrails for seller-authored free text (product descriptions,
// etc.) — blocks profanity and off-platform contact info so buyers stay
// inside Oakmonte's own chat/checkout instead of being steered to DM/call a
// seller directly. Deliberately conservative: false negatives are fine,
// false positives block a legitimate seller from saving their listing.

const PROFANITY = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "cunt",
  "nigger",
  "nigga",
  "whore",
  "slut",
  "motherfucker",
];

const PROFANITY_RE = new RegExp(`\\b(${PROFANITY.join("|")})\\b`, "i");

// Digit runs, split on whitespace/dot/dash into groups (so "0803 123 4567"
// -> ["0803","123","4567"]). A run only reads as phone-shaped if it's either
// one unbroken block of 7+ digits ("08031234567"), or several groups that
// together hit 7+ digits AND include at least one 3+-digit group — real
// phone numbers chunk into groups of 3-4, which is what actually separates
// "0803 123 4567" from a uniform two-digit size list like "38 39 40 41 42
// 43". A strictly ascending/descending run of groups (sizes, a measurement
// table) is never flagged even if it happens to hit those two conditions —
// phone digits aren't a sorted sequence, so this costs no real detection.
const PHONE_GROUP_RE = /\+?\d{7,}|\+?\d{1,4}(?:[\s.-]\d{1,4})+/g;

function isSortedSequence(groups: string[]): boolean {
  if (groups.length < 3) return false;
  const nums = groups.map(Number);
  const ascending = nums.every((n, i) => i === 0 || n > nums[i - 1]);
  const descending = nums.every((n, i) => i === 0 || n < nums[i - 1]);
  return ascending || descending;
}

function hasPhoneNumber(text: string): boolean {
  const matches = text.match(PHONE_GROUP_RE) ?? [];
  return matches.some((m) => {
    const groups = m.split(/[\s.-]+/).filter(Boolean);
    const digitTotal = groups.reduce((n, g) => n + g.replace(/\D/g, "").length, 0);
    const hasChunkyGroup = groups.some((g) => g.replace(/\D/g, "").length >= 3);
    if (digitTotal < 7) return false;
    if (groups.length > 1 && !hasChunkyGroup) return false;
    if (isSortedSequence(groups)) return false;
    return true;
  });
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// @handle style social mentions.
const HANDLE_RE = /(^|[\s(])@[a-z0-9_.]{2,}/i;

const CONTACT_APP_RE =
  /\b(whatsapp|wa\.me|telegram|t\.me|snapchat|snap\s?chat|instagram|facebook|dm me|call me|text me)\b/i;

// Bare domains/URLs pointing off-platform (oakmonte.store itself is fine).
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
const DOMAIN_RE = /\b[a-z0-9-]+\.(com|net|ng|shop|co|io|me|link)\b/i;

export type PolicyViolation = "profanity" | "contact-info";

export function checkTextPolicy(text: string): PolicyViolation | null {
  if (PROFANITY_RE.test(text)) return "profanity";
  if (
    EMAIL_RE.test(text) ||
    hasPhoneNumber(text) ||
    HANDLE_RE.test(text) ||
    CONTACT_APP_RE.test(text) ||
    URL_RE.test(text) ||
    (DOMAIN_RE.test(text) && !/oakmonte\.store/i.test(text))
  ) {
    return "contact-info";
  }
  return null;
}

export function policyViolationMessage(violation: PolicyViolation): string {
  switch (violation) {
    case "profanity":
      return "Please remove inappropriate language before saving.";
    case "contact-info":
      return "Phone numbers, emails, usernames, and links to other platforms aren't allowed here.";
  }
}
