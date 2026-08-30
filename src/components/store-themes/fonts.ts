// Sans/Serif/Display reuse families already loaded globally for the rest of
// the app. Everything after that is a deliberate addition of Google Fonts
// picked for fashion/editorial character — but they are loaded ON DEMAND
// (see ensureThemeFont / ensureThemePickerFonts below), not in __root.tsx,
// so storefronts and core pages never pay for ~35 families they don't use.
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

// ── On-demand font loading ────────────────────────────────────────────────
// Inter, Cormorant Garamond and Anton stay in the root stylesheet (they are
// the app's core faces). Every other family loads only when a storefront
// actually renders it or when the seller opens the font picker.

/** css2 `family=` parameter for each non-core option. */
const GOOGLE_FAMILY_PARAMS: Partial<Record<FontId, string>> = {
  playfair: "Playfair+Display:ital,wght@0,500;0,700;1,500",
  abril: "Abril+Fatface",
  bodoni: "Bodoni+Moda:ital,wght@0,500;0,700;1,500",
  cinzel: "Cinzel:wght@500;700",
  italiana: "Italiana",
  marcellus: "Marcellus",
  unbounded: "Unbounded:wght@500;700",
  syne: "Syne:wght@600;700",
  poppins: "Poppins:wght@400;500;600",
  dmSerif: "DM+Serif+Display",
  fraunces: "Fraunces:ital,wght@0,400;0,600;1,400",
  libreCaslon: "Libre+Caslon+Display",
  spectral: "Spectral:wght@400;600",
  ebGaramond: "EB+Garamond:wght@400;600",
  prata: "Prata",
  josefin: "Josefin+Sans:wght@400;600",
  spaceGrotesk: "Space+Grotesk:wght@400;500;700",
  bebas: "Bebas+Neue",
  oswald: "Oswald:wght@400;500;600",
  archivoBlack: "Archivo+Black",
  zillaSlab: "Zilla+Slab:wght@400;600",
  crimson: "Crimson+Text:wght@400;600",
  libreBaskerville: "Libre+Baskerville:wght@400;700",
  fjalla: "Fjalla+One",
  staatliches: "Staatliches",
  manrope: "Manrope:wght@400;500;700",
  sora: "Sora:wght@400;500;700",
  dmSans: "DM+Sans:wght@400;500;700",
  outfit: "Outfit:wght@400;500;700",
  bricolage: "Bricolage+Grotesque:wght@400;600;800",
  instrumentSerif: "Instrument+Serif",
  newsreader: "Newsreader:ital,wght@0,400;0,600;1,400",
  vollkorn: "Vollkorn:wght@400;600",
  tenorSans: "Tenor+Sans",
  yeseva: "Yeseva+One",
  cardo: "Cardo:wght@400;700",
};

const injectedHrefs = new Set<string>();

function injectStylesheet(href: string) {
  if (typeof document === "undefined" || injectedHrefs.has(href)) return;
  injectedHrefs.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/** Loads exactly the one family a storefront/preview is rendering with. */
export function ensureThemeFont(fontId: FontId | undefined) {
  if (!fontId) return;
  const family = GOOGLE_FAMILY_PARAMS[fontId];
  if (!family) return; // sans/serif/display are core, already loaded globally
  injectStylesheet(`https://fonts.googleapis.com/css2?family=${family}&display=swap`);
}

/** Loads every option at once — only used when the seller opens the picker,
 *  where every label is rendered in its own face. */
export function ensureThemePickerFonts() {
  const families = Object.values(GOOGLE_FAMILY_PARAMS)
    .map((f) => `family=${f}`)
    .join("&");
  injectStylesheet(`https://fonts.googleapis.com/css2?${families}&display=swap`);
}
