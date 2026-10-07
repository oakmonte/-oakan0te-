import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requireOwnStore } from "@/lib/server-auth";

// The caller's own store's orders. The store comes from the session, never from
// the request, so there is no id to swap. Unpaid orders are left out: a seller
// should only see something to act on once the money is in.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

export const Route = createFileRoute("/api/store/orders")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) {
          if (auth.response.status === 403) {
            return Response.json({ orders: [] }, { headers: PRIVATE });
          }
          return auth.response;
        }

        const { data: orders, error } = await supabaseAdmin
          .from("orders")
          .select(
            "id, status, items_total_kobo, delivery_fee_kobo, total_kobo, ship_to, courier_name, tracking_url, shipbubble_order_id, created_at",
          )
          .eq("store_id", auth.value.storeId)
          .in("status", ["paid", "shipped", "delivered"])
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) {
          console.error("store orders list failed", error);
          return Response.json({ error: "Couldn't load orders" }, { status: 500 });
        }

        const ids = (orders ?? []).map((o) => o.id);
        const { data: items } = ids.length
          ? await supabaseAdmin
              .from("order_items")
              .select("order_id, title, variant_label, image_url, quantity")
              .in("order_id", ids)
          : { data: [] };

        return Response.json(
          {
            orders: (orders ?? []).map((o) => ({
              ...o,
              items: (items ?? []).filter((i) => i.order_id === o.id),
            })),
          },
          { headers: PRIVATE },
        );
      },
    },
  },
});
