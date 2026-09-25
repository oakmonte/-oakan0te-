import { expect, test } from "bun:test";
import { dropCountdown, formatCountdown, pickLiveDrop, type LiveDrop } from "./drops";

const NOW = new Date("2026-09-25T12:00:00Z");
const h = (hours: number) => new Date(NOW.getTime() + hours * 3600_000).toISOString();
const drop = (id: string, starts: string | null, ends: string | null): LiveDrop => ({
  id,
  title: id,
  starts_at: starts,
  ends_at: ends,
});

test("no drops, or only ended ones, means no banner", () => {
  expect(pickLiveDrop([], NOW)).toBeNull();
  expect(pickLiveDrop([drop("old", h(-48), h(-1))], NOW)).toBeNull();
});

test("a running drop beats an upcoming one", () => {
  const picked = pickLiveDrop([drop("soon", h(2), h(10)), drop("now", h(-1), h(5))], NOW);
  expect(picked?.id).toBe("now");
});

test("among upcoming drops the soonest wins", () => {
  expect(pickLiveDrop([drop("later", h(20), null), drop("sooner", h(3), null)], NOW)?.id).toBe(
    "sooner",
  );
});

test("an untimed announcement counts as running, behind timed ones", () => {
  expect(pickLiveDrop([drop("plain", null, null)], NOW)?.id).toBe("plain");
  expect(pickLiveDrop([drop("plain", null, null), drop("timed", null, h(4))], NOW)?.id).toBe(
    "timed",
  );
});

test("the countdown targets the start, then the end, then nothing", () => {
  expect(dropCountdown(drop("a", h(2), h(5)), NOW)).toEqual({
    label: "Starts in",
    msLeft: 2 * 3600_000,
  });
  expect(dropCountdown(drop("a", h(-2), h(5)), NOW)?.label).toBe("Ends in");
  expect(dropCountdown(drop("a", null, null), NOW)).toBeNull();
});

test("formatCountdown", () => {
  expect(formatCountdown(3 * 3600_000 + 5 * 60_000 + 9_000)).toBe("03:05:09");
  expect(formatCountdown(2 * 86400_000 + 3600_000)).toBe("2d 01:00:00");
  expect(formatCountdown(-5)).toBe("00:00:00");
});
