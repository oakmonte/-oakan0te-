import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { LEARN_ARTICLES, ORIGIN, PUBLIC_PAGES } from "@/lib/seo";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const url = (path: string, lastmod?: string) =>
  `<url><loc>${esc(ORIGIN + path)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}</url>`;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = [
          ...PUBLIC_PAGES.map((p) => url(p.path)),
          ...LEARN_ARTICLES.map((a) => url(`/learn/${a.slug}`, a.updated)),
        ];

        // Public storefronts. Only the username and date are selected: the
        // stores row also carries third-party tokens, which must never be
        // read into something that renders. Stores that sell from the personal
        // profile only have no store page, so they are left out.
        // A missing key or a database blip must not take the sitemap down:
        // the static and /learn entries are still worth serving.
        try {
          const { data, error } = await supabaseAdmin
            .from("stores")
            .select("store_username, created_at")
            .eq("personal_storefront_only", false)
            .not("onboarded_at", "is", null)
            .limit(5000);
          if (error) throw error;
          for (const s of data ?? []) {
            entries.push(url(`/store-profile/${encodeURIComponent(s.store_username)}`));
          }
        } catch (err) {
          console.error("sitemap: failed to load stores", err);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
