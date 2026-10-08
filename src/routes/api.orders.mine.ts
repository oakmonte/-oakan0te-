import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { getRequestUser } from "@/lib/server-auth";
import { loadPaymentStatuses } from "@/lib/order-events.server";
import { parseBefore, refundStateFor } from "@/lib/order-status";

// The signed-in buyer's own orders, newest first (?before= for the next page).
// buyer_id comes from the validated session, never the request. Guest orders
// (buyer_id null) never appear here: a guest reaches theirs only through the
// link they were given at checkout.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;
const PAGE = 20;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export const Route = createFileRoute("/api/orders/mine")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        if (!user) return json({ error: "Not signed in" }, 401);
        const before = parseBefore(new URL(request.url).searchParams.get("before"));

        let query = supabaseAdmin
          .from("orders")
          .select("id, status, total_kobo, store_id, created_at")
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(PAGE);
        if (before) query = query.lt("created_at", before);
        const { data: orders, error } = await query;
        if (error) {
          console.error("my orders list failed", error);
          return json({ error: "Couldn't load your orders" }, 500);
        }

        const rows = orders ?? [];
        const ids = rows.map((o) => o.id);
        const storeIds = [...new Set(rows.map((o) => o.store_id))];
        const [{ data: items }, { data: stores }, payments] = await Promise.all([
          ids.length
            ? supabaseAdmin
                .from("order_items")
                .select("order_id, title, variant_label, image_url, quantity")
                .in("order_id", ids)
            : Promise.resolve({ data: [] as never[] }),
          storeIds.length
            ? supabaseAdmin.from("stores").select("id, brand_name").in("id", storeIds)
            : Promise.resolve({ data: [] as never[] }),
          loadPaymentStatuses(ids),
        ]);

        return json({
          orders: rows.map((o) => {
            const own = (items ?? []).filter((i) => i.order_id === o.id);
            return {
              id: o.id,
              status: o.status,
              totalKobo: o.total_kobo,
              createdAt: o.created_at,
              storeName: (stores ?? []).find((s) => s.id === o.store_id)?.brand_name ?? null,
              itemCount: own.reduce((n, i) => n + i.quantity, 0),
              firstItem: own[0]
                ? {
                    title: own[0].title,
                    variantLabel: own[0].variant_label,
                    imageUrl: own[0].image_url,
                  }
                : null,
              refund: refundStateFor(o.status, payments.get(o.id) ?? null),
            };
          }),
          nextBefore: rows.length === PAGE ? rows[rows.length - 1].created_at : null,
        });
      },
    },
  },
});
