import { describe, expect, test } from "bun:test";
import {
  buyerMessage,
  codePrefixFromName,
  codeProblem,
  describeDiscount,
  discountAmountKobo,
  discountStatus,
  formatKobo,
  generateCode,
  isValidCode,
  koboToNairaInput,
  normaliseCode,
  NOT_VALID_MESSAGE,
  parseDiscountInput,
  parseNairaToKobo,
  validateDiscount,
  type DiscountTerms,
} from "./discounts";

const NOW = new Date("2026-10-08T12:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() + hours * 3600_000).toISOString();

const percent = (pct: number, extra: Partial<DiscountTerms> = {}): DiscountTerms => ({
  kind: "percent",
  percent_off: pct,
  amount_off_kobo: null,
  min_order_kobo: 0,
  starts_at: null,
  ends_at: null,
  usage_limit: null,
  used_count: 0,
  active: true,
  ...extra,
});

const fixed = (kobo: number, extra: Partial<DiscountTerms> = {}): DiscountTerms => ({
  ...percent(10, extra),
  kind: "fixed",
  percent_off: null,
  amount_off_kobo: kobo,
  ...extra,
});

describe("normaliseCode", () => {
  test("upper-cases and strips whitespace anywhere", () => {
    expect(normaliseCode("  save 10\n")).toBe("SAVE10");
    expect(normaliseCode("summer-Sale")).toBe("SUMMER-SALE");
  });

  test("drops the invisible characters a pasted code drags along", () => {
    expect(normaliseCode("\u200BSAVE\u200D10\uFEFF")).toBe("SAVE10");
  });

  test("folds full-width characters to plain ones", () => {
    expect(normaliseCode("ＳＡＶＥ１０")).toBe("SAVE10");
  });
});

describe("code format", () => {
  test("accepts letters, digits and inner dashes from 3 to 20 characters", () => {
    expect(isValidCode("ABC")).toBe(true);
    expect(isValidCode("SUMMER-SALE-25")).toBe(true);
    expect(isValidCode("A".repeat(20))).toBe(true);
  });

  test("rejects the rest, with a reason a seller can act on", () => {
    expect(codeProblem("")).toMatch(/Enter a code/);
    expect(codeProblem("AB")).toMatch(/at least 3/);
    expect(codeProblem("A".repeat(21))).toMatch(/20 characters/);
    expect(codeProblem("SAVE_10")).toMatch(/letters, numbers and dashes/);
    expect(codeProblem("SAVE%")).toMatch(/letters, numbers and dashes/);
    expect(codeProblem("-SAVE")).toMatch(/start or end with a dash/);
    expect(codeProblem("SAVE-")).toMatch(/start or end with a dash/);
    expect(codeProblem("SAVE10")).toBeNull();
    expect(isValidCode("save10")).toBe(false);
  });
});

describe("generateCode", () => {
  test("uses only unambiguous characters and is always a valid code", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(6);
      expect(isValidCode(code)).toBe(true);
      expect(code).not.toMatch(/[ILO01]/);
    }
  });

  test("is driven by the random source it is given", () => {
    expect(generateCode({ randomInt: () => 0 })).toBe("AAAAAA");
    expect(generateCode({ randomInt: () => 0, length: 4 })).toBe("AAAA");
  });

  test("puts a cleaned store prefix in front", () => {
    expect(generateCode({ prefix: "Adunni & Co.", randomInt: () => 0 })).toBe("ADUNNICO-AAAAAA");
    expect(generateCode({ prefix: "&&&", randomInt: () => 0 })).toBe("AAAAAA");
  });

  test("trims the prefix, never the random part, to stay within 20 characters", () => {
    const code = generateCode({ prefix: "VERYLONGBRAND", length: 14, randomInt: () => 1 });
    expect(code.length).toBeLessThanOrEqual(20);
    expect(code.endsWith("B".repeat(14))).toBe(true);
    expect(isValidCode(code)).toBe(true);
  });

  test("drops the prefix entirely when the random part leaves no room", () => {
    expect(generateCode({ prefix: "BRAND", length: 19, randomInt: () => 0 })).toBe("A".repeat(19));
  });

  test("codePrefixFromName caps at 8 and copes with nothing", () => {
    expect(codePrefixFromName("Lagos Thrift Collective")).toBe("LAGOSTHR");
    expect(codePrefixFromName(null)).toBe("");
  });
});

