// Discount codes: the rules, kept pure so the seller screen, the public
// validate route and order creation all apply exactly the same arithmetic.
// Two copies of a money rule is one copy too many (see pricing-fees.ts).
//
// Money here is integer kobo throughout, matching the orders tables. Nothing
// in this file trusts the browser: the server runs validateDiscount again with
// its own subtotal before an order is priced.

export type DiscountKind = "percent" | "fixed";

/** A discount_codes row, as the server reads it. */
export type DiscountCode = {
  id: string;
  store_id: string;
  code: string;
  kind: DiscountKind;
  percent_off: number | null;
  amount_off_kobo: number | null;
  min_order_kobo: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
  created_at: string;
};

/** The columns the rules actually read. */
export type DiscountTerms = Pick<
  DiscountCode,
  | "kind"
  | "percent_off"
  | "amount_off_kobo"
  | "min_order_kobo"
  | "starts_at"
  | "ends_at"
  | "usage_limit"
  | "used_count"
  | "active"
>;

export const CODE_MIN_LENGTH = 3;
export const CODE_MAX_LENGTH = 20;
export const PERCENT_MIN = 1;
// Capped below 100 so a typo can't give a store's whole catalogue away.
export const PERCENT_MAX = 90;
// orders.items_total_kobo is a Postgres integer (max ~2.1bn kobo, ₦21.4m), so
// no amount we accept may be larger than an order could ever be.
export const MAX_AMOUNT_KOBO = 2_000_000_000;
export const MAX_USAGE_LIMIT = 1_000_000;

// Same rule as the CHECK on discount_codes.code. Letters, digits and inner
// dashes only: no spaces to mistype, and none of the characters that are
// wildcards in a SQL LIKE.
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$/;

/** Upper case, no whitespace, no invisible characters. A code pasted out of a
 *  WhatsApp message often carries a zero-width space or a trailing newline,
 *  and buyers type codes in whatever case their keyboard is in. */
export function normaliseCode(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}

/** Why a (normalised) code can't be used, in the seller's words, or null. */
export function codeProblem(code: string): string | null {
  if (code.length === 0) return "Enter a code, or generate one";
  if (code.length < CODE_MIN_LENGTH) return `Codes need at least ${CODE_MIN_LENGTH} characters`;
  if (code.length > CODE_MAX_LENGTH) return `Keep it to ${CODE_MAX_LENGTH} characters or fewer`;
  if (!/^[A-Z0-9-]+$/.test(code)) return "Use letters, numbers and dashes only";
  if (!CODE_RE.test(code)) return "A code can't start or end with a dash";
  return null;
}

// No I, L, O, 0 or 1: a code read aloud or copied by hand off a story
// shouldn't hinge on telling those apart.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function cryptoRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % max;
}

/** The store's name boiled down to a code-safe prefix, e.g. "Adunni & Co" ->
 *  "ADUNNICO". Empty when the name has nothing usable in it. */
