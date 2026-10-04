import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// A `position: fixed` element with no top / bottom / inset falls back to its
// STATIC position -- wherever it would have sat in normal flow. That looks
// right on a desktop at scroll 0 and then drifts on iOS as the page scrolls
// and the toolbar collapses: the landing page header ended up ~170px down
// the screen with content showing above it (2026-10-03), after a refactor
// removed the inline `top` it had relied on. Every fixed element in the app
// has to pin itself explicitly.

const SRC = join(import.meta.dir, "..");

// Sets its offset somewhere this scan can't see, on purpose.
const ALLOWED = new Set([
  // use-locked-viewport.ts writes body's `top` inline (the saved scroll).
  ".oak-locked-viewport",
]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx|ts|css)$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
  });
}

const OFFSET = /(^|[;{\s"'`,])(top|bottom|inset)\s*:/;
const TW_OFFSET = /^!?-?(top|bottom|inset)(-|$)|^inset-[xy]?-?/;

describe("position: fixed", () => {
  const problems: string[] = [];
  for (const file of files(SRC)) {
    const src = readFileSync(file, "utf8");
    const where = (i: number) => `${relative(SRC, file)}:${src.slice(0, i).split("\n").length}`;

    // CSS rules (stylesheets and the <style> strings some routes inline).
    for (const m of src.matchAll(/([^{}]{0,120})\{([^{}]*position:\s*fixed[^{}]*)\}/g)) {
      const selector = m[1]
        .split(/\*\/|\n/)
        .pop()!
        .trim();
      if (ALLOWED.has(selector)) continue;
      if (!OFFSET.test(m[2])) problems.push(`${where(m.index!)} ${selector}`);
    }

    // Tailwind `fixed`, unless an offset class or an inline style offset
    // (checked in the next few lines, where `style={{ bottom: ... }}` sits)
    // pins it.
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      // Comments inside a template class string aren't classes.
      const classes = (m[1] ?? m[2]).replace(/\/\/[^\n]*/g, "").split(/\s+/);
      if (!classes.includes("fixed")) continue;
      if (classes.some((c) => TW_OFFSET.test(c))) continue;
      const after = src.slice(m.index!, m.index! + 1200);
      if (/\b(top|bottom|inset)\s*:/.test(after)) continue;
      problems.push(`${where(m.index!)} className="${classes.join(" ").slice(0, 60)}…"`);
    }
  }

  test("every fixed element sets top, bottom or inset", () => {
    expect(problems).toEqual([]);
  });
});
