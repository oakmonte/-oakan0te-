import { describe, expect, test } from "bun:test";
import { formatOrderTime, nairaFromKobo } from "./order-format";

describe("nairaFromKobo", () => {
  test("whole naira drop the kobo", () => {
    expect(nairaFromKobo(2500000)).toBe("₦25,000");
    expect(nairaFromKobo(0)).toBe("₦0");
  });

  test("part naira always show two places", () => {
    expect(nairaFromKobo(150050)).toBe("₦1,500.50");
    expect(nairaFromKobo(150005)).toBe("₦1,500.05");
  });
});

describe("formatOrderTime", () => {
  // Built from local-time parts so the test means the same thing in any
  // timezone the suite runs in.
  const now = new Date(2026, 9, 8, 16, 0);
  const at = (y: number, m: number, d: number, h: number, min: number) =>
    new Date(y, m, d, h, min).toISOString();

  test("today and yesterday are named", () => {
    expect(formatOrderTime(at(2026, 9, 8, 9, 5), now)).toBe("Today, 09:05");
    expect(formatOrderTime(at(2026, 9, 7, 23, 59), now)).toBe("Yesterday, 23:59");
  });

  test("earlier this year shows the date and time", () => {
    expect(formatOrderTime(at(2026, 0, 3, 14, 30), now)).toBe("3 Jan, 14:30");
  });

  test("another year shows the year instead of the time", () => {
    expect(formatOrderTime(at(2025, 11, 31, 10, 0), now)).toBe("31 Dec 2025");
  });

  test("yesterday across a month boundary", () => {
    const first = new Date(2026, 10, 1, 8, 0);
    expect(formatOrderTime(at(2026, 9, 31, 20, 15), first)).toBe("Yesterday, 20:15");
  });

  test("a bad timestamp renders nothing rather than 'Invalid Date'", () => {
    expect(formatOrderTime("not a date", now)).toBe("");
  });
});
