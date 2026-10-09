import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { readShipTo, whatsappNumber, type CustomerDetailResponse } from "@/lib/insights";
import {
  buildCustomerRows,
  loadPaidOrders,
  privateJson,
  resolveInsightsStore,
} from "@/lib/insights.server";

// One customer of this store and their orders here. The key is the opaque one
// the list handed out; it is looked up among THIS store's customers only, so a
// key from another store, a guessed key and a malformed one are all the same
// 404.
const KEY = /^[0-9a-f]{24}$/;
const MAX_ORDERS_SHOWN = 50;

export const Route = createFileRoute("/api/store/insights/customers/$customerKey")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { customerKey: string } }) => {
        const auth = await resolveInsightsStore(request);
        if (!auth.ok) return auth.response;
        if (!KEY.test(params.customerKey)) return privateJson({ error: "Not found" }, 404);
        const { storeId } = auth.value;

        try {
          const { orders } = await loadPaidOrders(storeId, null);
          const rows = await buildCustomerRows(storeId, orders);
          const match = rows.find((r) => r.key === params.customerKey);
          if (!match) return privateJson({ error: "Not found" }, 404);

          const ids = match.orderIds.slice(0, MAX_ORDERS_SHOWN);
          const { data, error } = await supabaseAdmin
            .from("orders")
            .select(
              "id, status, created_at, items_total_kobo, delivery_fee_kobo, total_kobo, courier_name, tracking_url, order_items(product_id, title, variant_label, image_url, unit_price_kobo, quantity)",
            )
            // store_id again, though the ids came from this store's own rows:
            // the one line that keeps a future refactor from leaking orders.
            .eq("store_id", storeId)
            .in("id", ids)
            .order("created_at", { ascending: false });
          if (error) throw error;

          const latest = orders.find((o) => o.id === match.orderIds[0]);
          const { orderIds: _ids, ...customer } = match;
          const body: CustomerDetailResponse = {
            customer: {
              ...customer,
              address: latest ? readShipTo(latest.ship_to).address : null,
              whatsapp: whatsappNumber(customer.phone),
            },
            orders: (data ?? []).map(({ order_items, ...o }) => ({ ...o, items: order_items ?? [] })),
            moreOrders: Math.max(0, match.orderIds.length - ids.length),
          };
          return privateJson(body);
        } catch (err) {
          console.error("insights customer detail failed", err);
          return privateJson({ error: "Couldn't load this customer" }, 500);
        }
      },
    },
  },
});
