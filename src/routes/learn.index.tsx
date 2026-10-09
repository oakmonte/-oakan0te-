import { createFileRoute, Link } from "@tanstack/react-router";
import { ogImageMeta } from "@/lib/og-image";
import { LEARN_ARTICLES, canonicalLink } from "@/lib/seo";

const TITLE = "Guides for fashion sellers in Nigeria | Oakmonte";
const DESC =
  "Practical guides for fashion sellers in Nigeria and Africa: getting an online store, selling from Instagram, and choosing between a marketplace and a store builder.";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [
      { name: "theme-color", content: "#ffffff" },
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...ogImageMeta("sellers", "Oakmonte guides for fashion sellers"),
    ],
    links: [canonicalLink("/learn")],
  }),
  component: LearnIndex,
});

function LearnIndex() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-4 py-10 text-neutral-900">
      <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Oakmonte</p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight">Guides for fashion sellers</h1>
      <p className="mt-3 text-neutral-600">
        How to get an online store for your fashion brand in Nigeria and across Africa.
      </p>
      <ul className="mt-8 space-y-4">
        {LEARN_ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link
              to="/learn/$slug"
              params={{ slug: a.slug }}
              className="block rounded-2xl border border-neutral-200 p-4 active:bg-neutral-50"
            >
              <h2 className="text-lg font-bold">{a.title}</h2>
              <p className="mt-1 text-sm text-neutral-600">{a.description}</p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-10 rounded-2xl bg-neutral-900 p-5 text-white">
        <p className="font-bold">Ready to sell?</p>
        <p className="mt-1 text-sm text-neutral-300">
          Open a customizable storefront on Oakmonte. 4.5% all-in (3% Oakmonte + 1.5% Paystack).
        </p>
        <Link
          to="/"
          className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
        >
          Sell on Oakmonte
        </Link>
      </div>
    </main>
  );
}
