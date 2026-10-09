import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import {
  attributeToPosts,
  attributionTotals,
  parsePeriod,
  parseTzOffset,
  periodWindows,
  type ContentProduct,
  type ContentResponse,
} from "@/lib/insights";
import { loadPaidOrders, privateJson, resolveInsightsStore } from "@/lib/insights.server";

// The seller's posts, the pieces of THIS store each one links, and the paid
// orders of those pieces in the period since the post went up.
//
// Tags pointing at other stores' products are dropped rather than shown: the
// numbers beside them would be another store's sales.
const MAX_POSTS = 60;

export const Route = createFileRoute("/api/store/insights/content")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await resolveInsightsStore(request);
        if (!auth.ok) return auth.response;
        const { storeId, user } = auth.value;

        const params = new URL(request.url).searchParams;
        const period = parsePeriod(params.get("period"));
        const tz = parseTzOffset(params.get("tz"));
        const { current } = periodWindows(period, new Date(), tz);

        try {
          const [postsRes, paid] = await Promise.all([
            supabaseAdmin
              .from("posts")
              .select(
                "id, caption, media_type, media_url, thumbnail_url, created_at, created_with, visibility, post_product_tags(product_id)",
                { count: "exact" },
              )
              .eq("user_id", user.id)
              .eq("status", "published")
              .order("created_at", { ascending: false })
              .limit(MAX_POSTS),
            loadPaidOrders(storeId, new Date(current.startMs).toISOString()),
          ]);
          if (postsRes.error) throw postsRes.error;
          const rawPosts = postsRes.data ?? [];

          const tagged = [
            ...new Set(rawPosts.flatMap((p) => (p.post_product_tags ?? []).map((t) => t.product_id))),
          ];
          const products = new Map<string, ContentProduct>();
          for (let i = 0; i < tagged.length; i += 200) {
            const { data, error } = await supabaseAdmin
              .from("products")
              .select("id, title, status, product_variants(price, main_image_url)")
              // The store filter is what drops other stores' products.
              .eq("store_id", storeId)
              .in("id", tagged.slice(i, i + 200));
            if (error) throw error;
            for (const p of data ?? []) {
              const prices = (p.product_variants ?? [])
                .map((v) => v.price)
                .filter((n): n is number => n != null && n > 0);
              products.set(p.id, {
                id: p.id,
                title: p.title?.trim() || "Untitled piece",
                imageUrl:
                  (p.product_variants ?? []).find((v) => v.main_image_url)?.main_image_url ?? null,
                priceKobo: prices.length ? Math.round(Math.min(...prices) * 100) : null,
                status: p.status,
              });
            }
          }

          const links = rawPosts.map((p) => ({
            id: p.id,
            created_at: p.created_at,
            productIds: [
              ...new Set((p.post_product_tags ?? []).map((t) => t.product_id)),
            ].filter((id) => products.has(id)),
          }));
          const perPost = attributeToPosts(links, paid.orders, current);

          const body: ContentResponse = {
            period,
            posts: rawPosts.map((p, i) => ({
              id: p.id,
              caption: p.caption,
              mediaType: p.media_type,
              mediaUrl: p.media_url,
              thumbnailUrl: p.thumbnail_url,
              createdWith: p.created_with,
              visibility: p.visibility,
              createdAt: p.created_at,
              products: links[i].productIds.map((id) => products.get(id)!),
              attribution: perPost[p.id],
            })),
            // Totals cover the posts shown (the newest MAX_POSTS); `published`
            // is every published post, so the screen can say when it's more.
            totals: {
              published: postsRes.count ?? rawPosts.length,
              shown: rawPosts.length,
              linkedPosts: links.filter((l) => l.productIds.length > 0).length,
              ...attributionTotals(links, paid.orders, current),
            },
            truncated: paid.truncated,
          };
          return privateJson(body);
        } catch (err) {
          console.error("insights content failed", err);
          return privateJson({ error: "Couldn't load your content" }, 500);
        }
      },
    },
  },
});