describe("discountAmountKobo", () => {
  test("percent rounds to the nearest kobo, half up", () => {
    expect(discountAmountKobo(percent(10), 1_000_000)).toBe(100_000);
    // 15% of ₦333.33 = 4999.95 kobo -> 5000
    expect(discountAmountKobo(percent(15), 33_333)).toBe(5_000);
    // 10% of 5 kobo = 0.5 -> 1
    expect(discountAmountKobo(percent(10), 5)).toBe(1);
    // 10% of 4 kobo = 0.4 -> 0
    expect(discountAmountKobo(percent(10), 4)).toBe(0);
  });

  test("has no floating-point drift on awkward amounts", () => {
    // 0.29 * 100 is 28.999999999999996 in floating point.
    expect(discountAmountKobo(percent(29), 100)).toBe(29);
    expect(discountAmountKobo(percent(7), 2_999_999)).toBe(210_000);
  });

  test("fixed is capped at the subtotal, never below zero", () => {
    expect(discountAmountKobo(fixed(200_000), 1_000_000)).toBe(200_000);
    expect(discountAmountKobo(fixed(200_000), 150_000)).toBe(150_000);
    expect(discountAmountKobo(fixed(200_000), 0)).toBe(0);
    expect(discountAmountKobo(fixed(-500), 10_000)).toBe(0);
  });

  test("the biggest percent on the biggest order still fits in an integer", () => {
    const amount = discountAmountKobo(percent(90), 2_000_000_000);
    expect(amount).toBe(1_800_000_000);
    expect(Number.isSafeInteger(amount)).toBe(true);
  });
});

describe("validateDiscount", () => {
  const at = { subtotalKobo: 1_000_000, now: NOW };

  test("a plain live code applies", () => {
    expect(validateDiscount(percent(20), at)).toEqual({
      ok: true,
      amountKobo: 200_000,
      reason: null,
    });
    expect(validateDiscount(fixed(150_000), at)).toEqual({
      ok: true,
      amountKobo: 150_000,
      reason: null,
    });
  });

  test("switched off", () => {
    expect(validateDiscount(percent(20, { active: false }), at).reason).toBe("inactive");
  });

  test("the window is start-inclusive and end-exclusive", () => {
    expect(validateDiscount(percent(20, { starts_at: h(1) }), at).reason).toBe("not_started");
    expect(validateDiscount(percent(20, { starts_at: NOW.toISOString() }), at).ok).toBe(true);
    expect(validateDiscount(percent(20, { ends_at: NOW.toISOString() }), at).reason).toBe(
      "expired",
    );
    expect(validateDiscount(percent(20, { ends_at: h(-1) }), at).reason).toBe("expired");
    expect(validateDiscount(percent(20, { starts_at: h(-2), ends_at: h(2) }), at).ok).toBe(true);
  });

  test("used up once the count reaches the limit", () => {
    expect(validateDiscount(percent(20, { usage_limit: 5, used_count: 4 }), at).ok).toBe(true);
    expect(validateDiscount(percent(20, { usage_limit: 5, used_count: 5 }), at).reason).toBe(
      "used_up",
    );
    expect(validateDiscount(percent(20, { usage_limit: 5, used_count: 9 }), at).reason).toBe(
      "used_up",
    );
  });

  test("the minimum is inclusive and is reported back", () => {
    const terms = percent(20, { min_order_kobo: 1_000_000 });
    expect(validateDiscount(terms, at).ok).toBe(true);
    expect(validateDiscount(terms, { subtotalKobo: 999_999, now: NOW })).toEqual({
      ok: false,
      amountKobo: 0,
      reason: "below_minimum",
      minOrderKobo: 1_000_000,
    });
  });

  test("a fixed amount bigger than the order takes the order to zero, not below", () => {
    const check = validateDiscount(fixed(5_000_000), at);
    expect(check).toEqual({ ok: true, amountKobo: 1_000_000, reason: null });
  });

  test("a discount that rounds to nothing does not apply", () => {
    expect(validateDiscount(percent(10), { subtotalKobo: 4, now: NOW }).reason).toBe("zero_amount");
    expect(validateDiscount(percent(10), { subtotalKobo: 0, now: NOW }).reason).toBe("zero_amount");
  });

  test("a subtotal that isn't whole, positive kobo is refused", () => {
    for (const subtotalKobo of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateDiscount(percent(10), { subtotalKobo, now: NOW }).reason).toBe(
        "invalid_subtotal",
      );
    }
  });

  test("a row the constraints should have stopped never discounts anything", () => {
    expect(validateDiscount(percent(0), at).reason).toBe("misconfigured");
    expect(validateDiscount(percent(95), at).reason).toBe("misconfigured");
    expect(validateDiscount(percent(12.5), at).reason).toBe("misconfigured");
    expect(validateDiscount(fixed(0), at).reason).toBe("misconfigured");
    expect(validateDiscount({ ...percent(10), percent_off: null }, at).reason).toBe(
      "misconfigured",
    );
  });

  test("checkout tests the switch first; the seller's list shows the ending", () => {
    const terms = percent(10, { active: false, ends_at: h(-1) });
    expect(validateDiscount(terms, at).reason).toBe("inactive");
    expect(discountStatus(terms, NOW)).toBe("expired");
  });
});

