import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";
import { loadOffer, moveOffer } from "@/lib/offers.server";

// The buyer accepting the seller's counter: the counter becomes the agreed
// price. Someone else's offer reads as not found.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

export const Route = createFileRoute("/api/offers/$offerId")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { offerId: string } }) => {
        const user = await getRequestUser(request);
        const offer = await loadOffer(params.offerId);
        if (!user || !offer || offer.buyer_id !== user.id) return json({ error: "Not found" }, 404);
        if (offer.status !== "countered" || !offer.counter_kobo) {
          return json({ error: "There's no counter offer to accept." }, 409);
        }
        const ok = await moveOffer(offer.id, "countered", {
          status: "accepted",
          agreed_kobo: offer.counter_kobo,
        });
        return ok ? json({ ok: true }) : json({ error: "This offer just changed." }, 409);
      },
    },
  },
});
