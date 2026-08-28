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

// 7+ digits, allowing spaces/dashes/dots/parens between them — catches phone
// numbers written as "0803 123 4567", "+234-803-123-4567", "(0803)1234567".
const PHONE_RE = /(?:\+?\d[\s.\-()]?){7,}\d/;

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
    PHONE_RE.test(text) ||
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