describe("buyerMessage", () => {
  const at = { subtotalKobo: 1_000_000, now: NOW };

  test("says nothing on success", () => {
    expect(buyerMessage(validateDiscount(percent(10), at))).toBeNull();
  });

  test("off, scheduled, expired and used-up codes all read the same", () => {
    const messages = [
      percent(10, { active: false }),
      percent(10, { starts_at: h(5) }),
      percent(10, { ends_at: h(-5) }),
      percent(10, { usage_limit: 1, used_count: 1 }),
      percent(0),
    ].map((t) => buyerMessage(validateDiscount(t, at)));
    expect(new Set(messages)).toEqual(new Set([NOT_VALID_MESSAGE]));
  });

  test("the minimum spend is spelled out", () => {
    const check = validateDiscount(percent(10, { min_order_kobo: 1_500_000 }), at);
    expect(buyerMessage(check)).toBe("Spend ₦15,000 or more to use this code.");
  });
});

describe("discountStatus", () => {
  test("covers every state", () => {
    expect(discountStatus(percent(10), NOW)).toBe("active");
    expect(discountStatus(percent(10, { starts_at: h(3) }), NOW)).toBe("scheduled");
    expect(discountStatus(percent(10, { ends_at: h(-3) }), NOW)).toBe("expired");
    expect(discountStatus(percent(10, { usage_limit: 2, used_count: 2 }), NOW)).toBe("used_up");
    expect(discountStatus(percent(10, { active: false }), NOW)).toBe("off");
    expect(discountStatus(percent(10, { active: false, starts_at: h(3) }), NOW)).toBe("off");
  });
});

describe("money formatting", () => {
  test("formatKobo groups thousands and only shows kobo when there are some", () => {
    expect(formatKobo(0)).toBe("₦0");
    expect(formatKobo(250_000)).toBe("₦2,500");
    expect(formatKobo(123_456_789)).toBe("₦1,234,567.89");
    expect(formatKobo(1_050)).toBe("₦10.50");
    expect(formatKobo(-20_000)).toBe("-₦200");
  });

  test("parseNairaToKobo reads what sellers type", () => {
    expect(parseNairaToKobo("2500")).toBe(250_000);
    expect(parseNairaToKobo("2,500")).toBe(250_000);
    expect(parseNairaToKobo("₦ 2,500.5")).toBe(250_050);
    expect(parseNairaToKobo("0.29")).toBe(29);
    expect(parseNairaToKobo("10.05")).toBe(1_005);
  });

  test("parseNairaToKobo refuses anything that isn't a plain amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e5", "12.", ".5"]) {
      expect(parseNairaToKobo(bad)).toBeNull();
    }
  });

  test("koboToNairaInput round-trips", () => {
    expect(koboToNairaInput(250_000)).toBe("2500");
    expect(koboToNairaInput(250_050)).toBe("2500.50");
    expect(koboToNairaInput(0)).toBe("");
    expect(koboToNairaInput(null)).toBe("");
    for (const kobo of [1, 99, 100, 12_345, 250_050]) {
      expect(parseNairaToKobo(koboToNairaInput(kobo))).toBe(kobo);
    }
  });
});

