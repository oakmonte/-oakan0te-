import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requireOwnStore } from "@/lib/server-auth";
import { loadPaymentStatuses } from "@/lib/order-events.server";
import { parseBefore, parseSellerTab, refundStateFor, statusesForTab } from "@/lib/order-status";

// The caller's own store's orders, one status tab at a time (?tab=, newest
// first, ?before= for the next page). The store comes from the session, never
// from the request, so there is no id to swap. Unpaid orders are left out: a
// seller should only see something to act on once the money is in.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;
const PAGE = 30;

export const Route = createFileRoute("/api/store/orders")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) {
          if (auth.response.status === 403) {
            return Response.json(
              { orders: [], nextBefore: null, toShipCount: 0 },
              { headers: PRIVATE },
            );
          }
          return auth.response;
        }
        const { storeId } = auth.value;
        const url = new URL(request.url);
        const tab = parseSellerTab(url.searchParams.get("tab"));
        const before = parseBefore(url.searchParams.get("before"));

        let query = supabaseAdmin
          .from("orders")
          .select(
            "id, status, items_total_kobo, delivery_fee_kobo, total_kobo, ship_to, courier_name, tracking_url, shipbubble_order_id, created_at",
          )
          .eq("store_id", storeId)
          .in("status", statusesForTab(tab))
          .order("created_at", { ascending: false })
          .limit(PAGE);
        if (before) query = query.lt("created_at", before);

        // The count is only for the To ship tab -- the one number a seller
        // needs to see from any tab, because it's work waiting on them.
        const [{ data: orders, error }, { count: toShipCount }] = await Promise.all([
          query,
          supabaseAdmin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("store_id", storeId)
            .eq("status", "paid"),
        ]);
        if (error) {
          console.error("store orders list failed", error);
          return Response.json({ error: "Couldn't load orders" }, { status: 500 });
        }

        const rows = orders ?? [];
        const ids = rows.map((o) => o.id);
        const [{ data: items }, payments] = await Promise.all([
          ids.length
            ? supabaseAdmin
                .from("order_items")
                .select("order_id, title, variant_label, image_url, quantity")
                .in("order_id", ids)
            : Promise.resolve({ data: [] as never[] }),
          loadPaymentStatuses(ids),
        ]);

        const visible = rows.filter(
          // A cancelled order the buyer never paid for is not the seller's
          // business; one they paid for is (its refund shows here).
          (o) =>
            o.status !== "cancelled" ||
            ["confirmed", "refunded"].includes(payments.get(o.id) ?? ""),
        );

        return Response.json(
          {
            orders: visible.map((o) => ({
              ...o,
              refund: refundStateFor(o.status, payments.get(o.id) ?? null),
              items: (items ?? []).filter((i) => i.order_id === o.id),
            })),
            // Paged on the raw rows, not the filtered ones, so a page that lost
            // a row to the filter above still leads to the next.
            nextBefore: rows.length === PAGE ? rows[rows.length - 1].created_at : null,
            toShipCount: toShipCount ?? 0,
          },
          { headers: PRIVATE },
        );
      },
    },
  },
});
