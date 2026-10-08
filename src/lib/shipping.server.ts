import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { packageItems, priceLines, type OrderLine, type PricedLine } from "@/lib/order-lines";

// Server-only Shipbubble helpers shared by the rates route and order creation.
// Order creation re-prices delivery through the same function the checkout page
// used, so the amount charged can never be a number the browser made up.

const BASE = "https://api.shipbubble.com/v1";
const DEFAULT_WEIGHT_KG = 0.5;
// Boxed clothing; a per-seller package size comes with the shipping settings.
const DEFAULT_BOX_CM = { length: 30, width: 25, height: 10 };

/** Shipbubble only takes a full name: at least two words, letters only ("John
 *  Doe"). A store called "Pami's world" or "Atelier 9" is cleaned to fit, and a
 *  single word gets "Store" appended so a one-word brand still validates. */
export function shipbubbleName(raw: string): string {
  const words = raw
    .replace(/[^\p{L}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "Oakmonte Seller";
  if (words.length === 1) words.push("Store");
  return words.slice(0, 4).join(" ");
}

export class ShippingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function shipbubble(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.SHIPBUBBLE_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await res.json().catch(() => null)) as {
    data?: unknown;
    message?: string;
  } | null;
  if (!res.ok || !payload?.data) {
    console.error("Shipbubble", path, res.status, payload);
    throw new ShippingError(payload?.message ?? `Shipbubble ${res.status}`, 502);
  }
  return payload.data as Record<string, unknown> & unknown[];
}

// Tomorrow in Lagos. Shipbubble rolls late requests to the next day anyway;
// asking for a real future date avoids a rejected "today".
function pickupDate() {
  const lagos = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(lagos.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export type Courier = {
  courierId: string;
  serviceCode: string;
  name: string;
  price: number;
  eta: string | null;
};

/** One priced order line. Kept under its original name for the callers that
 *  still read a single `item`. */
export type PricedItem = PricedLine;

export type RatesInput = { addressCode: number } & (
  | { productId: string; variantId: string | null }
  | { lines: OrderLine[]; legacy?: boolean }
);

/** Prices every line from the database, then asks Shipbubble what delivering
 *  the whole parcel from the seller's pickup address costs.
 *
 *  Accepts one product (the Buy Now page) or a bag's lines for ONE store; a
 *  bag spanning stores is refused, since one courier pickup is one address.
 *  `item` is the first line, for callers written before the bag existed. */
export async function fetchRates(input: RatesInput): Promise<{
  item: PricedItem;
  items: PricedItem[];
  storeId: string;
  requestToken: string;
  couriers: Courier[];
}> {
  const legacy = "productId" in input ? true : (input.legacy ?? false);
  const lines: OrderLine[] =
    "productId" in input
      ? [{ productId: input.productId, variantId: input.variantId, quantity: 1 }]
      : input.lines;
  if (lines.length === 0) throw new ShippingError("There's nothing to check out.", 400);

  const { data: products } = await supabaseAdmin
    .from("products")
    .select(
      "id, title, store_id, status, product_variants(id, price, weight_grams, option1_value, option2_value, option3_value, main_image_url, stock_qty, continue_selling_out_of_stock)",
    )
    .in("id", [...new Set(lines.map((l) => l.productId))])
    .eq("status", "active");
  const priced = priceLines(lines, products ?? [], legacy);
  if (!priced.ok) throw new ShippingError(priced.error, priced.status);
  const { items, storeId } = priced;

  const [{ data: store }, { data: loc }] = await Promise.all([
    supabaseAdmin
      .from("stores")
      .select("brand_name, business_email, business_phone")
      .eq("id", storeId)
      .maybeSingle(),
    supabaseAdmin
      .from("store_locations")
      .select("address_line, address_line2, city, state, country, lat, lng")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!store || !loc?.address_line) {
    throw new ShippingError(
      "This seller hasn't set a pickup address yet, so delivery can't be priced.",
      422,
    );
  }

  const senderAddress = [loc.address_line, loc.address_line2, loc.city, loc.state, loc.country]
    .filter(Boolean)
    .join(", ");
  const sender = await shipbubble("/shipping/address/validate", {
    method: "POST",
    body: JSON.stringify({
      name: shipbubbleName(store.brand_name),
      email: store.business_email ?? "orders@oakmonte.store",
      phone: store.business_phone ?? "08000000000",
      address: senderAddress,
      ...(loc.lat != null && loc.lng != null ? { latitude: loc.lat, longitude: loc.lng } : {}),
    }),
  });

  const cats = (await shipbubble("/shipping/labels/categories")) as unknown as {
    category_id: number;
    category: string;
  }[];
  const category = cats.find((c) => /fashion|cloth|apparel|wear/i.test(c.category)) ?? cats[0];

  const rates = await shipbubble("/shipping/fetch_rates", {
    method: "POST",
    body: JSON.stringify({
      sender_address_code: sender.address_code,
      reciever_address_code: input.addressCode,
      pickup_date: pickupDate(),
      category_id: category.category_id,
      package_items: packageItems(items, DEFAULT_WEIGHT_KG),
      package_dimension: DEFAULT_BOX_CM,
    }),
  });

  const couriers: Courier[] = ((rates.couriers as Record<string, unknown>[]) ?? []).map((c) => ({
    courierId: String(c.courier_id ?? ""),
    serviceCode: String(c.service_code ?? ""),
    name: String(c.courier_name ?? c.name ?? "Courier"),
    // rate_card_amount is what the buyer is shown; total is what the Shipbubble
    // wallet is debited. They differ only with own courier accounts.
    price: Number(c.rate_card_amount ?? c.total ?? 0),
    eta:
      typeof c.delivery_eta === "string"
        ? c.delivery_eta
        : ((c.delivery_eta_time as string) ?? null),
  }));
  if (couriers.length === 0) {
    throw new ShippingError("No couriers can deliver to that address right now.", 422);
  }
  return {
    item: items[0],
    items,
    storeId,
    requestToken: String(rates.request_token),
    couriers,
  };
}
