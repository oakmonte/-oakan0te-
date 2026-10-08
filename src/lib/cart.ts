import { useSyncExternalStore } from "react";
import { MAX_LINE_QTY } from "@/lib/order-lines";

/** The bag. Local to the device rather than a table: guests can shop and check
 *  out, and a guest has no row to hang a server-side cart on. Nothing here is
 *  trusted for money -- the server re-reads every price when an order is
 *  placed (see order-lines.ts) -- so a stale or edited copy can only ever show
 *  the buyer a wrong number, never charge one.
 *
 *  Module-level rather than context, like save-prefs.ts: the bottom nav badge,
 *  the product page, the feed and the bag page all read it and none of them
 *  own it. The reducer is pure and exported so the rules are unit-tested. */

export type CartItem = {
  productId: string;
  variantId: string;
  quantity: number;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  /** Naira, as last seen. Display only; never sent to the server. */
  unitPrice: number | null;
  storeId: string;
  storeName: string;
  /** The most this variant can be bought up to, when stock is tracked. */
  maxQuantity: number | null;
  /** Added without anyone picking an option: the feed's +Cart adds a whole
   *  post's pieces in one tap. Checkout waits until one is chosen. */
  needsChoice?: boolean;
  addedAt: number;
};

export type CartLineInput = Omit<CartItem, "quantity" | "addedAt">;

/** A variant as the database has it now, for reconciling the bag. */
export type FreshVariant = {
  id: string;
  label: string | null;
  unitPrice: number | null;
  imageUrl: string | null;
  /** See stockCeiling in order-lines.ts: null means no ceiling. */
  stock: number | null;
};

export type FreshProduct = {
  id: string;
  title: string;
  storeId: string;
  storeName: string;
  /** "Size", "Colour"... for the picker; null when the seller named none. */
  optionName: string | null;
  variants: FreshVariant[];
};

export type CartNotice =
  | { kind: "price"; variantId: string; title: string; from: number; to: number }
  | { kind: "reduced"; variantId: string; title: string; to: number }
  | { kind: "soldout"; variantId: string; title: string }
  | { kind: "gone"; variantId: string; title: string };

export type LineStatus = "ok" | "checking" | "gone" | "soldout" | "needsChoice";

/** How many of a line the bag will hold: the stock ceiling when known, never
 *  more than one order line can carry. */
export function capFor(maxQuantity: number | null | undefined): number {
  return Math.max(0, Math.min(MAX_LINE_QTY, maxQuantity ?? MAX_LINE_QTY));
}

/** Adds `quantity` of a variant, merging into its existing line. Returns how
 *  many units actually went in: fewer than asked when the line hit its cap, 0
 *  when it was already full or the variant is sold out. */
export function addLine(
  items: CartItem[],
  input: CartLineInput,
  quantity: number,
  now: number,
): { items: CartItem[]; added: number } {
  const existing = items.find((i) => i.variantId === input.variantId);
  const cap = capFor(input.maxQuantity);
  const have = existing?.quantity ?? 0;
  const next = Math.min(cap, have + Math.max(0, Math.floor(quantity)));
  if (next <= have) return { items, added: 0 };
  if (existing) {
    const merged: CartItem = {
      ...existing,
      ...input,
      quantity: next,
      // A size someone picked stays picked; adding it again from the feed
      // doesn't make it a guess.
      needsChoice: existing.needsChoice && input.needsChoice ? true : undefined,
      addedAt: existing.addedAt,
    };
    return { items: items.map((i) => (i === existing ? merged : i)), added: next - have };
  }
  const line: CartItem = {
    ...input,
    needsChoice: input.needsChoice || undefined,
    quantity: next,
    addedAt: now,
  };
  // Newest first, so what you just added is at the top of its store's group.
  return { items: [line, ...items], added: next };
}

export function setLineQuantity(items: CartItem[], variantId: string, quantity: number) {
  const line = items.find((i) => i.variantId === variantId);
  if (!line) return items;
  if (quantity < 1) return items.filter((i) => i !== line);
  const next = Math.min(capFor(line.maxQuantity), Math.floor(quantity));
  if (next < 1 || next === line.quantity) return items;
  return items.map((i) => (i === line ? { ...i, quantity: next } : i));
}

export function removeLines(items: CartItem[], variantIds: string[]) {
  const drop = new Set(variantIds);
  const next = items.filter((i) => !drop.has(i.variantId));
  return next.length === items.length ? items : next;
}