describe("describeDiscount", () => {
  test("reads like a sentence", () => {
    expect(describeDiscount(percent(20, { min_order_kobo: 1_000_000 }))).toBe(
      "20% off orders of ₦10,000 or more",
    );
    expect(describeDiscount(fixed(200_000))).toBe("₦2,000 off any order");
  });
});

describe("parseDiscountInput", () => {
  const base = {
    code: " summer 25 ",
    kind: "percent",
    percentOff: 25,
    minOrderKobo: 500_000,
    startsAt: null,
    endsAt: h(48),
    usageLimit: 100,
  };

  test("accepts and normalises a good payload", () => {
    const parsed = parseDiscountInput(base, { now: NOW });
    expect(parsed).toEqual({
      ok: true,
      value: {
        code: "SUMMER25",
        kind: "percent",
        percentOff: 25,
        amountOffKobo: null,
        minOrderKobo: 500_000,
        startsAt: null,
        endsAt: h(48),
        usageLimit: 100,
        active: true,
      },
    });
  });

  test("keeps only the amount that matches the kind", () => {
    const parsed = parseDiscountInput(
      { ...base, kind: "fixed", percentOff: 25, amountOffKobo: 100_000 },
      { now: NOW },
    );
    expect(parsed.ok && parsed.value.percentOff).toBeNull();
    expect(parsed.ok && parsed.value.amountOffKobo).toBe(100_000);
  });

  test("treats a missing minimum and limit as none", () => {
    const parsed = parseDiscountInput(
      { code: "ABC", kind: "percent", percentOff: 10 },
      { now: NOW },
    );
    expect(parsed.ok && parsed.value.minOrderKobo).toBe(0);
    expect(parsed.ok && parsed.value.usageLimit).toBeNull();
    expect(parsed.ok && parsed.value.endsAt).toBeNull();
  });

  test("refuses each bad field with its own message", () => {
    const bad = (patch: Record<string, unknown>) => {
      const parsed = parseDiscountInput({ ...base, ...patch }, { now: NOW });
      return parsed.ok ? null : parsed.error;
    };
    expect(bad({ code: "x" })).toMatch(/at least 3/);
    expect(bad({ kind: "bogo" })).toMatch(/percentage or a fixed/);
    expect(bad({ percentOff: 0 })).toMatch(/1 to 90/);
    expect(bad({ percentOff: 91 })).toMatch(/1 to 90/);
    expect(bad({ percentOff: 12.5 })).toMatch(/1 to 90/);
    expect(bad({ percentOff: "20" })).toMatch(/1 to 90/);
    expect(bad({ kind: "fixed", amountOffKobo: 50 })).toMatch(/at least ₦1/);
    expect(bad({ kind: "fixed", amountOffKobo: 3_000_000_000 })).toMatch(/too large/);
    expect(bad({ minOrderKobo: -1 })).toMatch(/minimum/);
    expect(bad({ startsAt: "not a date" })).toMatch(/start date/);
    expect(bad({ endsAt: 12 })).toMatch(/end date/);
    expect(bad({ startsAt: h(10), endsAt: h(5) })).toMatch(/after the start/);
    expect(bad({ endsAt: h(-1) })).toMatch(/already passed/);
    expect(bad({ usageLimit: 0 })).toMatch(/Usage limit/);
    expect(bad({ usageLimit: 2.5 })).toMatch(/Usage limit/);
    expect(parseDiscountInput(null, { now: NOW }).ok).toBe(false);
    expect(parseDiscountInput("code", { now: NOW }).ok).toBe(false);
  });

  test("an end already in the past may stay on an edit, but not be newly set", () => {
    const past = h(-24);
    expect(parseDiscountInput({ ...base, endsAt: past }, { now: NOW }).ok).toBe(false);
    expect(
      parseDiscountInput({ ...base, endsAt: past }, { now: NOW, previousEndsAt: past }).ok,
    ).toBe(true);
    expect(
      parseDiscountInput({ ...base, endsAt: h(-2) }, { now: NOW, previousEndsAt: past }).ok,
    ).toBe(false);
  });

  test("honours an explicit active flag", () => {
    const parsed = parseDiscountInput({ ...base, active: false }, { now: NOW });
    expect(parsed.ok && parsed.value.active).toBe(false);
  });
});
