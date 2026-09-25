// The rules for a personal username, shared by /choose-username (first pick)
// and /edit-profile (a later change). They used to live only in the onboarding
// step, so edit-profile ran a looser slugify of its own and would happily save
// "a", "admin" or "x." — names onboarding refuses.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

// This becomes the /profile/$username URL, so it has to survive being a path
// segment. Before, the field accepted spaces, capitals, "@" and emoji.
const USERNAME_RE = /^[a-z0-9][a-z0-9_.]*[a-z0-9]$/;

const RESERVED = new Set([
  "admin",
  "api",
  "oakmonte",
  "support",
  "help",
  "settings",
  "store",
  "profile",
  "create",
  "studio",
  "activity",
  "home",
  "terms",
  "privacy",
  "signin",
  "sign-in",
  "signup",
  "me",
  "you",
  "null",
  "undefined",
]);

/** Applied as the user types, so the field can never hold something the rules
 *  would reject on submit. */
export function normalizeUsername(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, USERNAME_MAX);
}

export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN) return `Usernames need at least ${USERNAME_MIN} characters.`;
  if (!USERNAME_RE.test(username))
    return "Use letters and numbers — underscores and dots can go in the middle.";
  if (RESERVED.has(username)) return "That username is reserved. Try another.";
  return null;
}
