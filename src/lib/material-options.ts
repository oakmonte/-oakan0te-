// Shared between OptionEditorSheet's Material preset chips (variant
// products) and MaterialSheet (a regular product's single material field) —
// one list, not two that can drift apart.
export const MATERIAL_PRESETS: string[] = [
  "Cotton",
  "Polyester",
  "Leather",
  "Suede",
  "Silk",
  "Wool",
  "Linen",
  "Denim",
  "Canvas",
  // Art & Crafts materials — same free-text-or-preset list as apparel above,
  // not a separate category-scoped list, since neither caller has category
  // context to switch on.
  "Wood",
  "Ceramic",
  "Iron",
  "Marble",
  "Bronze",
  "Glass",
  "Stone",
  "Resin",
  "Clay",
  "Paper",
];