export function codePrefixFromName(name: string | null | undefined): string {
  return normaliseCode(name ?? "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

/** A fresh random code, optionally after a prefix: "ADUNNI-7KQ2MX". */
export function generateCode(
  opts: { prefix?: string; length?: number; randomInt?: (max: number) => number } = {},
): string {
  const length = opts.length ?? 6;
  const randomInt = opts.randomInt ?? cryptoRandomInt;
  let suffix = "";
  for (let i = 0; i < length; i++) suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  // Trim the prefix rather than the random part when the whole would be too
  // long; the random part is what makes the code hard to guess.
  const prefix = codePrefixFromName(opts.prefix).slice(
    0,
    Math.max(0, CODE_MAX_LENGTH - length - 1),
  );
  return prefix ? `${prefix}-${suffix}` : suffix;
}

/** What a code takes off a subtotal, before any rule about whether it applies.
 *  Never negative and never more than the subtotal. */
export function discountAmountKobo(terms: DiscountTerms, subtotalKobo: number): number {
  let amount = 0;
  if (terms.kind === "percent") {
    const pct = terms.percent_off ?? 0;
    // Integer arithmetic, rounding half a kobo up: subtotal * pct / 100 in
    // floating point would put 0.1 + 0.2 style errors into money.
    amount = Math.floor((subtotalKobo * pct + 50) / 100);
  } else {
    amount = terms.amount_off_kobo ?? 0;
  }
  return Math.max(0, Math.min(subtotalKobo, amount));
}

export type DiscountRejection =
  | "inactive"
  | "not_started"
  | "expired"
  | "used_up"
  | "below_minimum"
  | "zero_amount"
  | "invalid_subtotal"
  | "misconfigured";

export type DiscountCheck =
  | { ok: true; amountKobo: number; reason: null }
  | { ok: false; amountKobo: 0; reason: DiscountRejection; minOrderKobo?: number };

function reject(reason: DiscountRejection, minOrderKobo?: number): DiscountCheck {
  return minOrderKobo === undefined
    ? { ok: false, amountKobo: 0, reason }
    : { ok: false, amountKobo: 0, reason, minOrderKobo };
}

function termsAreSound(t: DiscountTerms): boolean {
  if (t.kind === "percent") {
    return (
      Number.isInteger(t.percent_off) &&
      (t.percent_off as number) >= PERCENT_MIN &&
      (t.percent_off as number) <= PERCENT_MAX
    );
  }
  if (t.kind === "fixed") {
    return Number.isInteger(t.amount_off_kobo) && (t.amount_off_kobo as number) > 0;
  }
  return false;
}

/** Whether `terms` applies to an order of `subtotalKobo` at `now`, and for how
 *  much. The one place the rules live; the order route and the preview route
 *  both call it. */
export function validateDiscount(
  terms: DiscountTerms,
  { subtotalKobo, now }: { subtotalKobo: number; now: Date },
): DiscountCheck {
  if (!Number.isSafeInteger(subtotalKobo) || subtotalKobo < 0) return reject("invalid_subtotal");
  // A row the database constraints should have made impossible. Refuse it
  // rather than guess, so a bad row can never discount anything.
  if (!termsAreSound(terms)) return reject("misconfigured");
  if (!terms.active) return reject("inactive");
  const t = now.getTime();
  if (terms.starts_at && t < Date.parse(terms.starts_at)) return reject("not_started");
  if (terms.ends_at && t >= Date.parse(terms.ends_at)) return reject("expired");
  if (terms.usage_limit != null && terms.used_count >= terms.usage_limit) return reject("used_up");
  const min = Math.max(0, terms.min_order_kobo ?? 0);
  if (subtotalKobo < min) return reject("below_minimum", min);
  const amountKobo = discountAmountKobo(terms, subtotalKobo);
  if (amountKobo <= 0) return reject("zero_amount");
  return { ok: true, amountKobo, reason: null };
}

export const NOT_VALID_MESSAGE = "That code isn't valid.";

/** What to tell a BUYER about a check. Off, scheduled, expired and used-up
 *  codes all read as plain "not valid": telling them apart would let anyone
 *  probe which codes exist, and would leak a scheduled promo before launch.
 *  The minimum-spend message is the one exception, because it only fires for
 *  a code that is live right now -- exactly as much as a success reveals. */
export function buyerMessage(check: DiscountCheck): string | null {
  if (check.ok) return null;
  switch (check.reason) {
    case "below_minimum":
      return `Spend ${formatKobo(check.minOrderKobo ?? 0)} or more to use this code.`;
    case "zero_amount":
      return "This code doesn't take anything off this order.";
    default:
      return NOT_VALID_MESSAGE;
  }
}

/** "₦12,500" or "₦12,500.50". Hand-rolled rather than toLocaleString, whose
 *  output depends on the runtime's locale data. */
export function formatKobo(kobo: number): string {
  const sign = kobo < 0 ? "-" : "";
  const abs = Math.abs(Math.round(kobo));
  const naira = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = String(naira).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}₦${grouped}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
}

/** A naira amount as typed ("2,500", "₦2500.5") to kobo, or null when it
 *  isn't a plain amount. String-based so "0.29" can't become 28 kobo. */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const kobo = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(kobo) ? kobo : null;
}

/** The inverse, for prefilling an input: "2500" or "2500.50". */
export function koboToNairaInput(kobo: number | null | undefined): string {
  if (kobo == null || kobo <= 0) return "";
  const naira = Math.floor(kobo / 100);
  const rest = kobo % 100;
  return rest ? `${naira}.${String(rest).padStart(2, "0")}` : String(naira);
}

export type DiscountStatus = "active" | "scheduled" | "expired" | "used_up" | "off";

/** Where a code stands right now, for the seller's list. Ended (by date or by
 *  use) wins over the on/off switch: an expired code is expired whether or not
 *  it is also switched off, and the seller needs to see why it isn't working. */
export function discountStatus(terms: DiscountTerms, now: Date): DiscountStatus {
  const t = now.getTime();
  if (terms.ends_at && t >= Date.parse(terms.ends_at)) return "expired";
  if (terms.usage_limit != null && terms.used_count >= terms.usage_limit) return "used_up";
  if (!terms.active) return "off";
  if (terms.starts_at && t < Date.parse(terms.starts_at)) return "scheduled";
  return "active";
}

