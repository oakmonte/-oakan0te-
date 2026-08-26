// Sans/Serif/Display reuse families already loaded globally for the rest of
// the app. Everything after that is a deliberate, one-time addition of new
// Google Fonts (see __root.tsx) picked for fashion/editorial character — the
// old zero-new-network-request rule was a fine default, not a permanent one,
// and sellers asked for real creative range in the text editor.
export type FontId =
  | "sans"
  | "serif"
  | "display"
  | "playfair"
  | "abril"
  | "bodoni"
  | "cinzel"
  | "italiana"
  | "marcellus"
  | "unbounded"
  | "syne"
  | "poppins";

export const FONT_OPTIONS: { id: FontId; label: string; fontFamily: string }[] = [
  { id: "sans", label: "Sans", fontFamily: "var(--font-sans)" },
  { id: "serif", label: "Serif", fontFamily: "var(--font-serif)" },
  { id: "display", label: "Display", fontFamily: "var(--font-display)" },
  { id: "playfair", label: "Playfair", fontFamily: "'Playfair Display', serif" },
  { id: "abril", label: "Abril", fontFamily: "'Abril Fatface', serif" },
  { id: "bodoni", label: "Bodoni", fontFamily: "'Bodoni Moda', serif" },
  { id: "cinzel", label: "Cinzel", fontFamily: "'Cinzel', serif" },
  { id: "italiana", label: "Italiana", fontFamily: "'Italiana', serif" },
  { id: "marcellus", label: "Marcellus", fontFamily: "'Marcellus', serif" },
  { id: "unbounded", label: "Unbounded", fontFamily: "'Unbounded', sans-serif" },
  { id: "syne", label: "Syne", fontFamily: "'Syne', sans-serif" },
  { id: "poppins", label: "Poppins", fontFamily: "'Poppins', sans-serif" },
];
