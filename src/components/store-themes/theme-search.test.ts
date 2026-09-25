import { expect, test } from "bun:test";
import { searchThemes } from "./theme-search";
import { THEMES } from "./types";

const ids = (query: string) => searchThemes(query, THEMES).map((m) => m.theme.id);
const matchedFor = (query: string, id: string) =>
  searchThemes(query, THEMES).find((m) => m.theme.id === id)?.matched;

test("an empty query returns the whole catalogue, in order, nothing matched", () => {
  const all = searchThemes("  ", THEMES);
  expect(all.map((m) => m.theme.id)).toEqual(THEMES.map((t) => t.id));
  expect(all.every((m) => m.matched.length === 0)).toBe(true);
});

test("the catalogue is 50 themes and every one has colour keywords", () => {
  expect(THEMES).toHaveLength(50);
  for (const t of THEMES) expect(t.colors.length).toBeGreaterThan(0);
});

test("a colour finds its themes and says which word matched", () => {
  const red = ids("red");
  expect(red).toContain("black-red");
  expect(red).toContain("burgundy");
  expect(matchedFor("red", "black-red")).toEqual(["red"]);
});

test("'red' no longer hits prose that merely contains the letters", () => {
  // Gallery Edit's copy says "considered"; it has nothing red about it.
  expect(ids("red")).not.toContain("atelier");
});

test("a keyword that merely contains the word does not match", () => {
  // Periwinkle's moods include "structured", which has "red" in the middle.
  expect(ids("red")).not.toContain("periwinkle");
});

test("typos are a fallback, not extra results beside a real hit", () => {
  // "gold" is one letter from "bold" and "cold". With real gold themes in
  // the catalogue, those must not come along.
  const gold = ids("gold");
  expect(gold).toContain("black-gold");
  expect(gold).not.toContain("motion");
  expect(gold).not.toContain("graphite");
});

test("dark and light come from each theme's own background", () => {
  const darkPink = ids("dark pink");
  expect(darkPink).toContain("fuchsia-night");
  expect(darkPink).not.toContain("bubblegum");
});

test("light and dark only ever mean the background", () => {
  // Amethyst is near-black; its copy mentions light.
  expect(ids("light purple")).not.toContain("amethyst");
  expect(ids("light green")).not.toContain("forest-ink");
});

test("phrasings of the old Light/Dark chips still work", () => {
  expect(ids("dark mode").length).toBeGreaterThan(10);
  expect(ids("black background")).toContain("black-red");
  expect(ids("red accent")).toContain("black-red");
  expect(ids("light mode")).not.toContain("midnight");
});

test("a two-word colour typed whole ranks the theme that has it first", () => {
  expect(ids("light blue")[0]).toBe("ice");
  expect(ids("forest green")[0]).toBe("forest-ink");
});

test("typing more never finds less, and spelling variants don't depend on luck", () => {
  expect(ids("luxe").length).toBeGreaterThanOrEqual(ids("lux").length);
  expect(ids("gray")).toContain("graphite");
  expect(matchedFor("creamy", "lilac-hour")).toBeUndefined();
});

test("a name that only starts with the word ranks behind a real colour hit", () => {
  expect(ids("blu")[0]).not.toBe("blush");
});

test("a query of only filler words shows everything", () => {
  expect(ids("the")).toHaveLength(THEMES.length);
});

test("a mood finds its themes", () => {
  expect(ids("cozy")).toEqual(expect.arrayContaining(["hearth"]));
  expect(matchedFor("romantic", "merlot")).toEqual(["romantic"]);
});

test("every meaningful word must hit, so words narrow rather than widen", () => {
  const darkRed = ids("black and red");
  expect(darkRed).toContain("black-red");
  expect(darkRed).not.toContain("merlot"); // red, but not black
  expect(matchedFor("something black and red", "black-red")).toEqual(["black", "red"]);
});

test("a misspelled theme or colour still lands", () => {
  expect(ids("burgandy")[0]).toBe("burgundy");
  expect(ids("lavendar")).toContain("wisteria");
});

test("a name hit ranks first and shows no redundant keyword", () => {
  expect(ids("sage")[0]).toBe("sage");
  expect(ids("Obsidian")[0]).toBe("obsidian");
});
