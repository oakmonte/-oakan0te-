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

/** The blocks a layout puts BELOW the collections/products grid, which are
 *  the ones "stick to page" pins to the bottom of the screen. Shop-first puts
 *  three there and Social proof only one. Hidden blocks don't count, and
 *  neither does the drop banner when there's no drop to show, so an empty
 *  result means the option has nothing to act on and shouldn't be offered. */
export function blocksBelowGrid(
  layoutId: LayoutId,
  hidden: readonly string[],
  hasDrop: boolean,
): ArrangeableBlockId[] {
  const order = LAYOUT_PRESETS.find((p) => p.id === layoutId)?.order ?? LAYOUT_PRESETS[0].order;
  return order
    .slice(order.indexOf("collections") + 1)
    .filter((id) => !hidden.includes(id) && (id !== "promo" || hasDrop));
}
