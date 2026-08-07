export type FilterCategory =
  | "favorites"
  | "portrait"
  | "fashion"
  | "film"
  | "vintage"
  | "bw"
  | "lifestyle"
  | "creative";

export interface CameraFilter {
  id: string;

  /** Display name shown to the user */
  name: string;

  /** Filter category used inside FilterPanel */
  category: FilterCategory;

  /** CSS filter string applied to the live preview */
  css: string;

  /** Used later for intensity sliders */
  intensity: number;

  /** Used for quick swatch generation */
  thumbnailColor: string;

  /** Built-in filters cannot be deleted */
  isBuiltIn: boolean;

  /** Future marketplace support */
  premium: boolean;

  /** Future creator packs */
  creator?: string;
}

export const CAMERA_FILTERS: CameraFilter[] = [
  // ------------------------------------------------------------------
  // Portrait
  // ------------------------------------------------------------------

  {
    id: "natural",
    name: "Natural",
    category: "portrait",
    css: "none",
    intensity: 100,
    thumbnailColor: "#7A7A7A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "soft-glow",
    name: "Soft Glow",
    category: "portrait",
    css:
      "brightness(1.04) contrast(0.96) saturate(1.08)",
    intensity: 100,
    thumbnailColor: "#E5CDBF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "editorial",
    name: "Editorial",
    category: "portrait",
    css:
      "contrast(1.08) brightness(1.02) saturate(0.92)",
    intensity: 100,
    thumbnailColor: "#DDD8D2",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "clean-skin",
    name: "Clean Skin",
    category: "portrait",
    css:
      "brightness(1.05) saturate(0.96) contrast(0.95)",
    intensity: 100,
    thumbnailColor: "#F3D6C8",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "matte-portrait",
    name: "Matte Portrait",
    category: "portrait",
    css:
      "contrast(.88) brightness(1.05) saturate(.92)",
    intensity: 100,
    thumbnailColor: "#B69F92",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Fashion
  // ------------------------------------------------------------------

  {
    id: "vogue",
    name: "Vogue",
    category: "fashion",
    css:
      "contrast(1.18) brightness(1.03) saturate(1.12)",
    intensity: 100,
    thumbnailColor: "#FFFFFF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "luxury",
    name: "Luxury",
    category: "fashion",
    css:
      "contrast(1.22) brightness(.98) saturate(1.18)",
    intensity: 100,
    thumbnailColor: "#D8B24B",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "runway",
    name: "Runway",
    category: "fashion",
    css:
      "contrast(1.15) saturate(1.3)",
    intensity: 100,
    thumbnailColor: "#F0F0F0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "studio",
    name: "Studio",
    category: "fashion",
    css:
      "contrast(1.12) brightness(1.04)",
    intensity: 100,
    thumbnailColor: "#DADADA",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "high-contrast",
    name: "High Contrast",
    category: "fashion",
    css:
      "contrast(1.35) brightness(.98)",
    intensity: 100,
    thumbnailColor: "#B9B9B9",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Film
  // ------------------------------------------------------------------

  {
    id: "kodak-gold",
    name: "Kodak Gold",
    category: "film",
    css:
      "sepia(.18) saturate(1.25) brightness(1.05)",
    intensity: 100,
    thumbnailColor: "#D7A740",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portra",
    name: "Portra",
    category: "film",
    css:
      "sepia(.08) brightness(1.03) contrast(.95)",
    intensity: 100,
    thumbnailColor: "#F0C9A5",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "fuji",
    name: "Fuji",
    category: "film",
    css:
      "saturate(1.18) hue-rotate(-6deg)",
    intensity: 100,
    thumbnailColor: "#6DAE7A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "cinestill",
    name: "Cinestill",
    category: "film",
    css:
      "contrast(1.15) brightness(.98) saturate(1.08)",
    intensity: 100,
    thumbnailColor: "#336B8F",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "disposable",
    name: "Disposable",
    category: "film",
    css:
      "contrast(.92) saturate(1.18) brightness(1.08)",
    intensity: 100,
    thumbnailColor: "#D3B37C",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Vintage
  // ------------------------------------------------------------------

  {
    id: "retro",
    name: "Retro",
    category: "vintage",
    css:
      "sepia(.32) contrast(.94)",
    intensity: 100,
    thumbnailColor: "#B88A5A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "faded",
    name: "Faded",
    category: "vintage",
    css:
      "contrast(.82) brightness(1.1)",
    intensity: 100,
    thumbnailColor: "#C4B5A8",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "polaroid",
    name: "Polaroid",
    category: "vintage",
    css:
      "brightness(1.08) contrast(.9) sepia(.1)",
    intensity: 100,
    thumbnailColor: "#E8DCC7",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "dust",
    name: "Dust",
    category: "vintage",
    css:
      "contrast(.92) sepia(.12)",
    intensity: 100,
    thumbnailColor: "#A77F65",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vhs",
    name: "VHS",
    category: "vintage",
    css:
      "contrast(1.08) saturate(.82)",
    intensity: 100,
    thumbnailColor: "#73585B",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Black & White
  // ------------------------------------------------------------------

  {
    id: "classic-bw",
    name: "Classic",
    category: "bw",
    css:
      "grayscale(1)",
    intensity: 100,
    thumbnailColor: "#DADADA",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "noir",
    name: "Noir",
    category: "bw",
    css:
      "grayscale(1) contrast(1.35)",
    intensity: 100,
    thumbnailColor: "#999999",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "documentary",
    name: "Documentary",
    category: "bw",
    css:
      "grayscale(1) contrast(1.15)",
    intensity: 100,
    thumbnailColor: "#7E7E7E",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "matte-bw",
    name: "Matte BW",
    category: "bw",
    css:
      "grayscale(1) contrast(.88)",
    intensity: 100,
    thumbnailColor: "#BBBBBB",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Lifestyle
  // ------------------------------------------------------------------

  {
    id: "summer",
    name: "Summer",
    category: "lifestyle",
    css:
      "brightness(1.08) saturate(1.18)",
    intensity: 100,
    thumbnailColor: "#F7C95C",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "sunset",
    name: "Sunset",
    category: "lifestyle",
    css:
      "sepia(.12) saturate(1.22)",
    intensity: 100,
    thumbnailColor: "#F58549",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "coffee",
    name: "Coffee",
    category: "lifestyle",
    css:
      "sepia(.22) brightness(.96)",
    intensity: 100,
    thumbnailColor: "#8A5A3C",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "cozy",
    name: "Cozy",
    category: "lifestyle",
    css:
      "brightness(1.02) sepia(.08)",
    intensity: 100,
    thumbnailColor: "#C29E73",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "tropical",
    name: "Tropical",
    category: "lifestyle",
    css:
      "saturate(1.35) brightness(1.04)",
    intensity: 100,
    thumbnailColor: "#2AAE9A",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Creative
  // ------------------------------------------------------------------

  {
    id: "dream",
    name: "Dream",
    category: "creative",
    css:
      "brightness(1.08) contrast(.92) saturate(1.08)",
    intensity: 100,
    thumbnailColor: "#BFA3FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "neon",
    name: "Neon",
    category: "creative",
    css:
      "contrast(1.25) saturate(1.45)",
    intensity: 100,
    thumbnailColor: "#00E5FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "cyber",
    name: "Cyber",
    category: "creative",
    css:
      "hue-rotate(25deg) contrast(1.18) saturate(1.28)",
    intensity: 100,
    thumbnailColor: "#00B8FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "aqua",
    name: "Aqua",
    category: "creative",
    css:
      "hue-rotate(-18deg) saturate(1.2)",
    intensity: 100,
    thumbnailColor: "#00C8FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "ember",
    name: "Ember",
    category: "creative",
    css:
      "sepia(.25) saturate(1.35)",
    intensity: 100,
    thumbnailColor: "#D35A2A",
    isBuiltIn: true,
    premium: false,
  },
];

export const FILTER_CATEGORIES: FilterCategory[] = [
  "favorites",
  "portrait",
  "fashion",
  "film",
  "vintage",
  "bw",
  "lifestyle",
  "creative",
];