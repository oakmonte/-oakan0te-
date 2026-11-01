import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { getRequestUser } from "@/lib/server-auth";
import { listOffers, MIN_OFFER_SHARE, offersTable } from "@/lib/offers.server";

// The buyer's side of Make Offer. POST names a price for one variant; GET lists
// the caller's own offers for the Offers tab in Messages.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 8;
}

export const Route = createFileRoute("/api/offers")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        if (!user) return json({ offers: [] });
        try {
          return json({ offers: await listOffers({ buyerId: user.id }) });
        } catch (err) {
          console.error("offers list failed", err);
          return json({ error: "Couldn't load your offers." }, 500);
        }
      },
      POST: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        if (!user) return json({ error: "Sign in to make an offer." }, 401);
        if (limited(user.id)) return json({ error: "Too many offers. Wait a minute." }, 429);

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const productId = typeof body?.productId === "string" ? body.productId : "";
        const variantId = typeof body?.variantId === "string" ? body.variantId : "";
        const amount = Number(body?.amount);
        if (!productId || !variantId || !Number.isFinite(amount) || amount <= 0) {
          return json({ error: "Enter the price you'd like to pay." }, 400);
        }

        const { data: variant } = await supabaseAdmin
          .from("product_variants")
          .select("id, price, product_id, products!inner(id, store_id, status)")
          .eq("id", variantId)
          .eq("product_id", productId)
          .maybeSingle();
        const product = variant?.products as unknown as
          | { id: string; store_id: string; status: string }
          | undefined;
        if (!variant || !product || product.status !== "active" || variant.price == null) {
          return json({ error: "This piece isn't available." }, 404);
        }
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("owner_id")
          .eq("id", product.store_id)
          .maybeSingle();
        if (store?.owner_id === user.id) {
          return json({ error: "You can't make an offer on your own piece." }, 400);
        }

        const listKobo = Math.round(Number(variant.price) * 100);
        const amountKobo = Math.round(amount * 100);
        if (amountKobo >= listKobo) {
          return json({ error: "That's the full price — just buy it." }, 400);
        }
        if (amountKobo < Math.ceil(listKobo * MIN_OFFER_SHARE)) {
          return json(
            { error: `Offers start at ${Math.round(MIN_OFFER_SHARE * 100)}% of the price.` },
            400,
          );
        }

        // One live offer per buyer per variant: a new one replaces the old.
        await offersTable()
          .delete()
          .eq("buyer_id", user.id)
          .eq("variant_id", variantId)
          .in("status", ["pending", "countered"]);
        const { error } = await offersTable().insert({
          store_id: product.store_id,
          product_id: productId,
          variant_id: variantId,
          buyer_id: user.id,
          list_price_kobo: listKobo,
          amount_kobo: amountKobo,
        });
        if (error) {
          console.error("offer insert failed", error);
          return json({ error: "Couldn't send your offer. Try again." }, 500);
        }
        return json({ ok: true });
      },
    },
  },
});
