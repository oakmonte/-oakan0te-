import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/lib/integrations/my-supabase/client.server";

export const Route = createFileRoute("/api/bumpa/connect")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { storeId, apiKey } = await request.json();

        if (!storeId || !apiKey) {
          return Response.json({ error: "storeId and apiKey required" }, { status: 400 });
        }

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
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ success: true });
      },
    },
  },
});
