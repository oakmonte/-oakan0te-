import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/lib/integrations/my-supabase/client.server";
import { requireStoreOwner } from "@/lib/server-auth";

export const Route = createFileRoute("/api/bumpa/connect")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { storeId, apiKey } = await request.json();

        if (!storeId || !apiKey) {
          return Response.json({ error: "storeId and apiKey required" }, { status: 400 });
        }

        // Writes a third-party API key into store_credentials on the
        // service-role key. Unauthenticated, this let anyone attach their own
        // Bumpa account to someone else's store — and doubled as an oracle for
        // testing whether a stolen Bumpa key is still live.
        const owns = await requireStoreOwner(request, storeId);
        if (!owns.ok) return owns.response;

        const verifyRes = await fetch("https://api.getbumpa.com/api/commerce/v1/products?limit=1", {
          headers: {
            "X-Api-Key": apiKey,
            Accept: "application/json",
          },
        });

        if (!verifyRes.ok) {
          const body = await verifyRes.text();
          console.error("Bumpa verify failed:", verifyRes.status, body);
          return Response.json({ error: "Invalid Bumpa API key" }, { status: 401 });
        }

        const { error } = await supabase.from("store_credentials").upsert(
          {
            store_id: storeId,
            bumpa_api_key: apiKey,
            bumpa_connected_at: new Date().toISOString(),
          },
          { onConflict: "store_id" },
        );

        if (error) {
          return (
            console.error("bumpa connect failed", error),
            Response.json({ error: "Something went wrong" }, { status: 500 })
          );
        }

        return Response.json({ success: true });
      },
    },
  },
});
