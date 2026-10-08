import { createFileRoute } from "@tanstack/react-router";
import { ORIGIN } from "@/lib/seo";

// Search engines and AI crawlers are welcome on the public pages. The signed-in
// app and every API route stay out: nothing there is worth indexing, and the
// crawl budget is better spent on /learn and the storefronts.
const BODY = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /store/
Disallow: /create
Disallow: /settings
Disallow: /messages
Disallow: /cart
Disallow: /auth/

# AI assistants may read and cite the public pages.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(BODY, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
