import { compileFilter, compileLutOp, withAmount, type CompiledFilter } from "@/lib/canvas-filter";
import { recipe, type GradeRecipe } from "@/lib/lut/grade-recipe";
import { getLutTable } from "@/lib/lut/lut-registry";

export type FilterCategory =
  | "favorites"
  | "style"
  | "portrait"
  | "mood"
  | "night"
  | "food"
  | "pet"
  | "pro"
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
  // Style (Samsung-inspired: Standard, Vivid, Natural, etc.)
  // ------------------------------------------------------------------

  {
    id: "natural-style",
    name: "Natural",
    category: "style",
    previewCss: "none",
    intensity: 100,
    thumbnailColor: "#7A7A7A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vivid-style",
    name: "Vivid",
    category: "style",
    previewCss: "saturate(1.25) contrast(1.1) brightness(1.02)",
    intensity: 100,
    thumbnailColor: "#FFD54F",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "standard-style",
    name: "Standard",
    category: "style",
    previewCss: "contrast(1.05) brightness(1.01) saturate(1.03)",
    intensity: 100,
    thumbnailColor: "#E0E0E0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "retro-style",
    name: "Retro",
    category: "style",
    previewCss: "sepia(.2) contrast(1.05) brightness(.98)",
    intensity: 100,
    thumbnailColor: "#D7CCC8",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "mono-style",
    name: "Mono",
    category: "style",
    previewCss: "grayscale(1) contrast(.95) brightness(1.02)",
    intensity: 100,
    thumbnailColor: "#BDBDBD",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Portrait (Enhanced Samsung Beauty & Portrait modes)
  // ------------------------------------------------------------------

  {
    id: "portrait-natural",
    name: "Natural",
    category: "portrait",
    previewCss: "none",
    intensity: 100,
    thumbnailColor: "#7A7A7A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portrait-soft",
    name: "Soft",
    category: "portrait",
    previewCss: "brightness(1.03) contrast(0.95) saturate(1.02)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.05,
      contrast: -0.08,
      saturation: 0.02,
      temperature: 0.03,
      tint: -0.01,
      splitShadow: [0.5, 0.5, 0.49],
      splitHighlight: [0.51, 0.51, 0.5],
      splitStrength: 0.05,
      fade: 0.02,
    }),
    intensity: 100,
    thumbnailColor: "#F8EDE0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portrait-bright",
    name: "Bright",
    category: "portrait",
    previewCss: "brightness(1.08) saturate(1.05) contrast(1.02)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.06,
      highlights: 0.08,
      contrast: 0.05,
      saturation: 0.08,
      temperature: 0.05,
      tint: -0.02,
      splitHighlight: [0.53, 0.5, 0.47],
      splitStrength: 0.12,
      fade: 0.04,
    }),
    intensity: 100,
    thumbnailColor: "#FFF3E0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portrait-warm",
    name: "Warm",
    category: "portrait",
    previewCss: "brightness(1.02) contrast(.98) saturate(1.04)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.03,
      highlights: 0.06,
      contrast: -0.04,
      saturation: 0.06,
      temperature: 0.12,
      tint: 0.02,
      splitShadow: [0.54, 0.51, 0.48],
      splitHighlight: [0.56, 0.52, 0.48],
      splitStrength: 0.15,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#FFE0B2",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portrait-vibrant",
    name: "Vibrant",
    category: "portrait",
    previewCss: "contrast(1.15) saturate(1.18) brightness(1.03)",
    grade: recipe({
      shadows: -0.02,
      midtones: 0.04,
      highlights: 0.08,
      contrast: 0.15,
      saturation: 0.12,
      temperature: 0.04,
      tint: 0.01,
      splitHighlight: [0.52, 0.48, 0.44],
      splitStrength: 0.2,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#FFCC80",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portrait-glow",
    name: "Glow",
    category: "portrait",
    previewCss: "brightness(1.06) contrast(1.08) saturate(1.12)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.08,
      highlights: 0.12,
      contrast: 0.1,
      saturation: 0.15,
      temperature: 0.08,
      tint: -0.03,
      splitHighlight: [0.54, 0.5, 0.46],
      splitStrength: 0.25,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#FFE082",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "beauty-plus",
    name: "Beauty+",
    category: "portrait",
    previewCss: "brightness(1.04) contrast(.96) saturate(.98)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.05,
      highlights: 0.07,
      contrast: -0.06,
      saturation: -0.02,
      temperature: 0.05,
      tint: -0.01,
      splitHighlight: [0.52, 0.5, 0.48],
      splitStrength: 0.1,
      fade: 0.05,
    }),
    intensity: 100,
    thumbnailColor: "#F5F5F5",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Mood/Atmosphere (Samsung Scene Optimizer inspired)
  // ------------------------------------------------------------------

  {
    id: "mood-sunny",
    name: "Sunny",
    category: "mood",
    previewCss: "brightness(1.1) saturate(1.15) hue-rotate(5deg)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.04,
      highlights: 0.08,
      contrast: 0.08,
      saturation: 0.18,
      temperature: 0.15,
      tint: -0.05,
      splitHighlight: [0.58, 0.5, 0.4],
      splitStrength: 0.25,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#FFF176",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "mood-cloudy",
    name: "Cloudy",
    category: "mood",
    previewCss: "brightness(1.02) contrast(.95) saturate(.98)",
    grade: recipe({
      shadows: -0.01,
      midtones: -0.02,
      highlights: 0.0,
      contrast: -0.05,
      saturation: -0.02,
      temperature: 0.02,
      tint: 0.01,
      splitShadow: [0.5, 0.5, 0.5],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.03,
      fade: 0.02,
    }),
    intensity: 100,
    thumbnailColor: "#E0E0E0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "mood-dramatic",
    name: "Dramatic",
    category: "mood",
    previewCss: "contrast(1.25) saturate(.9) brightness(.95)",
    grade: recipe({
      shadows: -0.08,
      midtones: -0.02,
      highlights: 0.02,
      contrast: 0.25,
      saturation: -0.08,
      temperature: -0.03,
      tint: 0.02,
      splitShadow: [0.45, 0.47, 0.51],
      splitHighlight: [0.55, 0.53, 0.49],
      splitStrength: 0.2,
      fade: 0.05,
    }),
    intensity: 100,
    thumbnailColor: "#BDBDBD",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "mood-serene",
    name: "Serene",
    category: "mood",
    previewCss: "brightness(.98) saturate(1.08) hue-rotate(-10deg)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.05,
      highlights: 0.06,
      contrast: -0.03,
      saturation: 0.12,
      temperature: -0.08,
      tint: 0.03,
      splitShadow: [0.46, 0.49, 0.53],
      splitHighlight: [0.51, 0.5, 0.49],
      splitStrength: 0.15,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#81D4FA",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "mood-mystic",
    name: "Mystic",
    category: "mood",
    previewCss: "contrast(1.1) saturate(1.25) brightness(1.02)",
    grade: recipe({
      shadows: 0.0,
      midtones: 0.03,
      highlights: 0.08,
      contrast: 0.1,
      saturation: 0.18,
      temperature: 0.02,
      tint: 0.05,
      splitHighlight: [0.48, 0.44, 0.4],
      splitStrength: 0.3,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#CE93D8",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Night Mode (Samsung Nightography inspired)
  // ------------------------------------------------------------------

  {
    id: "night-standard",
    name: "Night",
    category: "night",
    previewCss: "brightness(1.15) contrast(1.1) saturate(1.08)",
    grade: recipe({
      shadows: 0.15,
      midtones: 0.08,
      highlights: 0.02,
      contrast: 0.18,
      saturation: 0.1,
      temperature: 0.05,
      tint: -0.02,
      splitShadow: [0.45, 0.48, 0.52],
      splitHighlight: [0.52, 0.5, 0.46],
      splitStrength: 0.15,
      fade: 0.05,
    }),
    intensity: 100,
    thumbnailColor: "#2E294E",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "night-portrait",
    name: "Night Portrait",
    category: "night",
    previewCss: "brightness(1.08) contrast(1.05) saturate(1.12)",
    grade: recipe({
      shadows: 0.08,
      midtones: 0.05,
      highlights: 0.04,
      contrast: 0.12,
      saturation: 0.15,
      temperature: 0.08,
      tint: -0.03,
      splitHighlight: [0.54, 0.5, 0.46],
      splitStrength: 0.18,
      fade: 0.07,
    }),
    intensity: 100,
    thumbnailColor: "#4A235A",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "night-landscape",
    name: "Night Landscape",
    category: "night",
    previewCss: "brightness(1.12) contrast(1.15) saturate(.95)",
    grade: recipe({
      shadows: 0.12,
      midtones: 0.06,
      highlights: 0.01,
      contrast: 0.2,
      saturation: 0.05,
      temperature: -0.03,
      tint: 0.01,
      splitShadow: [0.4, 0.45, 0.52],
      splitHighlight: [0.55, 0.5, 0.44],
      splitStrength: 0.2,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#1A237E",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "night-vibrant",
    name: "Vibrant Night",
    category: "night",
    previewCss: "brightness(1.18) contrast(1.08) saturate(1.25)",
    grade: recipe({
      shadows: 0.1,
      midtones: 0.05,
      highlights: 0.03,
      contrast: 0.15,
      saturation: 0.2,
      temperature: 0.08,
      tint: -0.04,
      splitHighlight: [0.55, 0.5, 0.43],
      splitStrength: 0.25,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#0D47A1",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Food (Samsung Food Mode inspired)
  // ------------------------------------------------------------------

  {
    id: "food-fresh",
    name: "Fresh",
    category: "food",
    previewCss: "saturate(1.3) brightness(1.05) contrast(1.02)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.06,
      highlights: 0.08,
      contrast: 0.04,
      saturation: 0.2,
      temperature: 0.06,
      tint: -0.02,
      splitHighlight: [0.55, 0.5, 0.43],
      splitStrength: 0.25,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#A5D6A7",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "food-rich",
    name: "Rich",
    category: "food",
    previewCss: "saturate(1.1) contrast(1.15) brightness(.98)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.04,
      highlights: 0.05,
      contrast: 0.18,
      saturation: 0.15,
      temperature: 0.04,
      tint: -0.01,
      splitHighlight: [0.52, 0.48, 0.44],
      splitStrength: 0.2,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#8D6E63",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "food-vibrant",
    name: "Vibrant Food",
    category: "food",
    previewCss: "saturate(1.4) brightness(1.08) contrast(1.05)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.08,
      highlights: 0.1,
      contrast: 0.08,
      saturation: 0.25,
      temperature: 0.08,
      tint: -0.03,
      splitHighlight: [0.58, 0.52, 0.4],
      splitStrength: 0.3,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#FF8A65",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "food-warm",
    name: "Warm Food",
    category: "food",
    previewCss: "brightness(1.03) contrast(.95) saturate(1.1)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.03,
      highlights: 0.06,
      contrast: -0.04,
      saturation: 0.12,
      temperature: 0.1,
      tint: 0.02,
      splitHighlight: [0.55, 0.5, 0.45],
      splitStrength: 0.15,
      fade: 0.05,
    }),
    intensity: 100,
    thumbnailColor: "#FFCC80",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Pet Mode (Samsung Pet Mode inspired)
  // ------------------------------------------------------------------

  {
    id: "pet-playful",
    name: "Playful",
    category: "pet",
    previewCss: "saturate(1.2) brightness(1.05) contrast(1.03)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.05,
      highlights: 0.07,
      contrast: 0.05,
      saturation: 0.18,
      temperature: 0.04,
      tint: -0.02,
      splitHighlight: [0.53, 0.49, 0.45],
      splitStrength: 0.2,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#81C784",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pet-cute",
    name: "Cute",
    category: "pet",
    previewCss: "brightness(1.08) saturate(1.15) contrast(.98)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.08,
      highlights: 0.1,
      contrast: -0.02,
      saturation: 0.15,
      temperature: 0.06,
      tint: -0.03,
      splitHighlight: [0.55, 0.5, 0.45],
      splitStrength: 0.22,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#F48FB1",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pet-sharp",
    name: "Sharp",
    category: "pet",
    previewCss: "contrast(1.15) brightness(1.02) saturate(.98)",
    grade: recipe({
      shadows: -0.02,
      midtones: 0.0,
      highlights: 0.04,
      contrast: 0.18,
      saturation: -0.02,
      temperature: -0.01,
      tint: 0.01,
      splitHighlight: [0.49, 0.5, 0.51],
      splitStrength: 0.1,
      fade: 0.03,
    }),
    intensity: 100,
    thumbnailColor: "#B0BEC5",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Pro Controls (For advanced users)
  // ------------------------------------------------------------------

  {
    id: "pro-cinema",
    name: "Cinema",
    category: "pro",
    previewCss: "contrast(1.18) saturate(1.12) brightness(.95)",
    grade: recipe({
      shadows: -0.03,
      midtones: 0.0,
      highlights: 0.04,
      contrast: 0.22,
      saturation: 0.1,
      temperature: 0.02,
      tint: -0.01,
      splitShadow: [0.38, 0.48, 0.58],
      splitHighlight: [0.6, 0.5, 0.36],
      splitStrength: 0.4,
      fade: 0.05,
    }),
    intensity: 100,
    thumbnailColor: "#1B5E20",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pro-vlog",
    name: "V-Log",
    category: "pro",
    previewCss: "contrast(.9) saturate(.85) brightness(1.05)",
    grade: recipe({
      shadows: 0.08,
      midtones: 0.04,
      highlights: 0.02,
      contrast: -0.1,
      saturation: -0.1,
      temperature: 0.02,
      tint: -0.01,
      splitShadow: [0.52, 0.5, 0.48],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.05,
      fade: 0.15,
    }),
    intensity: 100,
    thumbnailColor: "#424242",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pro-slog2",
    name: "S-Log2",
    category: "pro",
    previewCss: "contrast(.85) saturate(.8) brightness(1.08)",
    grade: recipe({
      shadows: 0.12,
      midtones: 0.06,
      highlights: 0.03,
      contrast: -0.15,
      saturation: -0.08,
      temperature: -0.02,
      tint: 0.01,
      splitShadow: [0.54, 0.5, 0.46],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.03,
      fade: 0.2,
    }),
    intensity: 100,
    thumbnailColor: "#212121",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pro-bw-film",
    name: "BW Film",
    category: "pro",
    previewCss: "grayscale(1) contrast(1.25)",
    grade: recipe({
      contrast: 0.25,
      saturation: -1,
    }),
    intensity: 100,
    thumbnailColor: "#E0E0E0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pro-cross-process",
    name: "Cross Process",
    category: "pro",
    previewCss: "contrast(1.1) saturate(1.2) hue-rotate(15deg)",
    grade: recipe({
      shadows: 0.0,
      midtones: 0.04,
      highlights: 0.06,
      contrast: 0.12,
      saturation: 0.12,
      temperature: 0.02,
      tint: 0.06,
      splitShadow: [0.42, 0.44, 0.54],
      splitHighlight: [0.58, 0.52, 0.4],
      splitStrength: 0.25,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#BF360C",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Film (Enhanced with more looks)
  // ------------------------------------------------------------------

  {
    id: "film-portra-400",
    name: "Portra 400",
    category: "film",
    previewCss: "sepia(.08) brightness(1.02) contrast(.95)",
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
    id: "film-ektar-100",
    name: "Ektar 100",
    category: "film",
    previewCss: "sepia(.05) saturate(1.15) brightness(1.03)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.03,
      highlights: 0.05,
      contrast: 0.03,
      saturation: 0.12,
      temperature: 0.1,
      tint: -0.02,
      splitHighlight: [0.55, 0.52, 0.46],
      splitStrength: 0.15,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#D4A373",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "film-trix-400",
    name: "Tri-X 400",
    category: "film",
    previewCss: "grayscale(1) contrast(1.3) brightness(.98)",
    grade: recipe({
      shadows: -0.05,
      midtones: -0.02,
      highlights: 0.03,
      contrast: 0.3,
      saturation: -1,
    }),
    intensity: 100,
    thumbnailColor: "#757575",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "film-supreme",
    name: "Supreme",
    category: "film",
    previewCss: "contrast(1.2) saturate(1.1) brightness(1.02)",
    grade: recipe({
      shadows: -0.02,
      midtones: 0.02,
      highlights: 0.06,
      contrast: 0.2,
      saturation: 0.08,
      temperature: 0.04,
      tint: 0.01,
      splitHighlight: [0.52, 0.48, 0.44],
      splitStrength: 0.25,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#3E2723",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Vintage (Expanded)
  // ------------------------------------------------------------------

  {
    id: "vintage-1970",
    name: "1970s",
    category: "vintage",
    previewCss: "sepia(.25) contrast(.9) brightness(1.02)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.02,
      highlights: 0.04,
      contrast: -0.08,
      saturation: -0.1,
      temperature: 0.12,
      tint: 0.03,
      splitShadow: [0.53, 0.5, 0.45],
      splitHighlight: [0.55, 0.5, 0.45],
      splitStrength: 0.2,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#BCAAA4",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vintage-1980",
    name: "1980s",
    category: "vintage",
    previewCss: "saturate(1.1) brightness(1.05) contrast(.95)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.06,
      contrast: -0.04,
      saturation: 0.1,
      temperature: 0.05,
      tint: -0.01,
      splitHighlight: [0.53, 0.49, 0.45],
      splitStrength: 0.15,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#FFF9C4",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vintage-toy",
    name: "Toy Camera",
    category: "vintage",
    previewCss: "contrast(.88) brightness(1.08) saturate(1.1)",
    intensity: 100,
    thumbnailColor: "#E8EAF6",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vintage-infrared",
    name: "Infrared",
    category: "vintage",
    previewCss: "brightness(.95) saturate(.85) hue-rotate(-30deg)",
    grade: recipe({
      shadows: -0.02,
      midtones: -0.01,
      highlights: 0.01,
      contrast: 0.05,
      saturation: -0.1,
      temperature: -0.15,
      tint: 0.05,
      splitShadow: [0.3, 0.35, 0.45],
      splitHighlight: [0.65, 0.6, 0.4],
      splitStrength: 0.35,
      fade: 0.15,
    }),
    intensity: 100,
    thumbnailColor: "#8BC34A",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // B&W (More artistic options)
  // ------------------------------------------------------------------

  {
    id: "bw-high-contrast",
    name: "High Contrast B&W",
    category: "bw",
    previewCss: "grayscale(1) contrast(1.4)",
    grade: recipe({
      shadows: -0.12,
      highlights: 0.08,
      contrast: 0.35,
      saturation: -1,
    }),
    intensity: 100,
    thumbnailColor: "#FFFFFF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bw-low-contrast",
    name: "Low Contrast B&W",
    category: "bw",
    previewCss: "grayscale(1) contrast(.85)",
    grade: recipe({
      shadows: 0.05,
      midtones: 0.02,
      highlights: 0.01,
      contrast: -0.15,
      saturation: -1,
    }),
    intensity: 100,
    thumbnailColor: "#CCCCCC",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bw-sepia",
    name: "Sepia B&W",
    category: "bw",
    previewCss: "grayscale(1) sepia(.2)",
    grade: recipe({
      contrast: 0.0,
      saturation: -0.8,
      splitShadow: [0.5, 0.45, 0.4],
      splitHighlight: [0.6, 0.55, 0.5],
      splitStrength: 0.2,
    }),
    intensity: 100,
    thumbnailColor: "#A1887F",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bw-blue-tone",
    name: "Blue Tone B&W",
    category: "bw",
    previewCss: "grayscale(1) contrast(1.1)",
    grade: recipe({
      contrast: 0.1,
      saturation: -1,
      splitShadow: [0.35, 0.4, 0.45],
      splitHighlight: [0.55, 0.5, 0.45],
      splitStrength: 0.3,
    }),
    intensity: 100,
    thumbnailColor: "#90CAF9",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Lifestyle (More casual options)
  // ------------------------------------------------------------------

  {
    id: "lifestyle-festival",
    name: "Festival",
    category: "lifestyle",
    previewCss: "saturate(1.35) brightness(1.05) contrast(1.02)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.05,
      highlights: 0.08,
      contrast: 0.04,
      saturation: 0.2,
      temperature: 0.06,
      tint: -0.02,
      splitHighlight: [0.55, 0.5, 0.43],
      splitStrength: 0.25,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#FFEB3B",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "lifestyle-beach",
    name: "Beach",
    category: "lifestyle",
    previewCss: "brightness(1.08) saturate(1.1) hue-rotate(-5deg)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.06,
      contrast: 0.03,
      saturation: 0.14,
      temperature: 0.1,
      tint: -0.03,
      splitHighlight: [0.58, 0.5, 0.4],
      splitStrength: 0.2,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#4FC3F7",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "lifestyle-urban",
    name: "Urban",
    category: "lifestyle",
    previewCss: "contrast(1.1) saturate(.95) brightness(.98)",
    grade: recipe({
      shadows: -0.02,
      midtones: 0.0,
      highlights: 0.04,
      contrast: 0.12,
      saturation: -0.03,
      temperature: -0.02,
      tint: 0.01,
      splitHighlight: [0.49, 0.5, 0.51],
      splitStrength: 0.15,
      fade: 0.04,
    }),
    intensity: 100,
    thumbnailColor: "#616161",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "lifestyle-cozy",
    name: "Cozy",
    category: "lifestyle",
    previewCss: "brightness(1.02) saturate(1.05) sepia(.08)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.03,
      highlights: 0.05,
      contrast: -0.01,
      saturation: 0.08,
      temperature: 0.06,
      tint: 0.02,
      splitHighlight: [0.53, 0.5, 0.47],
      splitStrength: 0.12,
      fade: 0.03,
    }),
    intensity: 100,
    thumbnailColor: "#BCAAA4",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Creative (More fun and artistic effects)
  // ------------------------------------------------------------------

  {
    id: "creative-pop",
    name: "Pop",
    category: "creative",
    previewCss: "saturate(1.4) contrast(1.2) brightness(1.02)",
    grade: recipe({
      shadows: 0.0,
      midtones: 0.06,
      highlights: 0.1,
      contrast: 0.2,
      saturation: 0.25,
      temperature: 0.02,
      tint: 0.01,
      splitHighlight: [0.52, 0.48, 0.44],
      splitStrength: 0.35,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#FF1744",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-dream",
    name: "Dream",
    category: "creative",
    previewCss: "brightness(1.08) contrast(.92) saturate(1.08)",
    intensity: 100,
    thumbnailColor: "#B39DDB",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-neon",
    name: "Neon",
    category: "creative",
    previewCss: "contrast(1.25) saturate(1.45)",
    intensity: 100,
    thumbnailColor: "#00E5FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-lomo",
    name: "Lomo",
    category: "creative",
    previewCss: "contrast(1.1) saturate(1.3)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.06,
      contrast: 0.12,
      saturation: 0.18,
      temperature: 0.02,
      tint: 0.01,
      splitHighlight: [0.51, 0.48, 0.45],
      splitStrength: 0.25,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#F44336",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-instamatic",
    name: "Instamatic",
    category: "creative",
    previewCss: "contrast(.9) brightness(1.05) saturate(1.15)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.05,
      highlights: 0.07,
      contrast: -0.08,
      saturation: 0.15,
      temperature: 0.04,
      tint: -0.02,
      splitHighlight: [0.54, 0.5, 0.46],
      splitStrength: 0.2,
      fade: 0.07,
    }),
    intensity: 100,
    thumbnailColor: "#E8EAF6",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-double-exposure",
    name: "Double Exp",
    category: "creative",
    previewCss: "contrast(1.1) brightness(1.02) saturate(1.05)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.03,
      highlights: 0.05,
      contrast: 0.12,
      saturation: 0.06,
      temperature: 0.02,
      tint: 0.01,
      splitHighlight: [0.5, 0.49, 0.48],
      splitStrength: 0.15,
      fade: 0.04,
    }),
    intensity: 100,
    thumbnailColor: "#9E9E9E",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-glitch",
    name: "Glitch",
    category: "creative",
    previewCss: "hue-rotate(10deg) contrast(1.15) saturate(1.08)",
    intensity: 100,
    thumbnailColor: "#00BFA5",
    isBuiltIn: true,
    premium: false,
  },
  {
    id: "pro-slog3",
    name: "S-Log3",
    category: "pro",
    previewCss: "contrast(.8) saturate(.75) brightness(1.1)",
    grade: recipe({
      shadows: 0.15,
      midtones: 0.08,
      highlights: 0.04,
      contrast: -0.2,
      saturation: -0.1,
      temperature: -0.03,
      tint: 0.01,
      splitShadow: [0.55, 0.5, 0.45],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.02,
      fade: 0.25,
    }),
    intensity: 100,
    thumbnailColor: "#121212",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pro-arric",
    name: "Arri LogC",
    category: "pro",
    previewCss: "contrast(.88) saturate(.82) brightness(1.06)",
    grade: recipe({
      shadows: 0.1,
      midtones: 0.05,
      highlights: 0.03,
      contrast: -0.12,
      saturation: -0.08,
      temperature: -0.02,
      tint: 0.0,
      splitShadow: [0.52, 0.5, 0.48],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.04,
      fade: 0.18,
    }),
    intensity: 100,
    thumbnailColor: "#263238",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pro-canondlog",
    name: "Canon Log",
    category: "pro",
    previewCss: "contrast(.86) saturate(.8) brightness(1.07)",
    grade: recipe({
      shadows: 0.11,
      midtones: 0.05,
      highlights: 0.03,
      contrast: -0.14,
      saturation: -0.08,
      temperature: -0.02,
      tint: 0.01,
      splitShadow: [0.53, 0.5, 0.47],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.03,
      fade: 0.2,
    }),
    intensity: 100,
    thumbnailColor: "#212121",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pro-redlogfilm",
    name: "RED LogFilm",
    category: "pro",
    previewCss: "contrast(.84) saturate(.78) brightness(1.09)",
    grade: recipe({
      shadows: 0.13,
      midtones: 0.07,
      highlights: 0.03,
      contrast: -0.16,
      saturation: -0.09,
      temperature: -0.02,
      tint: 0.01,
      splitShadow: [0.54, 0.5, 0.46],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.02,
      fade: 0.22,
    }),
    intensity: 100,
    thumbnailColor: "#0D0D0D",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "film-kodakgold200",
    name: "Kodak Gold 200",
    category: "film",
    previewCss: "sepia(.04) saturate(1.1) brightness(1.02)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.02,
      highlights: 0.03,
      contrast: 0.01,
      saturation: 0.06,
      temperature: 0.04,
      tint: -0.01,
      splitHighlight: [0.51, 0.5, 0.48],
      splitStrength: 0.1,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#EF6C00",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "film-fujipro400h",
    name: "Fujifilm Pro 400H",
    category: "film",
    previewCss: "sepia(.03) saturate(1.08) brightness(1.04)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.02,
      highlights: 0.03,
      contrast: 0.01,
      saturation: 0.06,
      temperature: 0.05,
      tint: -0.01,
      splitHighlight: [0.52, 0.5, 0.47],
      splitStrength: 0.1,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#D7CCC8",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "film-cinestill800t",
    name: "Cinestill 800T",
    category: "film",
    previewCss: "contrast(1.1) brightness(.95) saturate(1.05)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.06,
      contrast: 0.1,
      saturation: 0.08,
      temperature: 0.12,
      tint: 0.02,
      splitHighlight: [0.54, 0.5, 0.44],
      splitStrength: 0.18,
      fade: 0.07,
    }),
    intensity: 100,
    thumbnailColor: "#D32F2F",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-duotone",
    name: "Duo-Tone",
    category: "creative",
    previewCss: "contrast(1.1) brightness(1.02)",
    grade: recipe({
      contrast: 0.1,
      midtones: 0.02,
      splitShadow: [0.3, 0.3, 0.8],
      splitHighlight: [0.8, 0.3, 0.3],
      splitStrength: 0.6,
    }),
    intensity: 100,
    thumbnailColor: "#8E24AA",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-pastel",
    name: "Pastel",
    category: "creative",
    previewCss: "brightness(1.08) contrast(.95) saturate(1.1)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.06,
      highlights: 0.08,
      contrast: -0.04,
      saturation: 0.1,
      temperature: 0.05,
      tint: -0.02,
      splitHighlight: [0.54, 0.5, 0.44],
      splitStrength: 0.18,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#F48FB1",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-cyberpunk",
    name: "Cyberpunk",
    category: "creative",
    previewCss: "contrast(1.2) saturate(1.3) brightness(0.98)",
    grade: recipe({
      shadows: -0.02,
      midtones: 0.04,
      highlights: 0.08,
      contrast: 0.15,
      saturation: 0.2,
      temperature: 0.1,
      tint: 0.05,
      splitHighlight: [0.58, 0.4, 0.3],
      splitStrength: 0.4,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#FF00FF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-vaporwave",
    name: "Vaporwave",
    category: "creative",
    previewCss: "brightness(1.05) contrast(1.02) saturate(1.15) hue-rotate(-30deg)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.06,
      contrast: 0.02,
      saturation: 0.12,
      temperature: -0.05,
      tint: 0.03,
      splitHighlight: [0.45, 0.5, 0.55],
      splitStrength: 0.2,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#FF6BFF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-retro",
    name: "Retro",
    category: "creative",
    previewCss: "contrast(1.1) brightness(0.98) saturate(1.05)",
    grade: recipe({
      contrast: 0.1,
      midtones: -0.02,
      saturation: 0.03,
      splitHighlight: [0.55, 0.5, 0.43],
      splitStrength: 0.2,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#F57C00",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-colorwash",
    name: "Color Wash",
    category: "creative",
    previewCss: "brightness(1.02) contrast(.98)",
    grade: recipe({
      midtones: 0.02,
      contrast: -0.02,
      splitShadow: [0.4, 0.5, 0.6],
      splitHighlight: [0.6, 0.5, 0.4],
      splitStrength: 0.3,
    }),
    intensity: 100,
    thumbnailColor: "#4FC3F7",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-lightleaks",
    name: "Light Leaks",
    category: "creative",
    previewCss: "brightness(1.1) saturate(1.05) contrast(0.98)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.06,
      highlights: 0.08,
      contrast: -0.02,
      saturation: 0.08,
      temperature: 0.05,
      tint: 0.02,
      splitHighlight: [0.53, 0.5, 0.46],
      splitStrength: 0.15,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#FFF176",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-filmgrain",
    name: "Film Grain",
    category: "creative",
    previewCss: "contrast(1.05) brightness(0.98)",
    grade: recipe({
      contrast: 0.05,
      midtones: -0.02,
    }),
    intensity: 100,
    thumbnailColor: "#E0E0E0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "creative-lensflare",
    name: "Lens Flare",
    category: "creative",
    previewCss: "brightness(1.15) contrast(1.05)",
    grade: recipe({
      midtones: 0.1,
      contrast: 0.03,
    }),
    intensity: 100,
    thumbnailColor: "#FFEB3B",
    isBuiltIn: true,
    premium: false,
  },

  {
<<<<<<< HEAD
=======
    id: "creative-vignette",
    name: "Vignette",
    category: "creative",
    // `vignette()` isn't a real CSS filter function, so this used to render as
    // a no-op — a darkened, slightly desaturated mood tone is the closest a
    // single color matrix / grade recipe can get to a vignette's look. The
    // actual radial edge-darkening lives in PhotoAdjustPanel's vignette
    // slider (src/lib/vignette.ts), applied on top of whatever filter is active.
    previewCss: "brightness(0.88) contrast(1.12) saturate(0.92)",
    grade: recipe({
      shadows: -0.06,
      contrast: 0.08,
      saturation: -0.06,
    }),
    intensity: 100,
    thumbnailColor: "#000000",
    isBuiltIn: true,
    premium: false,
  },

  {
>>>>>>> 425644e (create-vingette is pickable (will make it darker), intensity scale fixed)
    id: "creative-glow",
    name: "Glow",
    category: "creative",
    previewCss: "brightness(1.08) contrast(0.95) saturate(1.05)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.05,
      highlights: 0.07,
      contrast: -0.04,
      saturation: 0.06,
      temperature: 0.02,
      tint: -0.01,
      splitHighlight: [0.52, 0.5, 0.46],
      splitStrength: 0.12,
      fade: 0.04,
    }),
    intensity: 100,
    thumbnailColor: "#FFF9C4",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "lifestyle-festival-lights",
    name: "Festival Lights",
    category: "lifestyle",
    previewCss: "saturate(1.4) brightness(1.06) contrast(1.04)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.06,
      highlights: 0.08,
      contrast: 0.05,
      saturation: 0.22,
      temperature: 0.07,
      tint: -0.02,
      splitHighlight: [0.57, 0.5, 0.41],
      splitStrength: 0.28,
      fade: 0.09,
    }),
    intensity: 100,
    thumbnailColor: "#FFD700",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "lifestyle-beach-sunset",
    name: "Beach Sunset",
    category: "lifestyle",
    previewCss: "brightness(1.1) saturate(1.15) hue-rotate(-10deg)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.06,
      highlights: 0.08,
      contrast: 0.02,
      saturation: 0.18,
      temperature: 0.12,
      tint: -0.05,
      splitHighlight: [0.56, 0.5, 0.42],
      splitStrength: 0.22,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#FF6F61",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "lifestyle-city-nights",
    name: "City Nights",
    category: "lifestyle",
    previewCss: "brightness(1.05) contrast(1.1) saturate(1.05)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.05,
      contrast: 0.08,
      saturation: 0.1,
      temperature: 0.05,
      tint: 0.01,
      splitHighlight: [0.51, 0.5, 0.48],
      splitStrength: 0.12,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#263238",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "lifestyle-cozy-cabin",
    name: "Cozy Cabin",
    category: "lifestyle",
    previewCss: "brightness(1.01) saturate(1.03) sepia(.12)",
    grade: recipe({
      shadows: 0.0,
      midtones: 0.02,
      highlights: 0.04,
      contrast: -0.02,
      saturation: 0.06,
      temperature: 0.07,
      tint: 0.02,
      splitHighlight: [0.5, 0.5, 0.49],
      splitStrength: 0.1,
      fade: 0.04,
    }),
    intensity: 100,
    thumbnailColor: "#8D6E63",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "mood-goldenhour",
    name: "Golden Hour",
    category: "mood",
    previewCss: "brightness(1.08) contrast(1.02) saturate(1.12)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.06,
      highlights: 0.08,
      contrast: 0.06,
      saturation: 0.15,
      temperature: 0.12,
      tint: -0.04,
      splitHighlight: [0.56, 0.5, 0.42],
      splitStrength: 0.22,
      fade: 0.07,
    }),
    intensity: 100,
    thumbnailColor: "#FFB74D",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "mood-sunset",
    name: "Sunset",
    category: "mood",
    previewCss: "brightness(1.05) contrast(1.08) saturate(1.15) hue-rotate(-15deg)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.05,
      highlights: 0.07,
      contrast: 0.1,
      saturation: 0.18,
      temperature: 0.15,
      tint: -0.08,
      splitHighlight: [0.58, 0.5, 0.4],
      splitStrength: 0.25,
      fade: 0.09,
    }),
    intensity: 100,
    thumbnailColor: "#FF8A65",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "mood-foggy",
    name: "Foggy",
    category: "mood",
    previewCss: "brightness(0.95) contrast(0.90) saturate(0.95)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.02,
      highlights: 0.03,
      contrast: -0.05,
      saturation: -0.03,
      temperature: -0.05,
      tint: 0.02,
      splitShadow: [0.48, 0.5, 0.52],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.04,
      fade: 0.03,
    }),
    intensity: 100,
    thumbnailColor: "#FFFFFF",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "night-starrysky",
    name: "Starry Skies",
    category: "night",
    previewCss: "brightness(1.2) contrast(1.25) saturate(0.9)",
    grade: recipe({
      shadows: 0.18,
      midtones: 0.08,
      highlights: -0.02,
      contrast: 0.25,
      saturation: -0.05,
      temperature: -0.1,
      tint: 0.0,
      splitShadow: [0.35, 0.4, 0.5],
      splitHighlight: [0.55, 0.45, 0.35],
      splitStrength: 0.3,
      fade: 0.12,
    }),
    intensity: 100,
    thumbnailColor: "#0B0D2B",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "night-citylights",
    name: "City Lights",
    category: "night",
    previewCss: "brightness(1.1) contrast(1.2) saturate(1.05)",
    grade: recipe({
      shadows: 0.12,
      midtones: 0.06,
      highlights: 0.02,
      contrast: 0.18,
      saturation: 0.12,
      temperature: 0.05,
      tint: 0.0,
      splitShadow: [0.42, 0.48, 0.55],
      splitHighlight: [0.55, 0.5, 0.42],
      splitStrength: 0.22,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#1565C0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "night-lighttrails",
    name: "Light Trails",
    category: "night",
    previewCss: "brightness(1.05) contrast(1.3) saturate(1.1)",
    grade: recipe({
      shadows: 0.05,
      midtones: 0.02,
      highlights: 0.06,
      contrast: 0.25,
      saturation: 0.15,
      temperature: 0.03,
      tint: 0.0,
      splitShadow: [0.4, 0.45, 0.5],
      splitHighlight: [0.55, 0.5, 0.4],
      splitStrength: 0.35,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#212121",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "food-sweettreats",
    name: "Sweet Treats",
    category: "food",
    previewCss: "saturate(1.25) brightness(1.08) contrast(1.02)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.05,
      highlights: 0.07,
      contrast: 0.05,
      saturation: 0.2,
      temperature: 0.08,
      tint: -0.01,
      splitHighlight: [0.56, 0.5, 0.42],
      splitStrength: 0.28,
      fade: 0.09,
    }),
    intensity: 100,
    thumbnailColor: "#F48FB1",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "food-gourmet",
    name: "Gourmet",
    category: "food",
    previewCss: "contrast(1.12) brightness(1.01) saturate(1.08)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.04,
      highlights: 0.05,
      contrast: 0.1,
      saturation: 0.15,
      temperature: 0.05,
      tint: -0.01,
      splitHighlight: [0.53, 0.5, 0.45],
      splitStrength: 0.18,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#6D4C41",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "food-streetfood",
    name: "Street Food",
    category: "food",
    previewCss: "saturate(1.35) brightness(1.03) contrast(1.05)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.06,
      highlights: 0.08,
      contrast: 0.06,
      saturation: 0.22,
      temperature: 0.07,
      tint: -0.02,
      splitHighlight: [0.57, 0.5, 0.41],
      splitStrength: 0.3,
      fade: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#EF5350",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pet-fluffy",
    name: "Fluffy Friends",
    category: "pet",
    previewCss: "brightness(1.06) contrast(0.98) saturate(1.12)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.05,
      highlights: 0.07,
      contrast: -0.03,
      saturation: 0.12,
      temperature: 0.05,
      tint: -0.02,
      splitHighlight: [0.52, 0.5, 0.46],
      splitStrength: 0.15,
      fade: 0.05,
    }),
    intensity: 100,
    thumbnailColor: "#F8BBD0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pet-actionshot",
    name: "Action Shot",
    category: "pet",
    previewCss: "contrast(1.2) brightness(1.04) saturate(1.0)",
    grade: recipe({
      shadows: -0.03,
      midtones: 0.0,
      highlights: 0.04,
      contrast: 0.18,
      saturation: -0.03,
      temperature: -0.02,
      tint: 0.01,
      splitHighlight: [0.48, 0.5, 0.52],
      splitStrength: 0.2,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#9E9E9E",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "pet-treattime",
    name: "Treat Time",
    category: "pet",
    previewCss: "brightness(1.1) saturate(1.2) contrast(0.95)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.06,
      highlights: 0.08,
      contrast: -0.05,
      saturation: 0.18,
      temperature: 0.07,
      tint: -0.03,
      splitHighlight: [0.56, 0.5, 0.42],
      splitStrength: 0.22,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#FF8A80",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portrait-studio",
    name: "Studio",
    category: "portrait",
    previewCss: "contrast(1.2) brightness(1.01) saturate(0.99)",
    grade: recipe({
      shadows: -0.05,
      midtones: 0.0,
      highlights: 0.04,
      contrast: 0.18,
      saturation: -0.05,
      temperature: 0.01,
      tint: 0.0,
      splitShadow: [0.42, 0.48, 0.55],
      splitHighlight: [0.58, 0.5, 0.4],
      splitStrength: 0.35,
      fade: 0.08,
    }),
    intensity: 100,
    thumbnailColor: "#E0E0E0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portrait-naturallight",
    name: "Natural Light",
    category: "portrait",
    previewCss: "brightness(1.05) contrast(1.02) saturate(1.03)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.03,
      highlights: 0.05,
      contrast: 0.02,
      saturation: 0.03,
      temperature: 0.04,
      tint: -0.01,
      splitHighlight: [0.51, 0.5, 0.48],
      splitStrength: 0.08,
      fade: 0.03,
    }),
    intensity: 100,
    thumbnailColor: "#FFF8E1",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "portrait-flattering",
    name: "Flattering",
    category: "portrait",
    previewCss: "brightness(1.03) contrast(0.98) saturate(1.01)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.06,
      contrast: -0.03,
      saturation: 0.01,
      temperature: 0.05,
      tint: 0.0,
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.12,
      fade: 0.04,
    }),
    intensity: 100,
    thumbnailColor: "#FCE4EC",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vintage-1960s",
    name: "1960s",
    category: "vintage",
    previewCss: "sepia(.3) contrast(.85) brightness(1.04)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.03,
      highlights: 0.04,
      contrast: -0.1,
      saturation: -0.12,
      temperature: 0.14,
      tint: 0.04,
      splitShadow: [0.54, 0.5, 0.44],
      splitHighlight: [0.56, 0.5, 0.44],
      splitStrength: 0.22,
      fade: 0.12,
    }),
    intensity: 100,
    thumbnailColor: "#8D6E63",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vintage-1990s",
    name: "1990s",
    category: "vintage",
    previewCss: "brightness(1.02) contrast(.98) saturate(1.05)",
    grade: recipe({
      shadows: 0.01,
      midtones: 0.03,
      highlights: 0.04,
      contrast: -0.02,
      saturation: 0.06,
      temperature: 0.04,
      tint: -0.01,
      splitHighlight: [0.51, 0.5, 0.48],
      splitStrength: 0.1,
      fade: 0.05,
    }),
    intensity: 100,
    thumbnailColor: "#F5F5F5",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vintage-polaroid",
    name: "Polaroid",
    category: "vintage",
    previewCss: "brightness(1.05) contrast(.95) saturate(1.1)",
    grade: recipe({
      shadows: 0.03,
      midtones: 0.05,
      highlights: 0.06,
      contrast: -0.03,
      saturation: 0.12,
      temperature: 0.05,
      tint: -0.02,
      splitHighlight: [0.52, 0.5, 0.46],
      splitStrength: 0.15,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#F48FB1",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vintage-instamatic",
    name: "Instant Film",
    category: "vintage",
    previewCss: "contrast(.92) brightness(1.06) saturate(1.08)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.04,
      highlights: 0.05,
      contrast: -0.06,
      saturation: 0.1,
      temperature: 0.05,
      tint: -0.02,
      splitHighlight: [0.51, 0.5, 0.48],
      splitStrength: 0.12,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#FFF3E0",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "vintage-disposable",
    name: "Disposable Camera",
    category: "vintage",
    previewCss: "brightness(1.08) contrast(.92) saturate(1.15)",
    grade: recipe({
      shadows: 0.04,
      midtones: 0.06,
      highlights: 0.08,
      contrast: -0.08,
      saturation: 0.12,
      temperature: 0.06,
      tint: -0.03,
      splitHighlight: [0.54, 0.5, 0.44],
      splitStrength: 0.18,
      fade: 0.09,
    }),
    intensity: 100,
    thumbnailColor: "#FFCCBC",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bw-sepia-tone",
    name: "Sepia Tone",
    category: "bw",
    previewCss: "grayscale(1) sepia(.3)",
    grade: recipe({
      contrast: 0.0,
      saturation: -0.7,
      splitShadow: [0.5, 0.45, 0.4],
      splitHighlight: [0.6, 0.55, 0.5],
      splitStrength: 0.25,
    }),
    intensity: 100,
    thumbnailColor: "#8D6E63",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bw-selenium-tone",
    name: "Selenium Tone",
    category: "bw",
    previewCss: "grayscale(1) contrast(.95)",
    grade: recipe({
      contrast: -0.05,
      saturation: -1,
      splitShadow: [0.45, 0.5, 0.55],
      splitHighlight: [0.55, 0.5, 0.45],
      splitStrength: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#B0BEC5",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bw-cool-tone",
    name: "Cool Tone",
    category: "bw",
    previewCss: "grayscale(1) contrast(1.05)",
    grade: recipe({
      contrast: 0.05,
      saturation: -1,
      splitShadow: [0.4, 0.45, 0.5],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.05,
    }),
    intensity: 100,
    thumbnailColor: "#BBDEFB",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bw-warm-tone",
    name: "Warm Tone",
    category: "bw",
    previewCss: "grayscale(1) contrast(.95)",
    grade: recipe({
      contrast: -0.05,
      saturation: -1,
      splitShadow: [0.5, 0.5, 0.5],
      splitHighlight: [0.5, 0.5, 0.5],
      splitStrength: 0.1,
    }),
    intensity: 100,
    thumbnailColor: "#FFCCBC",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "bw-red-tone",
    name: "Red Tone",
    category: "bw",
    previewCss: "grayscale(1) contrast(1.1)",
    grade: recipe({
      contrast: 0.1,
      saturation: -1,
      splitShadow: [0.55, 0.5, 0.45],
      splitHighlight: [0.55, 0.5, 0.45],
      splitStrength: 0.3,
    }),
    intensity: 100,
    thumbnailColor: "#FFCDD2",
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "style-cinematic",
    name: "Cinematic",
    category: "style",
    previewCss: "contrast(1.15) saturate(1.1) brightness(.98)",
    grade: recipe({
      shadows: 0.02,
      midtones: 0.0,
      highlights: 0.04,
      contrast: 0.12,
      saturation: 0.08,
      temperature: 0.02,
      tint: -0.01,
      splitShadow: [0.45, 0.5, 0.55],
      splitHighlight: [0.55, 0.5, 0.42],
      splitStrength: 0.25,
      fade: 0.06,
    }),
    intensity: 100,
    thumbnailColor: "#2E294E",
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Favorites (will be populated dynamically)
  // ------------------------------------------------------------------
];

export const FILTER_CATEGORIES: FilterCategory[] = [
  "favorites",
  "style",
  "portrait",
  "mood",
  "night",
  "food",
  "pet",
  "pro",
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
