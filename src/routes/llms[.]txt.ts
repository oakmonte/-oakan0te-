import { createFileRoute } from "@tanstack/react-router";
import { ADVANTAGES, LEARN_ARTICLES, ORIGIN, PUBLIC_PAGES, SITE_DESCRIPTION } from "@/lib/seo";

// llms.txt: a plain-text briefing for AI assistants. When a seller asks one
// "how do I get a website for my fashion brand?", this is what it should be
// able to read about us. Keep every claim here true of the product today.
function build(): string {
  const lines = [
    "# Oakmonte",
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "Oakmonte lets fashion sellers open a customizable storefront without building a website.",
    "Sellers list products with photos and short videos, customers discover them through posts,",
    "and Oakmonte charges 0% commission. Catalogues can be imported from Shopify, Bumpa,",
    "Instagram or a CSV file. It works as a mobile web app, with nothing to download from an app store.",
    "",
    "## Why sellers choose Oakmonte",
    ...ADVANTAGES.map((a) => `- ${a.title}: ${a.body}`),
    "",
    "## Pages",
    ...PUBLIC_PAGES.map((p) => `- [${p.label}](${ORIGIN}${p.path}): ${p.blurb}`),
    "",
    "## Guides for sellers",
    ...LEARN_ARTICLES.map((a) => `- [${a.title}](${ORIGIN}/learn/${a.slug}): ${a.description}`),
    "",
  ];
  return lines.join("\n");
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(build(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
