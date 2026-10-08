// The pure half of checkout, shared by the server (pricing an order) and the
// browser (the bag). Nothing in here touches the network or the database, so
// every rule that decides what a buyer is charged for can be unit-tested
// directly. The server reads the rows; this file decides what they mean.

/** Most units of one variant a single order line can carry. A guard against a
 *  typo or a tampered request, not a stock rule: stock is checked separately. */
export const MAX_LINE_QTY = 20;
/** Most distinct lines one order can hold. */
export const MAX_ORDER_LINES = 30;

export type OrderLine = {
  productId: string;
  /** Null only on the original single-product request, which has always
   *  fallen back to the product's first variant when none was named. */
  variantId: string | null;
  quantity: number;
};

export type ParsedLines =
  | { ok: true; lines: OrderLine[]; legacy: boolean }
  | { ok: false; error: string };

const idOf = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 64) : "");

/** Reads what the browser says it wants to buy. Two shapes are accepted:
 *
 *    { productId, variantId? }                         the Buy Now page
 *    { items: [{ productId, variantId, quantity }] }   the bag
 *
 *  Only ids and counts come in; anything money-shaped in the body is ignored.
 *  Repeated variants are merged so one variant is one order line. */
export function parseOrderLines(body: Record<string, unknown>): ParsedLines {
  if (body.items === undefined) {
    const productId = idOf(body.productId);
    if (!productId) return { ok: false, error: "Missing order details." };
    return {
      ok: true,
      legacy: true,
      lines: [{ productId, variantId: idOf(body.variantId) || null, quantity: 1 }],
    };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: "There's nothing to check out." };
  }
  if (body.items.length > MAX_ORDER_LINES) {
    return { ok: false, error: `One order can hold up to ${MAX_ORDER_LINES} different pieces.` };
  }

  const merged = new Map<string, OrderLine>();
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Missing order details." };
    const row = raw as Record<string, unknown>;
    const productId = idOf(row.productId);
    // The bag always knows the exact variant. Unlike the legacy shape there is
    // no fallback: quietly swapping a size for another is worse than failing.
    const variantId = idOf(row.variantId);
    if (!productId || !variantId) return { ok: false, error: "Missing order details." };
    const quantity = row.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, error: "One of the quantities isn't valid." };
    }
    const prev = merged.get(variantId);
    if (prev && prev.productId !== productId) {
      return { ok: false, error: "Missing order details." };
    }
    const total = (prev?.quantity ?? 0) + quantity;
    if (total > MAX_LINE_QTY) {
      return { ok: false, error: `Up to ${MAX_LINE_QTY} of one piece per order.` };
    }
    merged.set(variantId, { productId, variantId, quantity: total });
  }
  return { ok: true, legacy: false, lines: [...merged.values()] };
}

/** "M", "Red / M": the option values that tell one variant from its siblings.
 *  A product with a single variant has nothing to tell apart, so no label. */
export function variantLabelOf(
  v: {
    option1_value: string | null;
    option2_value?: string | null;
    option3_value?: string | null;
  },
  siblingCount: number,
): string | null {
  if (siblingCount <= 1) return null;
  const parts = [v.option1_value, v.option2_value, v.option3_value]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(" / ") : null;
}

/** What a variant can still be sold up to: null when there is no ceiling (the
 *  seller sells past zero). A missing stock count with no oversell counts as
 *  none left, which is how the product page and settlement already read it. */
export function stockCeiling(v: {
  stock_qty: number | null;
  continue_selling_out_of_stock: boolean;
}): number | null {
  if (v.continue_selling_out_of_stock) return null;
  return Math.max(0, v.stock_qty ?? 0);
}

export type VariantRow = {
  id: string;
  price: number | null;
  weight_grams: number | null;
  option1_value: string | null;
  option2_value?: string | null;
  option3_value?: string | null;
  main_image_url: string | null;
  stock_qty: number | null;
  continue_selling_out_of_stock: boolean;
};

export type ProductRow = {
  id: string;
  title: string | null;
  store_id: string;
  product_variants: VariantRow[] | null;
};

