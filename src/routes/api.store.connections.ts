import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requireOwnStore } from "@/lib/server-auth";

// Which catalogue sources the caller's own store has connected -- yes or no
// only. The credentials themselves never leave the server (store_credentials
// has RLS on and no policies). The upload page uses this to show "Import my
// … products" only once there's something connected to import from.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

export const Route = createFileRoute("/api/store/connections")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) {
          if (auth.response.status === 403) {
            return Response.json({ shopify: false, bumpa: false }, { headers: PRIVATE });
          }
          return auth.response;
        }
        const { data, error } = await supabaseAdmin
          .from("store_credentials")
          .select("shopify_connected_at, bumpa_connected_at")
          .eq("store_id", auth.value.storeId)
          .maybeSingle();
        if (error) {
          console.error("store connections lookup failed", error);
          return Response.json({ error: "Couldn't check connections" }, { status: 500 });
        }
        return Response.json(
          { shopify: !!data?.shopify_connected_at, bumpa: !!data?.bumpa_connected_at },
          { headers: PRIVATE },
        );
      },
    },
  },
});
