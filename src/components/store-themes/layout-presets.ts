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

/** Above this many items in the grid, stick-to-page turns itself on for a
 *  seller who hasn't chosen. At 12 or fewer the blocks below the grid are
 *  only a short scroll away, and pinning them would just cover the grid. */
export const AUTO_STICK_MIN_ITEMS = 12;

/** Whether the blocks below the grid actually stick. The seller's own choice
 *  (the save prompt or the theme card's toggle) always wins. With no choice
 *  (null), it's on only when the grid holds more than AUTO_STICK_MIN_ITEMS
 *  of whatever it shows: active products, or collections. An unknown count
 *  (still loading) reads as off, so a small store never flashes a pinned
 *  strip while its count is on the way. */
export function resolveStickyBottom(choice: boolean | null, itemCount: number | null): boolean {
  if (choice !== null) return choice;
  return itemCount !== null && itemCount > AUTO_STICK_MIN_ITEMS;
}
