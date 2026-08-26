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
  | "poppins"
  | "dmSerif"
  | "fraunces"
  | "libreCaslon"
  | "spectral"
  | "ebGaramond"
  | "prata"
  | "josefin"
  | "spaceGrotesk"
  | "bebas"
  | "oswald"
  | "archivoBlack"
  | "anton"
  | "zillaSlab"
  | "crimson"
  | "libreBaskerville"
  | "fjalla"
  | "staatliches"
  | "manrope"
  | "sora"
  | "dmSans"
  | "outfit"
  | "bricolage"
  | "instrumentSerif"
  | "newsreader"
  | "vollkorn"
  | "tenorSans"
  | "yeseva"
  | "cardo";

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
  { id: "dmSerif", label: "DM Serif", fontFamily: "'DM Serif Display', serif" },
  { id: "fraunces", label: "Fraunces", fontFamily: "'Fraunces', serif" },
  { id: "libreCaslon", label: "Libre Caslon", fontFamily: "'Libre Caslon Display', serif" },
  { id: "spectral", label: "Spectral", fontFamily: "'Spectral', serif" },
  { id: "ebGaramond", label: "EB Garamond", fontFamily: "'EB Garamond', serif" },
  { id: "prata", label: "Prata", fontFamily: "'Prata', serif" },
  { id: "josefin", label: "Josefin Sans", fontFamily: "'Josefin Sans', sans-serif" },
  { id: "spaceGrotesk", label: "Space Grotesk", fontFamily: "'Space Grotesk', sans-serif" },
  { id: "bebas", label: "Bebas Neue", fontFamily: "'Bebas Neue', sans-serif" },
  { id: "oswald", label: "Oswald", fontFamily: "'Oswald', sans-serif" },
  { id: "archivoBlack", label: "Archivo Black", fontFamily: "'Archivo Black', sans-serif" },
  { id: "anton", label: "Anton", fontFamily: "'Anton', sans-serif" },
  { id: "zillaSlab", label: "Zilla Slab", fontFamily: "'Zilla Slab', serif" },
  { id: "crimson", label: "Crimson Text", fontFamily: "'Crimson Text', serif" },
  { id: "libreBaskerville", label: "Libre Baskerville", fontFamily: "'Libre Baskerville', serif" },
  { id: "fjalla", label: "Fjalla One", fontFamily: "'Fjalla One', sans-serif" },
  { id: "staatliches", label: "Staatliches", fontFamily: "'Staatliches', sans-serif" },
  { id: "manrope", label: "Manrope", fontFamily: "'Manrope', sans-serif" },
  { id: "sora", label: "Sora", fontFamily: "'Sora', sans-serif" },
  { id: "dmSans", label: "DM Sans", fontFamily: "'DM Sans', sans-serif" },
  { id: "outfit", label: "Outfit", fontFamily: "'Outfit', sans-serif" },
  {
    id: "bricolage",
    label: "Bricolage Grotesque",
    fontFamily: "'Bricolage Grotesque', sans-serif",
  },
  { id: "instrumentSerif", label: "Instrument Serif", fontFamily: "'Instrument Serif', serif" },
  { id: "newsreader", label: "Newsreader", fontFamily: "'Newsreader', serif" },
  { id: "vollkorn", label: "Vollkorn", fontFamily: "'Vollkorn', serif" },
  { id: "tenorSans", label: "Tenor Sans", fontFamily: "'Tenor Sans', sans-serif" },
  { id: "yeseva", label: "Yeseva One", fontFamily: "'Yeseva One', serif" },
  { id: "cardo", label: "Cardo", fontFamily: "'Cardo', serif" },
];
