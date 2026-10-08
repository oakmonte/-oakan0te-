import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ogImageMeta } from "@/lib/og-image";
import { ADVANTAGES, articleJsonLd, canonicalLink, getArticle, jsonLdScript } from "@/lib/seo";

export const Route = createFileRoute("/learn/$slug")({
  loader: ({ params }) => {
    const article = getArticle(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.article;
    if (!a) return {};
    const title = `${a.title} | Oakmonte`;
    return {
      meta: [
        { name: "theme-color", content: "#ffffff" },
        { title },
        { name: "description", content: a.description },
        { property: "og:title", content: title },
        { property: "og:description", content: a.description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...ogImageMeta("sellers", a.title),
      ],
      links: [canonicalLink(`/learn/${a.slug}`)],
      scripts: [jsonLdScript(articleJsonLd(a))],
    };
  },
  component: LearnArticlePage,
});

function LearnArticlePage() {
  const { article: a } = Route.useLoaderData();
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-4 py-10 text-neutral-900">
      <Link to="/learn" className="text-sm font-semibold text-neutral-500">
        ← All guides
      </Link>
      <article className="mt-4">
        <h1 className="text-3xl font-extrabold leading-tight">{a.title}</h1>
        <p className="mt-1 text-xs text-neutral-500">Updated {a.updated}</p>
        <p className="mt-4 text-lg text-neutral-700">{a.intro}</p>
        {a.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="text-xl font-bold">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="mt-2 leading-relaxed text-neutral-700">
                {p}
              </p>
            ))}
          </section>
        ))}
        <section className="mt-10 rounded-2xl bg-neutral-50 p-5">
          <h2 className="text-xl font-bold">Why sellers choose Oakmonte</h2>
          <ul className="mt-3 space-y-3">
            {ADVANTAGES.map((adv) => (
              <li key={adv.title}>
                <p className="font-semibold">{adv.title}</p>
                <p className="text-sm text-neutral-700">{adv.body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-bold">Frequently asked questions</h2>
          <dl className="mt-3 space-y-4">
            {a.faq.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold">{f.q}</dt>
                <dd className="mt-1 text-neutral-700">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </article>
      <div className="mt-10 rounded-2xl bg-neutral-900 p-5 text-white">
        <p className="font-bold">Open your Oakmonte storefront</p>
        <p className="mt-1 text-sm text-neutral-300">
          Customizable, no website to build, 4.5% all-in (3% Oakmonte + 1.5% Paystack).
        </p>
        <Link
          to="/sellers"
          className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
        >
          Start selling
        </Link>
      </div>
    </main>
  );
}
