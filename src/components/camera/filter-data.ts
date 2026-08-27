import { compileFilter, compileLutOp, withAmount, type CompiledFilter } from "@/lib/canvas-filter";
import { recipe, type GradeRecipe } from "@/lib/lut/grade-recipe";
import { getLutTable } from "@/lib/lut/lut-registry";

export type FilterCategory =
  "favorites" | "portrait" | "fashion" | "film" | "vintage" | "bw" | "lifestyle" | "creative";

export interface CameraFilter {
  id: string;

  /** Display name shown to the user */
  name: string;

  /** Filter category used inside FilterPanel */
  category: FilterCategory;

  /** CSS filter string used for real-time preview only — the live camera
   *  feed, the recording draw loop, and any <video>/<img> element showing a
   *  live-updating frame. For a `grade` filter this is a close approximation
   *  of the true grade (a single color matrix can't reproduce split-toning),
   *  chosen because a per-pixel LUT sample every frame at 30-60fps is not
   *  something a phone should be asked to do live. The true grade only runs
   *  at one-shot bake points: shutter press and after-shot export. See
   *  compileGrade() below. */
  previewCss: string;

  /** The real grade — independent tone-curve regions, white balance and
   *  split-toning baked into a 3D LUT (lut-registry.ts) — applied at capture
   *  and export time. Filters without one are simple enough that previewCss
   *  (a plain color matrix) already *is* the real thing; there's no gap to
   *  close for e.g. a flat grayscale or contrast bump. */
  grade?: GradeRecipe;

  /** Used later for intensity sliders */
  intensity: number;