/** Switches a line to another variant of the same product (the size picker in
 *  the bag). Merges into a line that already holds that variant. */
export function chooseLineVariant(
  items: CartItem[],
  fromVariantId: string,
  to: Pick<CartItem, "variantId" | "variantLabel" | "unitPrice" | "imageUrl" | "maxQuantity">,
): CartItem[] {
  const line = items.find((i) => i.variantId === fromVariantId);
  if (!line) return items;
  const cap = capFor(to.maxQuantity);
  if (cap < 1) return items;
  const target = items.find((i) => i.variantId === to.variantId && i !== line);
  if (target) {
    const merged: CartItem = {
      ...target,
      ...to,
      quantity: Math.min(cap, target.quantity + line.quantity),
      needsChoice: undefined,
    };
    return items.filter((i) => i !== line).map((i) => (i === target ? merged : i));
  }
  const switched: CartItem = {
    ...line,
    ...to,
    quantity: Math.min(cap, line.quantity),
    needsChoice: undefined,
  };
  return items.map((i) => (i === line ? switched : i));
}

/** Brings the bag in line with what the database says now, and lists what
 *  changed so the bag can tell the buyer instead of silently moving numbers.
 *
 *  Only lines whose product was in `queried` are judged: something added
 *  while the lookup was in flight wasn't asked about, and must not be read as
 *  "gone" just because it's missing from the answer. */
export function reconcileLines(
  items: CartItem[],
  fresh: Map<string, FreshProduct>,
  queried: Set<string>,
): { items: CartItem[]; notices: CartNotice[] } {
  const notices: CartNotice[] = [];
  let changed = false;
  const next = items.map((item) => {
    if (!queried.has(item.productId)) return item;
    const product = fresh.get(item.productId);
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (!product || !variant || variant.unitPrice == null) {
      notices.push({
        kind: "gone",
        variantId: item.variantId,
        title: product?.title ?? item.title,
      });
      return item;
    }
    let quantity = item.quantity;
    if (variant.stock === 0) {
      notices.push({ kind: "soldout", variantId: item.variantId, title: product.title });
    } else if (variant.stock !== null && quantity > variant.stock) {
      quantity = variant.stock;
      notices.push({
        kind: "reduced",
        variantId: item.variantId,
        title: product.title,
        to: quantity,
      });
    }
    if (item.unitPrice != null && item.unitPrice !== variant.unitPrice) {
      notices.push({
        kind: "price",
        variantId: item.variantId,
        title: product.title,
        from: item.unitPrice,
        to: variant.unitPrice,
      });
    }
    const updated: CartItem = {
      ...item,
      quantity: Math.min(quantity, MAX_LINE_QTY),
      title: product.title,
      variantLabel: variant.label,
      imageUrl: variant.imageUrl ?? item.imageUrl,
      unitPrice: variant.unitPrice,
      storeId: product.storeId,
      storeName: product.storeName,
      maxQuantity: variant.stock,
    };
    const same =
      updated.quantity === item.quantity &&
      updated.title === item.title &&
      updated.variantLabel === item.variantLabel &&
      updated.imageUrl === item.imageUrl &&
      updated.unitPrice === item.unitPrice &&
      updated.storeId === item.storeId &&
      updated.storeName === item.storeName &&
      updated.maxQuantity === item.maxQuantity;
    if (same) return item;
    changed = true;
    return updated;
  });
  return { items: changed ? next : items, notices };
}

/** Whether a line can go to checkout right now. "checking" until the lookup
 *  that covers it has answered. */
export function lineStatus(
  item: CartItem,
  fresh: Map<string, FreshProduct> | null,
  queried: Set<string>,
): LineStatus {
  if (!fresh || !queried.has(item.productId)) return "checking";
  const variant = fresh.get(item.productId)?.variants.find((v) => v.id === item.variantId);
  if (!variant || variant.unitPrice == null) return "gone";
  if (variant.stock === 0) return "soldout";
  if (item.needsChoice) return "needsChoice";
  return "ok";
}

export type StoreGroup = { storeId: string; storeName: string; items: CartItem[] };

/** Lines grouped by store, groups in the order their newest line was added. */
export function groupByStore(items: CartItem[]): StoreGroup[] {
  const groups = new Map<string, StoreGroup>();
  for (const item of items) {
    const g = groups.get(item.storeId);
    if (g) g.items.push(item);
    else
      groups.set(item.storeId, { storeId: item.storeId, storeName: item.storeName, items: [item] });
  }
  return [...groups.values()];
}

