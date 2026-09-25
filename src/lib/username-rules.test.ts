import { describe, expect, test } from "bun:test";
import { normalizeUsername, validateUsername } from "./username-rules";

describe("normalizeUsername", () => {
  test("lowercases, turns spaces into underscores and drops everything else", () => {
    expect(normalizeUsername("Kim Tsok@!✨")).toBe("kim_tsok");
  });

  test("caps at 30 characters", () => {
    expect(normalizeUsername("a".repeat(40))).toHaveLength(30);
  });
});

describe("validateUsername", () => {
  test("accepts a plain name with a dot or underscore in the middle", () => {
    expect(validateUsername("kim.tsok_1")).toBeNull();
  });

  test("rejects names that are too short", () => {
    expect(validateUsername("ab")).not.toBeNull();
  });

  // edit-profile used a looser slugify and would save these.
  test("rejects a leading or trailing dot/underscore", () => {
    expect(validateUsername(".kim")).not.toBeNull();
    expect(validateUsername("kim_")).not.toBeNull();
  });

  test("rejects reserved names", () => {
    expect(validateUsername("admin")).not.toBeNull();
    expect(validateUsername("support")).not.toBeNull();
  });
});
