import type { ThemeId } from "./types";

// The colour words a seller might type to find each theme: "red", "purple",
// "cream". The theme picker's search matches these alongside the theme's
// name and its `moods`, and shows the seller which of them matched.
//
// Written by hand, not derived from the hex values. A hue bucket cannot tell
// burgundy from pink or gold from mustard, and a seller searching "gold" wants
// Black & Gold, not every theme whose accent happens to sit near 45°. Both of
// the theme's colours are covered: the background (what fills the screen) and
// the accent (the one colour that carries it). Synonyms are deliberate, since
// people say "purple", "violet" and "lilac" for the same thing.
//
// A Record over ThemeId, so a new theme without an entry here fails the
// typecheck instead of silently becoming unsearchable by colour.
export const THEME_COLORS: Record<ThemeId, string[]> = {
  motion: ["black", "purple", "violet", "neon"],
  banner: ["beige", "sand", "cream", "tan", "brown", "neutral"],
  atelier: ["black", "gold", "mustard"],
  circuit: ["black", "blue", "cyan", "neon", "electric blue"],
  verdant: ["black", "green", "emerald"],
  monochrome: ["black", "white", "grey", "neutral"],
  gilded: ["black", "gold", "golden", "yellow"],
  obsidian: ["black", "grey", "charcoal"],

  "lilac-hour": ["lilac", "lavender", "purple", "violet", "white", "pastel"],
  orchid: ["purple", "violet", "lavender", "plum", "black"],
  wisteria: ["lavender", "lilac", "purple", "violet", "white", "pastel"],
  amethyst: ["purple", "lavender", "lilac", "black", "violet"],
  periwinkle: ["periwinkle", "blue", "indigo", "purple", "white"],
  "mauve-studio": ["mauve", "purple", "plum", "pink", "neutral"],
  blush: ["pink", "hot pink", "blush", "white", "pastel"],
  rosewater: ["pink", "rose", "coral", "white", "pastel"],
  "fuchsia-night": ["pink", "fuchsia", "magenta", "hot pink", "black", "neon"],
  peony: ["pink", "raspberry", "magenta", "fuchsia", "white"],
  bubblegum: ["pink", "bubblegum", "baby pink", "pastel", "white"],
  "dusty-rose": ["pink", "rose", "dusty pink", "mauve", "beige"],

  "black-gold": ["black", "gold", "golden", "yellow"],
  "black-red": ["black", "red", "true red", "scarlet"],
  bordeaux: ["burgundy", "wine", "claret", "maroon", "red", "black"],
  merlot: ["burgundy", "wine", "maroon", "red", "pink", "blush"],
  burgundy: ["burgundy", "wine", "maroon", "oxblood", "red", "champagne", "gold"],

  terracotta: ["terracotta", "orange", "rust", "brown", "cream"],
  saffron: ["yellow", "gold", "golden", "orange", "mustard", "cream"],
  clay: ["brown", "tan", "beige", "mustard", "neutral"],
  "amber-dusk": ["amber", "orange", "gold", "yellow", "black"],
  copper: ["copper", "bronze", "brown", "orange", "black"],
  kiln: ["terracotta", "orange", "rust", "cream", "beige"],
  hearth: ["orange", "rust", "terracotta", "brown", "black"],
  espresso: ["brown", "coffee", "chocolate", "caramel", "tan"],
  walnut: ["brown", "wood", "beige", "tan", "cream"],

  sage: ["sage", "green", "olive", "white"],
  eucalyptus: ["green", "emerald", "white", "mint"],
  "deep-teal": ["teal", "turquoise", "green", "black", "aqua"],
  mint: ["mint", "green", "white", "pastel"],
  "forest-ink": ["green", "forest green", "lime", "black"],

  cobalt: ["blue", "cobalt", "royal blue", "white"],
  midnight: ["navy", "blue", "black", "sky blue"],
  ice: ["blue", "sky blue", "light blue", "white", "cyan"],
  "navy-linen": ["navy", "blue", "white", "grey"],

  bone: ["white", "off-white", "cream", "grey", "neutral"],
  graphite: ["black", "grey", "silver", "charcoal"],
  oat: ["beige", "oatmeal", "cream", "brown", "neutral"],
  porcelain: ["white", "black", "neutral"],
  "charcoal-rose": ["charcoal", "black", "pink", "rose", "blush"],

  "electric-lime": ["lime", "green", "neon", "yellow", "black"],
  "tangerine-pop": ["orange", "tangerine", "peach", "white"],
};