export function lineCount(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

/** Naira, for display. Null when any line has no known price. */
export function subtotalOf(items: CartItem[]): number | null {
  let sum = 0;
  for (const i of items) {
    if (i.unitPrice == null) return null;
    sum += Math.round(i.unitPrice * 100) * i.quantity;
  }
  return sum / 100;
}

const MAX_STORED_LINES = 100;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Reads a stored bag defensively: it lives on the device, so it can be from
 *  an older build, half-written, or edited by hand. Bad lines are dropped
 *  rather than failing the whole bag. */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) return [];
  let items: CartItem[] = [];
  for (const row of list.slice(0, MAX_STORED_LINES)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const productId = str(r.productId);
    const variantId = str(r.variantId);
    const storeId = str(r.storeId);
    const quantity = typeof r.quantity === "number" ? Math.floor(r.quantity) : 0;
    if (!productId || !variantId || !storeId || quantity < 1) continue;
    const maxQuantity =
      typeof r.maxQuantity === "number" && r.maxQuantity >= 0 ? Math.floor(r.maxQuantity) : null;
    const { items: merged } = addLine(
      items,
      {
        productId,
        variantId,
        storeId,
        storeName: str(r.storeName) || "Store",
        title: str(r.title) || "Item",
        variantLabel: str(r.variantLabel) || null,
        imageUrl: str(r.imageUrl) || null,
        unitPrice: typeof r.unitPrice === "number" && r.unitPrice >= 0 ? r.unitPrice : null,
        // A stored sold-out ceiling would make the line unloadable; the bag
        // re-checks stock on open anyway.
        maxQuantity: maxQuantity === 0 ? null : maxQuantity,
        needsChoice: r.needsChoice === true || undefined,
      },
      quantity,
      typeof r.addedAt === "number" ? r.addedAt : 0,
    );
    items = merged;
  }
  // addLine puts each new line first; restore the stored order.
  return items.reverse();
}

// ---------------------------------------------------------------------------
// The store. Read lazily: this module is imported during SSR, where
// localStorage doesn't exist, and every access is wrapped because private
// modes and full disks throw on it.

const KEY = "oak_cart_v1";
const EMPTY: CartItem[] = [];
let items: CartItem[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): CartItem[] {
  try {
    return parseCart(window.localStorage.getItem(KEY));
  } catch {
    return EMPTY;
  }
}

export function getCartItems(): CartItem[] {
  if (!hydrated && typeof window !== "undefined") {
    items = read();
    hydrated = true;
  }
  return items;
}

/** Stable across calls so useSyncExternalStore doesn't loop on the server. */
function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function emit() {
  for (const l of listeners) l();
}

function commit(next: CartItem[]) {
  if (next === getCartItems()) return;
  items = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: 1, items: next }));
  } catch {
    // Private mode or a full disk: the bag still works for this visit.
  }
  emit();
}

// Another tab changed the bag: pick it up so a badge in this one isn't stale.
function onStorage(e: StorageEvent) {
  if (e.key !== KEY) return;
  items = read();
  hydrated = true;
  emit();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribe, getCartItems, getServerSnapshot);
}

/** Units in the bag, for the nav badge. 0 on the server and during hydration. */
export function useCartCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => lineCount(getCartItems()),
    () => 0,
  );
}

const noopSubscribe = () => () => {};
/** False on the server and during hydration, when the bag reads as empty
 *  whatever is stored; true once the real contents are on screen. */
export function useCartReady(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function addToCart(input: CartLineInput, quantity = 1): number {
  const { items: next, added } = addLine(getCartItems(), input, quantity, Date.now());
  commit(next);
  return added;
}

export function setCartQuantity(variantId: string, quantity: number) {
  commit(setLineQuantity(getCartItems(), variantId, quantity));
}

export function removeFromCart(variantIds: string[]) {
  commit(removeLines(getCartItems(), variantIds));
}

export function chooseCartVariant(
  fromVariantId: string,
  to: Pick<CartItem, "variantId" | "variantLabel" | "unitPrice" | "imageUrl" | "maxQuantity">,
) {
  commit(chooseLineVariant(getCartItems(), fromVariantId, to));
}

export function reconcileCart(
  fresh: Map<string, FreshProduct>,
  queried: Set<string>,
): CartNotice[] {
  const { items: next, notices } = reconcileLines(getCartItems(), fresh, queried);
  commit(next);
  return notices;
}
