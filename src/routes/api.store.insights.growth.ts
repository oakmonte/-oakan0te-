import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import {
  aggregateProducts,
  deriveCustomers,
  growthChecklist,
  lowStock,
  productsNeedingFixes,
  rankProducts,
  type GrowthResponse,
  type GrowthSignals,
} from "@/lib/insights";
import {
  loadCatalog,
  loadPaidOrders,
  privateJson,
  resolveInsightsStore,
} from "@/lib/insights.server";

// /store/growth in one request: what sells, what's about to stop selling,
// what can't sell yet, and a checklist built from those same numbers. (The
// share kit needs only the store's username, which the page already has.)
const LIST_LIMIT = 20;

export const Route = createFileRoute("/api/store/insights/growth")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await resolveInsightsStore(request);
        if (!auth.ok) return auth.response;
        const { storeId, user } = auth.value;

        try {
          const [catalog, paid, postsRes] = await Promise.all([
            loadCatalog(storeId),
            loadPaidOrders(storeId, null),
            // Posts belong to a person, not a store: the seller's own posts
            // are the ones that can link this store's pieces.
            supabaseAdmin
              .from("posts")
              .select("id, created_at, post_product_tags(product_id)", { count: "exact" })
              .eq("user_id", user.id)
              .eq("status", "published")
              .order("created_at", { ascending: false })
              .limit(500),
          ]);
          if (postsRes.error) throw postsRes.error;

          const own = new Set(catalog.map((p) => p.id));
          const posts = postsRes.data ?? [];
          const low = lowStock(catalog);
          const fixes = productsNeedingFixes(catalog);
          const sold = aggregateProducts(paid.orders);
          const customers = deriveCustomers(paid.orders);

          const signals: GrowthSignals = {
            activeProducts: catalog.filter((p) => p.status === "active").length,
            productsMissingPhoto: fixes.filter((f) => f.missing.includes("photo")).length,
            productsMissingPrice: fixes.filter((f) => f.missing.includes("price")).length,
            lowStockCount: low.length,
            publishedPosts: postsRes.count ?? posts.length,
            postsLinkingProducts: posts.filter((p) =>
              (p.post_product_tags ?? []).some((t) => own.has(t.product_id)),
            ).length,
            lastPostAt: posts[0]?.created_at ?? null,
            paidOrders: paid.orders.length,
            repeatCustomers: customers.filter((c) => c.orders > 1).length,
          };

          const body: GrowthResponse = {
            signals,
            checklist: growthChecklist(signals, new Date()),
            topByRevenue: rankProducts(sold, "revenue", 5),
            topByUnits: rankProducts(sold, "units", 5),
            lowStock: low.slice(0, LIST_LIMIT),
            needsFixing: fixes.slice(0, LIST_LIMIT),
            needsFixingTotal: fixes.length,
            truncated: paid.truncated,
          };
          return privateJson(body);
        } catch (err) {
          console.error("insights growth failed", err);
          return privateJson({ error: "Couldn't load growth insights" }, 500);
        }
      },
    },
  },
});
