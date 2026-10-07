import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";

// Live courier prices for one product to a validated buyer address. Open to
// guests (guest checkout), so it is rate-limited per IP. Price, weight and the
// seller's pickup address all come from the database: the client only says
// which product/variant and which validated address_code.
const NO_STORE = { "Cache-Control": "no-store, private" } as const;
const BASE = "https://api.shipbubble.com/v1";
const DEFAULT_WEIGHT_KG = 0.5;
// Boxed clothing; a per-seller package size comes with the shipping settings.
const DEFAULT_BOX_CM = { length: 30, width: 25, height: 10 };

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 12;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

async function sb(path: string, init?: RequestInit) {
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
    throw new Error(payload?.message ?? `Shipbubble ${res.status}`);
  }
  return payload.data as Record<string, unknown> & unknown[];
}

// Tomorrow, or the day after once it is past 6pm in Lagos (Shipbubble rolls
// late requests to the next day anyway; asking for the real date avoids a
// rejected "today").
function pickupDate() {
  const lagos = new Date(Date.now() + 60 * 60 * 1000);
  const d = new Date(lagos.getTime() + 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/shipping/rates")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (limited(ip)) return json({ error: "Too many tries. Wait a minute." }, 429);

        const body = (await request.json().catch(() => null)) as {
          productId?: unknown;
          variantId?: unknown;
          addressCode?: unknown;
        } | null;
        const productId = typeof body?.productId === "string" ? body.productId : "";
        const variantId = typeof body?.variantId === "string" ? body.variantId : null;
        const addressCode = Number(body?.addressCode);
        if (!productId || !Number.isFinite(addressCode)) return json({ error: "Bad request" }, 400);

        try {
          const { data: product } = await supabaseAdmin
            .from("products")
            .select("title, store_id, status, product_variants(id, price, weight_grams)")
            .eq("id", productId)
            .eq("status", "active")
            .maybeSingle();
          if (!product) return json({ error: "This product isn't available." }, 404);
          const variant =
            product.product_variants?.find((v) => v.id === variantId) ??
            product.product_variants?.[0];
          if (!variant?.price) return json({ error: "This product has no price." }, 422);

          const [{ data: store }, { data: loc }] = await Promise.all([
            supabaseAdmin
              .from("stores")
              .select("brand_name, business_email, business_phone, owner_id")
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
            return json(
              {
                error: "This seller hasn't set a pickup address yet, so delivery can't be priced.",
              },
              422,
            );
          }

          // The seller's pickup address, validated each time for now; it gets
          // cached on the shipping settings row once that table exists.
          const senderAddress = [
            loc.address_line,
            loc.address_line2,
            loc.city,
            loc.state,
            loc.country,
          ]
            .filter(Boolean)
            .join(", ");
          const sender = await sb("/shipping/address/validate", {
            method: "POST",
            body: JSON.stringify({
              name: store.brand_name,
              email: store.business_email ?? "orders@oakmonte.store",
              phone: store.business_phone ?? "08000000000",
              address: senderAddress,
              ...(loc.lat != null && loc.lng != null
                ? { latitude: loc.lat, longitude: loc.lng }
                : {}),
            }),
          });

          const cats = (await sb("/shipping/labels/categories")) as unknown as {
            category_id: number;
            category: string;
          }[];
          const category =
            cats.find((c) => /fashion|cloth|apparel|wear/i.test(c.category)) ?? cats[0];

          const weightKg = variant.weight_grams ? variant.weight_grams / 1000 : DEFAULT_WEIGHT_KG;
          const rates = await sb("/shipping/fetch_rates", {
            method: "POST",
            body: JSON.stringify({
              sender_address_code: sender.address_code,
              reciever_address_code: addressCode,
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

          const couriers = ((rates.couriers as Record<string, unknown>[]) ?? []).map((c) => ({
            courierId: String(c.courier_id ?? ""),
            serviceCode: String(c.service_code ?? ""),
            name: String(c.courier_name ?? c.name ?? "Courier"),
            // rate_card_amount is what the buyer is shown; total is what the
            // Shipbubble wallet is debited. They differ only with own accounts.
            price: Number(c.rate_card_amount ?? c.total ?? 0),
            eta:
              typeof c.delivery_eta === "string" ? c.delivery_eta : (c.delivery_eta_time ?? null),
          }));
          if (couriers.length === 0) {
            return json({ error: "No couriers can deliver to that address right now." }, 422);
          }
          return json({ requestToken: rates.request_token, couriers });
        } catch (err) {
          console.error("rates failed", err);
          return json({ error: "Couldn't get delivery prices. Try again in a moment." }, 502);
        }
      },
    },
  },
});
