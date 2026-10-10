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

/** Sellers-only (2026-10-10): the follower count ("watching this space") and
 *  the community footer ("wearing it") are social-platform pieces, so they're
 *  switched off for every theme here. Each theme still builds both blocks --
 *  delete an id from this list to bring it back everywhere, nothing else to
 *  undo. LayoutBlocks skips them, and the picker, hidden-sections list and
 *  stick-to-page question all read this so none of them offer a block that
 *  can't appear. */
export const RETIRED_BLOCKS: readonly ArrangeableBlockId[] = ["stats", "footer"];

/** A layout's order with the retired blocks taken out. */
export function liveOrder(layoutId: LayoutId): ArrangeableBlockId[] {
  const order = LAYOUT_PRESETS.find((p) => p.id === layoutId)?.order ?? LAYOUT_PRESETS[0].order;
  return order.filter((id) => !RETIRED_BLOCKS.includes(id));
}

/** The presets still worth offering: with blocks retired, several collapse
 *  into the same order, so one preset per distinct order is listed -- the
 *  LAST of each group, whose name and hint still describe it ("Catalog right
 *  after the hero", "Campaign banner leads the catalog"); the earlier ones
 *  lean on the follower count. A store that saved another renders
 *  identically, and the picker ticks it via sameLiveOrder. */
export function pickableLayouts(): typeof LAYOUT_PRESETS {
  const byOrder = new Map<string, (typeof LAYOUT_PRESETS)[number]>();
  for (const p of LAYOUT_PRESETS) byOrder.set(liveOrder(p.id).join(","), p);
  return [...byOrder.values()];
}

export function sameLiveOrder(a: LayoutId, b: LayoutId): boolean {
  return liveOrder(a).join(",") === liveOrder(b).join(",");
}

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
  const order = liveOrder(layoutId);
  return order
    .slice(order.indexOf("collections") + 1)
    .filter((id) => !hidden.includes(id) && (id !== "promo" || hasDrop));
}

/** Above this many items in the grid, stick-to-page turns itself on for a
 *  seller who hasn't chosen. At 10 or fewer the blocks below the grid are
 *  only a short scroll away, and pinning them would just cover the grid. */
export const AUTO_STICK_MIN_ITEMS = 10;

/** Whether the stick-to-page choice is worth offering at all: only when the
 *  storefront's catalog (collections plus the products outside them) has
 *  more than AUTO_STICK_MIN_ITEMS tiles. A
 *  small store has nothing to stick past, and an unknown (still loading)
 *  count reads as "not yet", so the toggle never flashes in and out. */
export function stickyOptionAvailable(itemCount: number | null): boolean {
  return itemCount !== null && itemCount > AUTO_STICK_MIN_ITEMS;
}

/** Whether the blocks below the grid actually stick. Never at or below the
 *  threshold -- not even if the seller once switched it on: the toggle is
 *  hidden there (stickyOptionAvailable), so a saved "on" from when the store
 *  was bigger would otherwise be stuck with no way to turn it off. Above
 *  it, the seller's own choice (save prompt or theme card toggle) wins, and
 *  no choice (null) means on. An unknown count (still loading) reads as off,
 *  so a small store never flashes a pinned strip. */
export function resolveStickyBottom(choice: boolean | null, itemCount: number | null): boolean {
  if (!stickyOptionAvailable(itemCount)) return false;
  return choice ?? true;
}