/** "20% off orders of ₦10,000 or more", "₦2,000 off any order". */
export function describeDiscount(
  terms: Pick<DiscountTerms, "kind" | "percent_off" | "amount_off_kobo" | "min_order_kobo">,
): string {
  const off =
    terms.kind === "percent"
      ? `${terms.percent_off ?? 0}% off`
      : `${formatKobo(terms.amount_off_kobo ?? 0)} off`;
  return terms.min_order_kobo > 0
    ? `${off} orders of ${formatKobo(terms.min_order_kobo)} or more`
    : `${off} any order`;
}

/** A create/update payload once it has passed parseDiscountInput. */
export type DiscountInput = {
  code: string;
  kind: DiscountKind;
  percentOff: number | null;
  amountOffKobo: number | null;
  minOrderKobo: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  active: boolean;
};

export type ParsedDiscountInput = { ok: true; value: DiscountInput } | { ok: false; error: string };

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v);
}

function parseMoment(v: unknown): { ok: true; iso: string | null } | { ok: false } {
  if (v === null || v === undefined || v === "") return { ok: true, iso: null };
  if (typeof v !== "string") return { ok: false };
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return { ok: false };
  return { ok: true, iso: new Date(ms).toISOString() };
}

/** Validates a seller's create/edit payload on the server. The browser runs
 *  the same checks for instant feedback, but this is the one that counts.
 *
 *  `previousEndsAt` is the stored end on an edit: an end date already in the
 *  past is refused for a new code (it would be born expired) but allowed to
 *  stay unchanged on an old one, so a seller can still fix the code's other
 *  fields after it has ended. */
export function parseDiscountInput(
  body: unknown,
  { now, previousEndsAt }: { now: Date; previousEndsAt?: string | null },
): ParsedDiscountInput {
  if (!body || typeof body !== "object") return { ok: false, error: "Bad request" };
  const b = body as Record<string, unknown>;

  const code = normaliseCode(typeof b.code === "string" ? b.code : "");
  const problem = codeProblem(code);
  if (problem) return { ok: false, error: problem };

  const kind = b.kind;
  if (kind !== "percent" && kind !== "fixed") {
    return { ok: false, error: "Choose a percentage or a fixed amount" };
  }

  let percentOff: number | null = null;
  let amountOffKobo: number | null = null;
  if (kind === "percent") {
    if (!isInt(b.percentOff) || b.percentOff < PERCENT_MIN || b.percentOff > PERCENT_MAX) {
      return {
        ok: false,
        error: `Percentage must be a whole number from ${PERCENT_MIN} to ${PERCENT_MAX}`,
      };
    }
    percentOff = b.percentOff;
  } else {
    if (!isInt(b.amountOffKobo) || b.amountOffKobo < 100) {
      return { ok: false, error: "Enter an amount of at least ₦1" };
    }
    if (b.amountOffKobo > MAX_AMOUNT_KOBO) return { ok: false, error: "That amount is too large" };
    amountOffKobo = b.amountOffKobo;
  }

  let minOrderKobo = 0;
  if (b.minOrderKobo !== undefined && b.minOrderKobo !== null) {
    if (!isInt(b.minOrderKobo) || b.minOrderKobo < 0) {
      return { ok: false, error: "The minimum order doesn't look right" };
    }
    if (b.minOrderKobo > MAX_AMOUNT_KOBO) return { ok: false, error: "That minimum is too large" };
    minOrderKobo = b.minOrderKobo;
  }

  const starts = parseMoment(b.startsAt);
  const ends = parseMoment(b.endsAt);
  if (!starts.ok) return { ok: false, error: "The start date doesn't look right" };
  if (!ends.ok) return { ok: false, error: "The end date doesn't look right" };
  if (starts.iso && ends.iso && Date.parse(ends.iso) <= Date.parse(starts.iso)) {
    return { ok: false, error: "The end has to be after the start" };
  }
  const endUnchanged =
    previousEndsAt != null &&
    ends.iso != null &&
    Date.parse(previousEndsAt) === Date.parse(ends.iso);
  if (ends.iso && Date.parse(ends.iso) <= now.getTime() && !endUnchanged) {
    return { ok: false, error: "The end date has already passed" };
  }

  let usageLimit: number | null = null;
  if (b.usageLimit !== undefined && b.usageLimit !== null) {
    if (!isInt(b.usageLimit) || b.usageLimit < 1 || b.usageLimit > MAX_USAGE_LIMIT) {
      return { ok: false, error: "Usage limit must be a whole number of 1 or more" };
    }
    usageLimit = b.usageLimit;
  }

  const active = typeof b.active === "boolean" ? b.active : true;

  return {
    ok: true,
    value: {
      code,
      kind,
      percentOff,
      amountOffKobo,
      minOrderKobo,
      startsAt: starts.iso,
      endsAt: ends.iso,
      usageLimit,
      active,
    },
  };
}
