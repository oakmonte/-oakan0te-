// Client-side password policy.
//
// This is a usability guard, NOT the enforcement boundary — anyone can call the
// Supabase auth endpoint directly and skip it. The real enforcement lives in
// the Supabase project's Auth settings (minimum length, required character
// classes, and HaveIBeenPwned leaked-password protection). Keep the two in
// sync; this file exists so the user finds out before submitting, not after.

export const MIN_PASSWORD_LENGTH = 10;

/** Passwords that pass a length/composition check but are still the first
 *  thing any credential-stuffing list tries. Deliberately short: the real
 *  breach-corpus check is HaveIBeenPwned, enabled server-side. */
const OBVIOUS = [
  "password",
  "passw0rd",
  "qwerty",
  "letmein",
  "welcome",
  "iloveyou",
  "admin123",
  "12345678",
  "123456789",
  "1234567890",
  "oakmonte",
];

export type PasswordVerdict = {
  ok: boolean;
  /** 0-4, for the strength meter. */
  score: number;
  label: string;
  /** What the user still needs to do. Empty when ok. */
  problems: string[];
};

function hasRun(value: string, length: number) {
  let run = 1;
  for (let i = 1; i < value.length; i++) {
    run = value[i] === value[i - 1] ? run + 1 : 1;
    if (run >= length) return true;
  }
  return false;
}

function isSequential(value: string, length: number) {
  let run = 1;
  for (let i = 1; i < value.length; i++) {
    const step = value.charCodeAt(i) - value.charCodeAt(i - 1);
    run = step === 1 || step === -1 ? run + 1 : 1;
    if (run >= length) return true;
  }
  return false;
}

/** `identifiers` are things the attacker already knows — the email and chosen
 *  username. A password derived from them is worthless against a targeted
 *  guess, which is the realistic threat for a seller account holding payouts. */
export function checkPassword(password: string, identifiers: string[] = []): PasswordVerdict {
  const problems: string[] = [];
  const lower = password.toLowerCase();

  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password));
  if (classes.length < 3) {
    problems.push("a mix of upper case, lower case, numbers or symbols");
  }

  if (OBVIOUS.some((word) => lower.includes(word))) {
    problems.push("something less guessable than a common password");
  }

  for (const raw of identifiers) {
    const id = raw?.trim().toLowerCase();
    if (!id) continue;
    const local = id.split("@")[0];
    if (local.length >= 3 && lower.includes(local)) {
      problems.push("something that isn't your email or username");
      break;
    }
  }

  if (hasRun(password, 4) || isSequential(password, 5)) {
    problems.push("fewer repeated or sequential characters");
  }

  // Score is for the meter only; `ok` is what gates submission.
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 14) score++;
  if (classes.length >= 3) score++;
  if (classes.length === 4) score++;
  if (problems.length) score = Math.min(score, 1);

  const label = ["Too weak", "Weak", "Fair", "Good", "Strong"][score] ?? "Too weak";

  return { ok: problems.length === 0, score, label, problems };
}
