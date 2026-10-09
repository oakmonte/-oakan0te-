import { createFileRoute } from "@tanstack/react-router";
import {
  aggregateProducts,
  buildSalesSeries,
  customerIdentity,
  parsePeriod,
  parseTzOffset,
  periodWindows,
  rankProducts,
  type SalesResponse,
} from "@/lib/insights";
import { loadPaidOrders, privateJson, resolveInsightsStore } from "@/lib/insights.server";

// The dashboard's sales section: bars for 7D/30D/90D, the period's totals and
// best sellers, and all-time counts for the tiles under the chart.
//
// Everything is recomputed from paid orders on every request. Nothing is
// cached or pre-summed, so a refund or a late webhook can never leave a stale
// total behind, and at today's volumes the sum is cheaper than a cache.
export const Route = createFileRoute("/api/store/insights/sales")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await resolveInsightsStore(request);
        if (!auth.ok) return auth.response;

        const params = new URL(request.url).searchParams;
        const period = parsePeriod(params.get("period"));
        const tz = parseTzOffset(params.get("tz"));
        const now = new Date();

        try {
          // All time, not just the period: the tiles need lifetime orders and
          // customers, and the period plus its comparison is a subset anyway.
          const { orders, truncated } = await loadPaidOrders(auth.value.storeId, null);
          const series = buildSalesSeries(orders, period, now, tz);
          const { current } = periodWindows(period, now, tz);
          const inPeriod = orders.filter((o) => {
            const t = new Date(o.created_at).getTime();
            return t >= current.startMs && t < current.endMs;
          });

          let revenueKobo = 0;
          for (const o of orders) revenueKobo += o.items_total_kobo;

          const body: SalesResponse = {
            period,
            ...series,
            bestSellers: rankProducts(aggregateProducts(inPeriod), "units", 5),
            allTime: {
              orders: orders.length,
              revenueKobo,
              customers: new Set(orders.map(customerIdentity)).size,
            },
            truncated,
          };
          return privateJson(body);
        } catch (err) {
          console.error("insights sales failed", err);
          return privateJson({ error: "Couldn't load your sales" }, 500);
        }
      },
    },
  },
});