  /** Skeleton/placeholder tint shown while the real baked thumbnail loads */
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
    previewCss: "none",
    intensity: 100,
    thumbnailColor: "#7A7A7A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "soft-glow",
    name: "Soft Glow",
    category: "portrait",
    previewCss: "brightness(1.04) contrast(0.94) saturate(1.06)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.06,
      highlights: 0.08,
      contrast: -0.12,
      saturation: 0.05,
      temperature: 0.1,
      tint: -0.02,
      splitShadow: [0.52, 0.5, 0.48],
      splitHighlight: [0.58, 0.52, 0.46],
      splitStrength: 0.18,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#E5CDBF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "editorial",
    name: "Editorial",
    category: "portrait",
    previewCss: "contrast(1.1) brightness(1.0) saturate(0.88)",
    grade: recipe({
      shadows: -0.05,
      midtones: 0.02,
      highlights: 0.03,
      contrast: 0.18,
      saturation: -0.12,
      temperature: -0.02,
      tint: 0.01,
      splitShadow: [0.48, 0.49, 0.51],
      splitHighlight: [0.51, 0.505, 0.49],
      splitStrength: 0.1,
      fade: 0,
    }),
    intensity: 100,
    thumbnailColor: "#DDD8D2",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "clean-skin",
    name: "Clean Skin",
    category: "portrait",
    previewCss: "brightness(1.05) saturate(0.96) contrast(0.95)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.05,
      highlights: 0.05,
      contrast: -0.06,
      saturation: -0.04,
      temperature: 0.05,
      tint: -0.01,
      splitHighlight: [0.53, 0.505, 0.485],
      splitStrength: 0.08,
      fade: 0.04,
    }),
    intensity: 100,
    thumbnailColor: "#F3D6C8",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "matte-portrait",
    name: "Matte Portrait",
    category: "portrait",
    previewCss: "contrast(.88) brightness(1.05) saturate(.92)",
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
    previewCss: "contrast(1.18) brightness(1.03) saturate(1.12)",
    grade: recipe({
      shadows: -0.06,
      midtones: 0.02,
      highlights: 0.1,
      contrast: 0.22,
      saturation: 0.08,
      temperature: 0.02,
      splitShadow: [0.47, 0.48, 0.51],
      splitHighlight: [0.51, 0.505, 0.495],
      splitStrength: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#FFFFFF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "luxury",
    name: "Luxury",
    category: "fashion",
    previewCss: "contrast(1.22) brightness(.98) saturate(1.18)",
    grade: recipe({
      shadows: -0.08,
      highlights: 0.05,
      contrast: 0.2,
      saturation: 0.12,
      temperature: 0.14,
      tint: -0.02,
      splitShadow: [0.46, 0.47, 0.52],
      splitHighlight: [0.58, 0.51, 0.4],
      splitStrength: 0.22,
    }),
    intensity: 100,
    thumbnailColor: "#D8B24B",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "runway",
    name: "Runway",
    category: "fashion",
    previewCss: "contrast(1.15) saturate(1.3)",
    grade: recipe({
      shadows: -0.1,
      highlights: 0.06,
      contrast: 0.24,
      saturation: 0.18,
      splitShadow: [0.47, 0.47, 0.5],
      splitHighlight: [0.51, 0.5, 0.49],
      splitStrength: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#F0F0F0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "studio",
    name: "Studio",
    category: "fashion",
    previewCss: "contrast(1.12) brightness(1.04)",
    intensity: 100,
    thumbnailColor: "#DADADA",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "high-contrast",
    name: "High Contrast",
    category: "fashion",
    previewCss: "contrast(1.35) brightness(.98)",
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
    previewCss: "sepia(.18) saturate(1.25) brightness(1.05)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.03,
      highlights: 0.06,
      contrast: 0.06,
      saturation: 0.1,
      temperature: 0.16,
      tint: -0.03,
      splitShadow: [0.53, 0.5, 0.44],
      splitHighlight: [0.6, 0.53, 0.38],
      splitStrength: 0.2,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#D7A740",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portra",
    name: "Portra",
    category: "film",
    previewCss: "sepia(.08) brightness(1.03) contrast(.95)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.03,
      highlights: 0.03,
      contrast: -0.1,
      saturation: -0.03,
      temperature: 0.08,
      tint: 0.01,
      splitShadow: [0.52, 0.5, 0.47],
      splitHighlight: [0.55, 0.51, 0.46],
      splitStrength: 0.14,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#F0C9A5",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "fuji",
    name: "Fuji",
    category: "film",
    previewCss: "saturate(1.18) hue-rotate(-6deg)",
    grade: recipe({
      highlights: 0.02,
      contrast: 0.08,
      saturation: 0.1,
      temperature: -0.06,
      tint: 0.04,
      splitShadow: [0.47, 0.51, 0.49],
      splitHighlight: [0.49, 0.52, 0.48],
      splitStrength: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#6DAE7A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "cinestill",
    name: "Cinestill",
    category: "film",
    previewCss: "contrast(1.15) brightness(.98) saturate(1.08)",
    grade: recipe({
      shadows: -0.06,
      midtones: -0.01,
      highlights: 0.02,
      contrast: 0.14,
      saturation: 0.04,
      temperature: 0.04,
      splitShadow: [0.42, 0.49, 0.56],
      splitHighlight: [0.58, 0.5, 0.42],
      splitStrength: 0.24,
    }),
    intensity: 100,
    thumbnailColor: "#336B8F",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "disposable",
    name: "Disposable",
    category: "film",
    previewCss: "contrast(.92) saturate(1.18) brightness(1.08)",
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
    previewCss: "sepia(.32) contrast(.94)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.02,
      contrast: -0.08,
      saturation: -0.15,
      temperature: 0.12,
      tint: 0.02,
      splitShadow: [0.53, 0.49, 0.42],
      splitHighlight: [0.55, 0.5, 0.4],
      splitStrength: 0.2,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#B88A5A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "faded",
    name: "Faded",
    category: "vintage",
    previewCss: "contrast(.82) brightness(1.1)",
    intensity: 100,
    thumbnailColor: "#C4B5A8",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "polaroid",
    name: "Polaroid",
    category: "vintage",
    previewCss: "brightness(1.08) contrast(.9) sepia(.1)",
    grade: recipe({
      shadows: 0.08,
      midtones: 0.04,
      highlights: 0.02,
      contrast: -0.16,
      saturation: -0.06,
      temperature: 0.1,
      tint: 0.02,
      splitShadow: [0.54, 0.5, 0.44],
      splitHighlight: [0.56, 0.51, 0.42],
      splitStrength: 0.16,
      fade: 0.22,
    }),
    intensity: 100,
    thumbnailColor: "#E8DCC7",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "dust",
    name: "Dust",
    category: "vintage",
    previewCss: "contrast(.92) sepia(.12)",
    grade: recipe({
      shadows: 0.05,
      midtones: 0.02,
      highlights: 0.03,
      contrast: -0.1,
      saturation: -0.12,
      temperature: 0.08,
      tint: 0.01,
      splitShadow: [0.52, 0.5, 0.46],
      splitHighlight: [0.55, 0.51, 0.42],
      splitStrength: 0.12,
      fade: 0.16,
    }),
    intensity: 100,
    thumbnailColor: "#A77F65",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vhs",
    name: "VHS",
    category: "vintage",
    previewCss: "contrast(1.08) saturate(.82)",
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
    previewCss: "grayscale(1)",
    intensity: 100,
    thumbnailColor: "#DADADA",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "noir",
    name: "Noir",
    category: "bw",
    previewCss: "grayscale(1) contrast(1.35)",
    grade: recipe({
      shadows: -0.1,
      highlights: 0.06,
      contrast: 0.3,
      saturation: -1,
    }),
    intensity: 100,
    thumbnailColor: "#999999",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "documentary",
    name: "Documentary",
    category: "bw",
    previewCss: "grayscale(1) contrast(1.15)",
    intensity: 100,
    thumbnailColor: "#7E7E7E",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "matte-bw",
    name: "Matte BW",
    category: "bw",
    previewCss: "grayscale(1) contrast(.88)",
    intensity: 100,
    thumbnailColor: "#BBBBBB",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "duotone-blue",
    name: "Duotone",
    category: "bw",
    previewCss: "grayscale(1) contrast(1.1)",
    grade: recipe({
      contrast: 0.1,
      saturation: -1,
      splitShadow: [0.42, 0.46, 0.58],
      splitHighlight: [0.58, 0.53, 0.42],
      splitStrength: 0.35,
    }),
    intensity: 100,
    thumbnailColor: "#4A5A73",
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
    previewCss: "brightness(1.08) saturate(1.18)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.06,
      contrast: 0.04,
      saturation: 0.14,
      temperature: 0.1,
      tint: -0.01,
      splitHighlight: [0.58, 0.53, 0.38],
      splitStrength: 0.18,
    }),
    intensity: 100,
    thumbnailColor: "#F7C95C",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "sunset",
    name: "Sunset",
    category: "lifestyle",
    previewCss: "sepia(.12) saturate(1.22)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.02,
      highlights: 0.08,
      saturation: 0.12,
      temperature: 0.2,
      tint: -0.03,
      splitShadow: [0.48, 0.46, 0.5],
      splitHighlight: [0.62, 0.5, 0.3],
      splitStrength: 0.28,
    }),
    intensity: 100,
    thumbnailColor: "#F58549",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "coffee",
    name: "Coffee",
    category: "lifestyle",
    previewCss: "sepia(.22) brightness(.96)",
    intensity: 100,
    thumbnailColor: "#8A5A3C",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "cozy",
    name: "Cozy",
    category: "lifestyle",
    previewCss: "brightness(1.02) sepia(.08)",
    intensity: 100,
    thumbnailColor: "#C29E73",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "tropical",
    name: "Tropical",
    category: "lifestyle",
    previewCss: "saturate(1.35) brightness(1.04)",
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
    previewCss: "brightness(1.08) contrast(.92) saturate(1.08)",
    intensity: 100,
    thumbnailColor: "#BFA3FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "neon",
    name: "Neon",
    category: "creative",
    previewCss: "contrast(1.25) saturate(1.45)",
    intensity: 100,
    thumbnailColor: "#00E5FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "cyber",
    name: "Cyber",
    category: "creative",
    previewCss: "hue-rotate(25deg) contrast(1.18) saturate(1.28)",
    intensity: 100,
    thumbnailColor: "#00B8FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "aqua",
    name: "Aqua",
    category: "creative",
    previewCss: "hue-rotate(-18deg) saturate(1.2)",
    intensity: 100,
    thumbnailColor: "#00C8FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "ember",
    name: "Ember",
    category: "creative",
    previewCss: "sepia(.25) saturate(1.35)",
    intensity: 100,
    thumbnailColor: "#D35A2A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "teal-orange",
    name: "Blockbuster",
    category: "creative",
    previewCss: "contrast(1.12) saturate(1.15)",
    grade: recipe({
      shadows: -0.04,
      highlights: 0.02,
      contrast: 0.12,
      saturation: 0.06,
      splitShadow: [0.38, 0.48, 0.58],
      splitHighlight: [0.6, 0.5, 0.36],
      splitStrength: 0.4,
    }),
    intensity: 100,
    thumbnailColor: "#2A6B6B",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bleach-bypass",
    name: "Bleach Bypass",
    category: "creative",
    previewCss: "contrast(1.3) saturate(.6)",
    grade: recipe({
      shadows: -0.1,
      midtones: -0.02,
      highlights: 0.04,
      contrast: 0.28,
      saturation: -0.4,
      temperature: -0.05,
      tint: 0.02,
      splitShadow: [0.46, 0.48, 0.52],
      splitStrength: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#8A8F87",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "cherry",
    name: "Cherry",
    category: "creative",
    previewCss: "contrast(1.15) saturate(1.3) hue-rotate(-5deg)",
    grade: recipe({
      shadows: -0.02,
      highlights: 0.03,
      contrast: 0.14,
      saturation: 0.14,
      temperature: 0.02,
      tint: 0.06,
      splitShadow: [0.54, 0.44, 0.5],
      splitHighlight: [0.58, 0.46, 0.52],
      splitStrength: 0.26,
    }),
    intensity: 100,
    thumbnailColor: "#C23B5C",
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

/** A filter is a true no-op when it has neither a grade nor a preview matrix
 *  (that's exactly "natural"), or when it's been dialed down to 0% strength.
 *  Used to skip baking entirely (capture/export fast paths) rather than
 *  running a pixel pass for nothing. */
export function isNoopFilter(filter: CameraFilter, intensity: number = filter.intensity): boolean {
  if (intensity <= 0) return true;
  return !filter.grade && (!filter.previewCss || filter.previewCss === "none");
}

/** Resolves a CameraFilter to the CompiledFilter it should bake with — the
 *  true LUT grade when it has one, otherwise the same matrix its previewCss
 *  already describes (so a filter without a `grade` bakes pixel-identical to
 *  what the live preview showed). This is the one place that decides "true
 *  grade vs. preview approximation" for the whole app; every capture/export
 *  call site should go through this rather than picking previewCss vs. grade
 *  itself.
 *
 *  `intensity` is 0..100 (matching the CameraFilter field it defaults from)
 *  and lerps the result back toward the untouched original — see
 *  canvas-filter.ts's `amount`. */
export function compileGrade(
  filter: CameraFilter,
  intensity: number = filter.intensity,
): CompiledFilter {
  const base = filter.grade
    ? compileLutOp(getLutTable(filter.id, filter.grade))
    : compileFilter(filter.previewCss);
  return intensity >= 100 ? base : withAmount(base, Math.max(0, intensity) / 100);
}

/** Scales previewCss's function parameters toward each function's identity
 *  value by `intensity` (0..100) — the live-preview equivalent of
 *  compileGrade's `amount`. A CSS filter string has no native "50% of this
 *  filter" operator, so each function is individually lerped: brightness/
 *  contrast/saturate toward 1, grayscale/sepia/hue-rotate toward 0. Used
 *  everywhere previewCss drives a real-time style.filter (camera feed,
 *  after-shot's live media element) so dragging the intensity slider is
 *  actually visible, not just baked in silently at export. */
export function previewCssAtIntensity(filter: CameraFilter, intensity: number): string {
  if (intensity >= 100 || !filter.previewCss || filter.previewCss === "none") {
    return filter.previewCss;
  }
  const amount = Math.max(0, intensity) / 100;
  const fnRe = /([\w-]+)\(([^)]+)\)/g;
  return filter.previewCss.replace(fnRe, (whole, name: string, raw: string) => {
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return whole;
    switch (name) {
      case "brightness":
      case "contrast":
      case "saturate":
        return `${name}(${(1 + (value - 1) * amount).toFixed(4)})`;
      case "sepia":
      case "grayscale":
        return `${name}(${(value * amount).toFixed(4)})`;
      case "hue-rotate":
        return `hue-rotate(${(value * amount).toFixed(2)}deg)`;
      default:
        return whole;
    }
  });
}
