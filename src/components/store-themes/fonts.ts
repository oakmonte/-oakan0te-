// Every font choice offered here reuses a family already loaded globally
// (see __root.tsx's Google Fonts link) — no per-field font choice ever
// triggers a new network request or adds a family the rest of the app
// doesn't already pay for.
export type FontId = "sans" | "serif" | "display";

export const FONT_OPTIONS: { id: FontId; label: string; fontFamily: string }[] = [
  { id: "sans", label: "Sans", fontFamily: "var(--font-sans)" },
  { id: "serif", label: "Serif", fontFamily: "var(--font-serif)" },
  { id: "display", label: "Display", fontFamily: "var(--font-display)" },
];
