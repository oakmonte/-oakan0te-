export type LayoutId = "hero-led" | "shop-first" | "social-proof" | "editorial";
export type ArrangeableBlockId = "stats" | "collections" | "promo" | "footer";

// Pure reorderings of the same four content blocks — grounded in real storefront
// homepage patterns, not invented layouts. Header/hero always lead; a shopper
// should always land on who the store is before what it sells.
export const LAYOUT_PRESETS: {
  id: LayoutId;
  name: string;
  hint: string;
  order: ArrangeableBlockId[];
}[] = [
  {
    id: "hero-led",
    name: "Hero-led",
    hint: "Story first, then shop",
    order: ["stats", "collections", "promo", "footer"],
  },
  {
    id: "shop-first",
    name: "Shop-first",
    hint: "Catalog right after the hero",
    order: ["collections", "stats", "promo", "footer"],
  },
  {
    id: "social-proof",
    name: "Social proof",
    hint: "Trust and urgency before the grid",
    order: ["stats", "promo", "collections", "footer"],
  },
  {
    id: "editorial",
    name: "Editorial",
    hint: "Campaign banner leads the catalog",
    order: ["promo", "collections", "stats", "footer"],
  },
];
