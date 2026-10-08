import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { getRequestUser } from "@/lib/server-auth";
import { fetchRates, ShippingError } from "@/lib/shipping.server";
import { initializeTransaction, paystackConfigured } from "@/lib/paystack.server";
import { itemsTotalKobo, parseOrderLines, stockProblem, unitKobo } from "@/lib/order-lines";

// Creates an order and starts its Paystack payment. Open to guests: a guest is
// identified afterwards only by the guest_token in the link we hand back.
//
// Nothing money-shaped is taken from the browser. Item prices, weights and the
// delivery fee are all re-read / re-priced here; the client only says which
// products and how many (one product from Buy Now, or one store's lines from
// the bag), which validated address and which courier service it picked.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 6;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const Route = createFileRoute("/api/orders")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (limited(user?.id ?? ip)) return json({ error: "Too many tries. Wait a minute." }, 429);

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (!body) return json({ error: "Bad request" }, 400);

        const parsed = parseOrderLines(body);
        const serviceCode = str(body.serviceCode, 120);
        const addressCode = Number(body.addressCode);
        const name = str(body.name, 120);
        const phone = str(body.phone, 30);
        const address = str(body.address, 400);
        const email = str(body.email, 200);
        if (!parsed.ok) return json({ error: parsed.error }, 400);
        if (!serviceCode || !Number.isFinite(addressCode) || !name || !phone || !address) {
          return json({ error: "Missing order details." }, 400);
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json({ error: "That email doesn't look right." }, 400);
        }

        try {
          const { items, storeId, requestToken, couriers } = await fetchRates({
            lines: parsed.lines,
            legacy: parsed.legacy,
            addressCode,
          });
          const courier = couriers.find((c) => c.serviceCode === serviceCode);
          if (!courier) return json({ error: "That delivery option is no longer available." }, 409);

          // Out-of-stock check per line, unless the seller sells past zero.
          // Stock is read in the same query that priced the lines, moments ago.
          const shortfall = stockProblem(items, parsed.legacy);
          if (shortfall) return json({ error: shortfall }, 409);

          const itemsKobo = itemsTotalKobo(items);
          const deliveryKobo = Math.round(courier.price * 100);
          const totalKobo = itemsKobo + deliveryKobo;

          const { data: order, error: orderErr } = await supabaseAdmin
            .from("orders")
            .insert({
              buyer_id: user?.id ?? null,
              guest_email: user ? null : email || null,
              store_id: storeId,
              status: "awaiting_payment",
              items_total_kobo: itemsKobo,
              delivery_fee_kobo: deliveryKobo,
              // Platform fee is applied when Paystack splits go live (6%).
              platform_fee_kobo: 0,
              total_kobo: totalKobo,
              delivery_method: "courier",
              ship_to: {
                name,
                phone,
                address,
                addressCode,
                lat: typeof body.lat === "number" ? body.lat : null,
                lng: typeof body.lng === "number" ? body.lng : null,
              },
              shipbubble_request_token: requestToken,
              courier_service_code: courier.serviceCode,
              courier_id: courier.courierId,
              courier_name: courier.name,
            })
            .select("id, guest_token")
            .single();
          if (orderErr || !order) {
            console.error("order insert failed", orderErr);
            return json({ error: "Couldn't create your order. Try again." }, 500);
          }

          const { error: itemErr } = await supabaseAdmin.from("order_items").insert(
            items.map((item) => ({
              order_id: order.id,
              product_id: item.productId,
              variant_id: item.variantId,
              title: item.title,
              variant_label: item.variantLabel,
              image_url: item.imageUrl,
              unit_price_kobo: unitKobo(item.unitPrice),
              quantity: item.quantity,
              weight_grams: item.weightGrams,
            })),
          );
          if (itemErr) {
            console.error("order item insert failed", itemErr);
            await supabaseAdmin.from("orders").delete().eq("id", order.id);
            return json({ error: "Couldn't create your order. Try again." }, 500);
          }

          const reference = `ord_${order.id}`;
          await supabaseAdmin.from("order_payments").insert({
            order_id: order.id,
            method: "paystack",
            amount_kobo: totalKobo,
            status: "pending",
            reference,
          });

          const origin = new URL(request.url).origin;
          const orderUrl = `${origin}/order/${order.id}?t=${order.guest_token}`;
          let authorizationUrl: string | null = null;
          if (paystackConfigured()) {
            const init = await initializeTransaction({
              email: user?.email ?? (email || "orders@oakmonte.store"),
              amountKobo: totalKobo,
              reference,
              callbackUrl: orderUrl,
              metadata: { orderId: order.id },
            });
            authorizationUrl = init.authorizationUrl;
          }
          return json({
            orderId: order.id,
            token: order.guest_token,
            orderUrl,
            authorizationUrl,
            totalKobo,
          });
        } catch (err) {
          if (err instanceof ShippingError && err.status !== 502) {
            return json({ error: err.message }, err.status);
          }
          console.error("create order failed", err);
          return json({ error: "Couldn't place your order. Try again in a moment." }, 502);
        }
      },
    },
  },
});
