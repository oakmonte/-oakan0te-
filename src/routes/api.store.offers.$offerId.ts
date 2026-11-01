import { createFileRoute } from "@tanstack/react-router";
import { requireOwnStore } from "@/lib/server-auth";
import { loadOffer, moveOffer } from "@/lib/offers.server";

// The seller answering an offer: { action: "accept" } takes the buyer's price;
// { action: "counter", amount } names theirs, which the buyer can then accept.
// Only the store's own offers -- anything else reads as not found.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

export const Route = createFileRoute("/api/store/offers/$offerId")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { offerId: string } }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) return auth.response;
        const offer = await loadOffer(params.offerId);
        if (!offer || offer.store_id !== auth.value.storeId) {
          return json({ error: "Not found" }, 404);
        }
        if (offer.status !== "pending") {
          return json({ error: "This offer has already been answered." }, 409);
        }

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (body?.action === "accept") {
          const ok = await moveOffer(offer.id, "pending", {
            status: "accepted",
            agreed_kobo: offer.amount_kobo,
          });
          return ok ? json({ ok: true }) : json({ error: "This offer just changed." }, 409);
        }
        if (body?.action === "counter") {
          const counterKobo = Math.round(Number(body.amount) * 100);
          if (!Number.isFinite(counterKobo) || counterKobo <= offer.amount_kobo) {
            return json({ error: "Counter with more than they offered." }, 400);
          }
          if (counterKobo >= offer.list_price_kobo) {
            return json({ error: "Counter with less than your listed price." }, 400);
          }
          const ok = await moveOffer(offer.id, "pending", {
            status: "countered",
            counter_kobo: counterKobo,
          });
          return ok ? json({ ok: true }) : json({ error: "This offer just changed." }, 409);
        }
        return json({ error: "Choose accept or counter." }, 400);
      },
    },
  },
});
