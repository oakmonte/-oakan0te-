export type LayoutCategory = "featured" | "fashion" | "classic" | "magazine" | "saved";

/**
 * The subset of LayoutCategory that a layout's own `category` field can
 * hold. "featured" and "saved" are pill/tab values only — never stored on
 * a layout. "featured" comes from the `featured` flag below; "saved" will
 * be filtered externally via a savedIds Set, same pattern as favoriteIds
 * in FilterPanel.
 */
export type LayoutGroup = Exclude<LayoutCategory, "featured" | "saved">;

/** A single capture cell, in fractional units (0–1) of the frame. */
export interface LayoutCell {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraLayout {
  id: string;

  /** Display name shown to the user */
  name: string;

  /** Intrinsic category — see LayoutGroup */
  category: LayoutGroup;

  /** Rectangles a LayoutPreview/LayoutCard render from, in fractional units */
  cells: LayoutCell[];

  /** Surfaces this layout under the "Featured" pill, independent of category */
  featured: boolean;

  /** Built-in layouts cannot be deleted */
  isBuiltIn: boolean;

  /** Future marketplace support */
  premium: boolean;

  /** Future creator packs */
  creator?: string;
}

// Helper for evenly-spaced N×M grids — used at module init only, not exported.
function evenGrid(cols: number, rows: number): LayoutCell[] {
  const cells: LayoutCell[] = [];
  const w = 1 / cols;
  const h = 1 / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ x: col * w, y: row * h, w, h });
    }
  }
  return cells;
}

export const CAMERA_LAYOUTS: CameraLayout[] = [
  // ------------------------------------------------------------------
  // Classic
  // ------------------------------------------------------------------

  {
    id: "2-vertical",
    name: "2 Vertical",
    category: "classic",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "2-horizontal",
    name: "2 Horizontal",
    category: "classic",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "3-grid",
    name: "3 Grid",
    category: "classic",
    cells: evenGrid(3, 1),
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "grid-2x2",
    name: "2×2 Grid",
    category: "classic",
    cells: evenGrid(2, 2),
    featured: true,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "grid-3x3",
    name: "3×3 Grid",
    category: "classic",
    cells: evenGrid(3, 3),
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Fashion
  // ------------------------------------------------------------------

  {
    id: "front-back",
    name: "Front / Back",
    category: "fashion",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "fit-check",
    name: "Fit Check",
    category: "fashion",
    cells: [{ x: 0, y: 0, w: 1, h: 1 }],
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "product-model",
    name: "Product + Model",
    category: "fashion",
    cells: [
      { x: 0, y: 0, w: 0.65, h: 1 },
      { x: 0.65, y: 0, w: 0.35, h: 1 },
    ],
    featured: true,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "before-after",
    name: "Before / After",
    category: "fashion",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "lookbook",
    name: "Lookbook",
    category: "fashion",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.6 },
      { x: 0, y: 0.6, w: 0.5, h: 0.4 },
      { x: 0.5, y: 0.6, w: 0.5, h: 0.4 },
    ],
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  // ------------------------------------------------------------------
  // Magazine
  // ------------------------------------------------------------------

  {
    id: "editorial",
    name: "Editorial",
    category: "magazine",
    cells: [
      { x: 0, y: 0, w: 0.6, h: 1 },
      { x: 0.6, y: 0, w: 0.4, h: 0.5 },
      { x: 0.6, y: 0.5, w: 0.4, h: 0.5 },
    ],
    featured: true,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "story",
    name: "Story",
    category: "magazine",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.82 },
      { x: 0, y: 0.82, w: 1, h: 0.18 },
    ],
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "catalogue",
    name: "Catalogue",
    category: "magazine",
    cells: evenGrid(2, 3),
    featured: false,
    isBuiltIn: true,
    premium: false,
  },

  {
    id: "minimal",
    name: "Minimal",
    category: "magazine",
    cells: [{ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }],
    featured: false,
    isBuiltIn: true,
    premium: false,
  },
];

// Pill order shown in LayoutPanel. Note "featured" and "saved" filter the
// list above dynamically (by `.featured` and by an external savedIds Set,
// respectively) — they are not values found in any layout's `category` field.
export const LAYOUT_CATEGORIES: LayoutCategory[] = [
  "featured",
  "fashion",
  "classic",
  "magazine",
  "saved",
];
