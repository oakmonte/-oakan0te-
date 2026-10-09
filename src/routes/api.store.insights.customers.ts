import { createFileRoute } from "@tanstack/react-router";
import type { CustomersResponse } from "@/lib/insights";
import {
  buildCustomerRows,
  loadPaidOrders,
  privateJson,
  resolveInsightsStore,
} from "@/lib/insights.server";

// This store's customers, derived from its own paid orders -- never from
// follows, other stores' orders or anyone's profile beyond the public
// @username. A buyer appears here only because they bought here.
export const Route = createFileRoute("/api/store/insights/customers")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await resolveInsightsStore(request);
        if (!auth.ok) return auth.response;

        try {
          const { orders, truncated } = await loadPaidOrders(auth.value.storeId, null);
          const rows = await buildCustomerRows(auth.value.storeId, orders);
          let totalKobo = 0;
          for (const r of rows) totalKobo += r.totalKobo;
          const body: CustomersResponse = {
            customers: rows.map(({ orderIds: _ids, ...row }) => row),
            summary: {
              customers: rows.length,
              repeat: rows.filter((r) => r.orders > 1).length,
              totalKobo,
            },
            truncated,
          };
          return privateJson(body);
        } catch (err) {
          console.error("insights customers failed", err);
          return privateJson({ error: "Couldn't load your customers" }, 500);
        }
      },
    },
  },
});
