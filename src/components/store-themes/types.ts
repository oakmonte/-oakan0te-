import { THEME_SPECS } from "./theme-specs";

export type ThemeId =
  | "motion"
  | "banner"
  | "atelier"
  | "circuit"
  | "verdant"
  | "monochrome"
  | "gilded"
  | "obsidian"
  // The spec-driven catalogue (theme-specs.ts). Listed here rather than
  // derived from THEME_SPECS so ThemeId stays a plain literal union with
  // no import cycle back into the specs, which import this type.
  | "lilac-hour"
  | "orchid"
  | "wisteria"
  | "amethyst"
  | "periwinkle"
  | "mauve-studio"
  | "blush"
  | "rosewater"
  | "fuchsia-night"
  | "peony"
  | "bubblegum"
  | "dusty-rose"
  | "black-gold"
  | "black-red"
  | "bordeaux"
  | "merlot"
  | "terracotta"
  | "saffron"
  | "clay"
  | "amber-dusk"
  | "copper"
  | "kiln"
  | "hearth"
  | "espresso"
  | "walnut"
  | "sage"
  | "eucalyptus"
  | "deep-teal"
  | "mint"
  | "forest-ink"
  | "cobalt"
  | "midnight"
  | "ice"
  | "navy-linen"
  | "bone"
  | "graphite"
  | "oat"
  | "porcelain"
  | "charcoal-rose"
  | "electric-lime"
  | "tangerine-pop";

export type Theme = {
  id: ThemeId;
  name: string;
  eyebrow: string;
  description: string;
  accent: string;
  /** The theme's own storefront background (see full-previews.tsx) — reused
   * by the theme-picker card's colour swatch so the swatch is an honest
   * preview, not a separate palette invented just for the grid. */
  background: string;
  /** Fictional example brand shown inside the mockup, for flavor. */
  demoBrand: string;
  /** Lowercase mood/vibe words a seller might search for instead of a theme's
   * actual name — "cozy", "bold", "editorial" — so the picker's search bar can
   * match a feeling, not just literal name/eyebrow/description text. Curated
   * by hand from each theme's own eyebrow/description, not derived, so a
   * theme can be found under a word its own copy never uses. */
  moods: string[];
};

const BASE_THEMES: Theme[] = [
  {
    id: "motion",
    name: "Motion Grid",
    eyebrow: "DYNAMIC · BOLD · STREETWEAR",
    description: "Built for drops, statements, and products that need to move fast.",
    accent: "#9c4dff",
    background: "#09070d",
    demoBrand: "District 17",
    moods: ["bold", "streetwear", "edgy", "high-energy", "dynamic"],
  },
  {
    id: "banner",
    name: "Immersive Banner",
    eyebrow: "PREMIUM · CINEMATIC · REFINED",
    description: "A spacious editorial storefront that puts your world front and centre.",
    accent: "#a67c52",
    background: "#e9e0d1",
    demoBrand: "terra",
    moods: ["premium", "cinematic", "editorial", "refined", "elegant"],
  },
  {
    id: "atelier",
    name: "Gallery Edit",
    eyebrow: "QUIET · LUXE · CONSIDERED",
    description: "A hushed, gallery-lit storefront for pieces that don't need to shout.",
    accent: "#c9a227",
    background: "#0c0b0a",
    demoBrand: "Atelier Noir",
    moods: ["quiet", "luxe", "understated", "gallery", "sophisticated"],
  },
  {
    id: "circuit",
    name: "Neon Terminal",
    eyebrow: "FUTURIST · TECH · HIGH-CONTRAST",
    description: "A HUD-inspired storefront for brands building what's next.",
    accent: "#2dd4ff",
    background: "#05070a",
    demoBrand: "Circuit",
    moods: ["futuristic", "tech", "edgy", "bold", "high-energy"],
  },
  {
    id: "verdant",
    name: "Verdant Noir",
    eyebrow: "BOTANICAL · MOODY · GROUNDED",
    description: "Deep black grounded by a single living green — for brands rooted in craft.",
    accent: "#3fae63",
    background: "#0a0f0b",
    demoBrand: "Fern & Co.",
    moods: ["botanical", "moody", "earthy", "grounded", "natural"],
  },
  {
    id: "monochrome",
    name: "Monochrome",
    eyebrow: "STARK · GRAPHIC · TIMELESS",
    description: "Just black and white — nothing to distract from the product.",
    accent: "#111111",
    background: "#fafafa",
    demoBrand: "NOIR/BLANC",
    moods: ["minimal", "graphic", "timeless", "stark", "clean"],
  },
  {
    id: "gilded",
    name: "Gilded",
    eyebrow: "OPULENT · RICH · REGAL",
    description: "Black lacquered in gold, for stores that want to feel like an occasion.",
    accent: "#d4af37",
    background: "#0d0904",
    demoBrand: "Aurum House",
    moods: ["opulent", "luxury", "regal", "glamorous", "rich"],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    eyebrow: "MINIMAL · MONOLITHIC · SEVERE",
    description: "One shade of black, layered on itself — as pared-back as a storefront gets.",
    accent: "#6b6b6b",
    background: "#030303",
    demoBrand: "VOID",
    moods: ["minimal", "severe", "dark", "monolithic", "edgy"],
  },
];

// Every theme the picker offers: the eight hand-written ones above, then the
// spec catalogue. Spec entries are derived from the specs themselves rather
// than re-typed here, so a theme's card and its storefront can never disagree
// about its own accent or name.
export const THEMES: Theme[] = [
  ...BASE_THEMES,
  ...THEME_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    eyebrow: spec.eyebrow,
    description: spec.description,
    accent: spec.accent,
    background: spec.bg,
    demoBrand: spec.demoBrand,
    moods: spec.moods,
  })),
];