export type PricedLine = {
  productId: string;
  variantId: string;
  storeId: string;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  /** Naira, straight from the variant row. */
  unitPrice: number;
  quantity: number;
  weightGrams: number | null;
  /** See stockCeiling. */
  stock: number | null;
};

export type PriceResult =
  | { ok: true; items: PricedLine[]; storeId: string }
  | { ok: false; error: string; status: number };

/** Resolves each requested line against the ACTIVE product rows the server
 *  just read. A line whose product is missing from `products` is unavailable
 *  (deleted, unpublished, or never existed: the buyer can't tell, and neither
 *  should a caller probing ids). One order is one store, because one courier
 *  pickup is one store's address. */
export function priceLines(
  lines: OrderLine[],
  products: ProductRow[],
  legacy: boolean,
): PriceResult {
  const byId = new Map(products.map((p) => [p.id, p]));
  const items: PricedLine[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      return legacy
        ? { ok: false, error: "This product isn't available.", status: 404 }
        : {
            ok: false,
            error:
              "Something in your bag isn't available any more. Go back to your bag to see what changed.",
            status: 409,
          };
    }
    const title = product.title ?? "Item";
    const variants = product.product_variants ?? [];
    const variant = legacy
      ? (variants.find((v) => v.id === line.variantId) ?? variants[0])
      : variants.find((v) => v.id === line.variantId);
    if (!variant) {
      return legacy
        ? { ok: false, error: "This product has no price.", status: 422 }
        : {
            ok: false,
            error: `The option you picked for ${title} isn't available any more.`,
            status: 409,
          };
    }
    if (!variant.price) {
      return {
        ok: false,
        error: legacy ? "This product has no price." : `${title} has no price yet.`,
        status: 422,
      };
    }
    items.push({
      productId: product.id,
      variantId: variant.id,
      storeId: product.store_id,
      title,
      variantLabel: variantLabelOf(variant, variants.length),
      imageUrl: variant.main_image_url ?? null,
      unitPrice: variant.price,
      quantity: line.quantity,
      weightGrams: variant.weight_grams ?? null,
      stock: stockCeiling(variant),
    });
  }
  const storeId = items[0]?.storeId;
  if (!storeId) return { ok: false, error: "There's nothing to check out.", status: 400 };
  if (items.some((i) => i.storeId !== storeId)) {
    return {
      ok: false,
      error: "Pieces from different stores are checked out separately.",
      status: 422,
    };
  }
  return { ok: true, items, storeId };
}

/** The first line that can't be filled from stock, as a message for the buyer,
 *  or null when every line can. */
export function stockProblem(items: PricedLine[], legacy: boolean): string | null {
  for (const it of items) {
    if (it.stock === null || it.stock >= it.quantity) continue;
    if (legacy || it.stock < 1) {
      return legacy ? "Sorry, that item just sold out." : `Sorry, ${it.title} just sold out.`;
    }
    return `Only ${it.stock} left of ${it.title}. Lower the quantity in your bag.`;
  }
  return null;
}

/** Naira to kobo for one unit. Prices are stored in naira and may carry kobo
 *  decimals; rounding once per unit keeps every order line a whole number. */
export function unitKobo(unitPrice: number): number {
  return Math.round(unitPrice * 100);
}

export function itemsTotalKobo(items: Pick<PricedLine, "unitPrice" | "quantity">[]): number {
  return items.reduce((sum, it) => sum + unitKobo(it.unitPrice) * it.quantity, 0);
}

/** Shipbubble's package_items: one entry per line, with the per-unit weight
 *  and value and the count, so the courier prices the summed weight of the
 *  whole parcel. Strings because that is what the API documents. */
export function packageItems(items: PricedLine[], defaultWeightKg: number) {
  return items.map((it) => ({
    name: it.title,
    description: it.title,
    unit_weight: String(it.weightGrams ? it.weightGrams / 1000 : defaultWeightKg),
    unit_amount: String(it.unitPrice),
    quantity: String(it.quantity),
  }));
}
