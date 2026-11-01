import { createFileRoute } from "@tanstack/react-router";
import { requireOwnStore } from "@/lib/server-auth";
import { listOffers } from "@/lib/offers.server";

// The seller's Offers tab: every offer on their store's pieces, newest first.
// The store comes from the session, never the request.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

export const Route = createFileRoute("/api/store/offers")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        // No store yet is a normal state, not an error.
        if (!auth.ok) {
          if (auth.response.status === 403)
            return Response.json({ offers: [] }, { headers: NO_STORE });
          return auth.response;
        }
        try {
          const offers = await listOffers({ storeId: auth.value.storeId });
          return Response.json({ offers }, { headers: NO_STORE });
        } catch (err) {
          console.error("store offers list failed", err);
          return Response.json({ error: "Couldn't load offers." }, { status: 500 });
        }
      },
    },
  },
});
