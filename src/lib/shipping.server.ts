import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";

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

export type PricedItem = {
  productId: string;
  variantId: string;
  storeId: string;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  unitPrice: number;
  weightGrams: number | null;
};

export async function fetchRates(input: {
  productId: string;
  variantId: string | null;
  addressCode: number;
}): Promise<{ item: PricedItem; requestToken: string; couriers: Courier[] }> {
  const { data: product } = await supabaseAdmin
    .from("products")
    .select(
      "title, store_id, status, product_variants(id, price, weight_grams, option1_value, main_image_url)",
    )
    .eq("id", input.productId)
    .eq("status", "active")
    .maybeSingle();
  if (!product) throw new ShippingError("This product isn't available.", 404);
  const variants = product.product_variants ?? [];
  const variant = variants.find((v) => v.id === input.variantId) ?? variants[0];
  if (!variant?.price) throw new ShippingError("This product has no price.", 422);

  const [{ data: store }, { data: loc }] = await Promise.all([
    supabaseAdmin
      .from("stores")
      .select("brand_name, business_email, business_phone")
      .eq("id", product.store_id)
      .maybeSingle(),
    supabaseAdmin
      .from("store_locations")
      .select("address_line, address_line2, city, state, country, lat, lng")
      .eq("store_id", product.store_id)
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

  const weightKg = variant.weight_grams ? variant.weight_grams / 1000 : DEFAULT_WEIGHT_KG;
  const rates = await shipbubble("/shipping/fetch_rates", {
    method: "POST",
    body: JSON.stringify({
      sender_address_code: sender.address_code,
      reciever_address_code: input.addressCode,
      pickup_date: pickupDate(),
      category_id: category.category_id,
      package_items: [
        {
          name: product.title ?? "Item",
          description: product.title ?? "Item",
          unit_weight: String(weightKg),
          unit_amount: String(variant.price),
          quantity: "1",
        },
      ],
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
    item: {
      productId: input.productId,
      variantId: variant.id,
      storeId: product.store_id,
      title: product.title ?? "Item",
      variantLabel: variants.length > 1 ? (variant.option1_value ?? null) : null,
      imageUrl: variant.main_image_url ?? null,
      unitPrice: variant.price,
      weightGrams: variant.weight_grams ?? null,
    },
    requestToken: String(rates.request_token),
    couriers,
  };
}
