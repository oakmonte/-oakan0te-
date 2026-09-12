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
  | "cardo"
  | "cormorant"
  | "lora"
  | "merriweather"
  | "libreBodoni"
  | "sourceSerif"
  | "playfairSc"
  | "cormorantInfant"
  | "calistoga"
  | "righteous"
  | "lexendMega"
  | "syncopate"
  | "poiretOne"
  | "russoOne"
  | "jost"
  | "montserrat"
  | "raleway"
  | "workSans"
  | "plusJakarta"
  | "archivo"
  | "publicSans"
  | "rubik"
  | "lexend"
  | "figtree"
  | "karla"
  | "barlowCondensed"
  | "quicksand"
  | "varelaRound"
  | "nunito"
  | "greatVibes"
  | "caveat";

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
  // Added from the ui-ux-pro-max typography set — see fonts note in CLAUDE.md.
  { id: "cormorant", label: "Cormorant", fontFamily: "'Cormorant', serif" },
  { id: "lora", label: "Lora", fontFamily: "'Lora', serif" },
  { id: "merriweather", label: "Merriweather", fontFamily: "'Merriweather', serif" },
  { id: "libreBodoni", label: "Libre Bodoni", fontFamily: "'Libre Bodoni', serif" },
  { id: "sourceSerif", label: "Source Serif", fontFamily: "'Source Serif 4', serif" },
  { id: "playfairSc", label: "Playfair SC", fontFamily: "'Playfair Display SC', serif" },
  { id: "cormorantInfant", label: "Cormorant Infant", fontFamily: "'Cormorant Infant', serif" },
  { id: "calistoga", label: "Calistoga", fontFamily: "'Calistoga', serif" },
  { id: "righteous", label: "Righteous", fontFamily: "'Righteous', sans-serif" },
  { id: "lexendMega", label: "Lexend Mega", fontFamily: "'Lexend Mega', sans-serif" },
  { id: "syncopate", label: "Syncopate", fontFamily: "'Syncopate', sans-serif" },
  { id: "poiretOne", label: "Poiret One", fontFamily: "'Poiret One', sans-serif" },
  { id: "russoOne", label: "Russo One", fontFamily: "'Russo One', sans-serif" },
  { id: "jost", label: "Jost", fontFamily: "'Jost', sans-serif" },
  { id: "montserrat", label: "Montserrat", fontFamily: "'Montserrat', sans-serif" },
  { id: "raleway", label: "Raleway", fontFamily: "'Raleway', sans-serif" },
  { id: "workSans", label: "Work Sans", fontFamily: "'Work Sans', sans-serif" },
  { id: "plusJakarta", label: "Plus Jakarta", fontFamily: "'Plus Jakarta Sans', sans-serif" },
  { id: "archivo", label: "Archivo", fontFamily: "'Archivo', sans-serif" },
  { id: "publicSans", label: "Public Sans", fontFamily: "'Public Sans', sans-serif" },
  { id: "rubik", label: "Rubik", fontFamily: "'Rubik', sans-serif" },
  { id: "lexend", label: "Lexend", fontFamily: "'Lexend', sans-serif" },
  { id: "figtree", label: "Figtree", fontFamily: "'Figtree', sans-serif" },
  { id: "karla", label: "Karla", fontFamily: "'Karla', sans-serif" },
  {
    id: "barlowCondensed",
    label: "Barlow Condensed",
    fontFamily: "'Barlow Condensed', sans-serif",
  },
  { id: "quicksand", label: "Quicksand", fontFamily: "'Quicksand', sans-serif" },
  { id: "varelaRound", label: "Varela Round", fontFamily: "'Varela Round', sans-serif" },
  { id: "nunito", label: "Nunito", fontFamily: "'Nunito', sans-serif" },
  { id: "greatVibes", label: "Great Vibes", fontFamily: "'Great Vibes', cursive" },
  { id: "caveat", label: "Caveat", fontFamily: "'Caveat', cursive" },
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
  cormorant: "Cormorant:ital,wght@0,400;0,600;1,400",
  lora: "Lora:ital,wght@0,400;0,600;1,400",
  merriweather: "Merriweather:wght@400;700",
  libreBodoni: "Libre+Bodoni:ital,wght@0,400;0,600;1,400",
  sourceSerif: "Source+Serif+4:ital,wght@0,400;0,600;1,400",
  playfairSc: "Playfair+Display+SC:wght@400;700",
  cormorantInfant: "Cormorant+Infant:ital,wght@0,400;0,600;1,400",
  calistoga: "Calistoga",
  righteous: "Righteous",
  lexendMega: "Lexend+Mega:wght@400;700",
  syncopate: "Syncopate:wght@400;700",
  poiretOne: "Poiret+One",
  russoOne: "Russo+One",
  jost: "Jost:ital,wght@0,400;0,500;0,700;1,400",
  montserrat: "Montserrat:wght@300;400;600;700",
  raleway: "Raleway:wght@300;400;600;700",
  workSans: "Work+Sans:wght@400;500;700",
  plusJakarta: "Plus+Jakarta+Sans:wght@400;500;700",
  archivo: "Archivo:wght@400;600;800",
  publicSans: "Public+Sans:wght@400;600;800",
  rubik: "Rubik:wght@400;500;700",
  lexend: "Lexend:wght@400;500;700",
  figtree: "Figtree:wght@400;500;700",
  karla: "Karla:wght@400;600;700",
  barlowCondensed: "Barlow+Condensed:wght@400;600;700",
  quicksand: "Quicksand:wght@400;500;700",
  varelaRound: "Varela+Round",
  nunito: "Nunito:wght@400;600;700",
  greatVibes: "Great+Vibes",
  caveat: "Caveat:wght@400;600",
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

/** Loads every option — only used when the seller opens the picker, where
 *  every label is rendered in its own face.
 *
 *  Split across several stylesheet requests rather than one. With ~67
 *  non-core families a single css2 URL runs past 2.5KB, and a request that
 *  long is at the mercy of whatever proxy or CDN sits in front of it: one
 *  that truncates or rejects it drops every font at once, and silently,
 *  since a stylesheet that fails to load just leaves the fallback face in
 *  place. Chunking also lets the first faces paint while the rest are still
 *  in flight, which is what the seller actually sees scrolling the list. */
const PICKER_FONTS_PER_REQUEST = 12;

export function ensureThemePickerFonts() {
  const families = Object.values(GOOGLE_FAMILY_PARAMS);
  for (let i = 0; i < families.length; i += PICKER_FONTS_PER_REQUEST) {
    const query = families
      .slice(i, i + PICKER_FONTS_PER_REQUEST)
      .map((f) => `family=${f}`)
      .join("&");
    injectStylesheet(`https://fonts.googleapis.com/css2?${query}&display=swap`);
  }
}
