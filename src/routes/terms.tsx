import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Oakmonte" },
      {
        name: "description",
        content:
          "The Terms of Service that govern use of Oakmonte — a content-driven fashion marketplace connecting buyers, vetted sellers, and creators.",
      },
      { property: "og:title", content: "Terms of Service — Oakmonte" },
      {
        property: "og:description",
        content:
          "The Terms of Service that govern use of Oakmonte — a content-driven fashion marketplace connecting buyers, vetted sellers, and creators.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

const LAST_UPDATED = "July 19, 2026";

const SECTIONS: { id: string; n: number; title: string }[] = [
  { id: "acceptance", n: 1, title: "Acceptance of Terms" },
  { id: "what-oakmonte-is", n: 2, title: "What Oakmonte Is" },
  { id: "eligibility", n: 3, title: "Eligibility" },
  { id: "verification", n: 4, title: "Account Verification" },
  { id: "buyer-terms", n: 5, title: "Buyer Terms" },
  { id: "seller-terms", n: 6, title: "Seller Terms" },
  { id: "creator-terms", n: 7, title: "Creator Terms" },
  { id: "prohibited", n: 8, title: "Prohibited Conduct" },
  { id: "payments-escrow", n: 9, title: "Payments & Escrow" },
  { id: "ip", n: 10, title: "Intellectual Property" },
  { id: "termination", n: 11, title: "Termination" },
  { id: "liability", n: 12, title: "Limitation of Liability" },
  { id: "disputes", n: 13, title: "Dispute Resolution" },
  { id: "changes", n: 14, title: "Changes to These Terms" },
  { id: "contact", n: 15, title: "Contact" },
];

function TermsPage() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      {/* Header */}
      <header className="px-4 sm:px-6 lg:px-8 py-6 border-b border-brand-text/10 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src="/favicon.png" alt="Oakmonte" className="h-9 w-auto" />
        </Link>
        <div className="flex gap-6 text-[11px] uppercase tracking-widest">
          <Link to="/" className="opacity-70 hover:opacity-100 transition-opacity">
            Home
          </Link>
          <button
            onClick={() => typeof window !== "undefined" && window.print()}
            className="opacity-70 hover:opacity-100 transition-opacity print:hidden"
          >
            Print / PDF
          </button>
        </div>
      </header>

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Title */}
        <div className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-50 mb-4">Legal</p>
          <h1 className="font-display text-5xl md:text-7xl leading-none tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-6 text-xs uppercase tracking-widest opacity-60">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        {/* Plain-language summary */}
        <div className="border border-brand-text/15 bg-brand-muted/30 p-6 md:p-8 mb-12 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-3">
            In plain language
          </p>
          <p className="text-sm md:text-base leading-relaxed">
            Oakmonte connects verified sellers, creators, and buyers through content-driven fashion
            shopping. Payments are held in escrow until delivery is confirmed. Sellers and creators
            are independent — we vet them, but we don't manufacture or own the products sold. Full
            terms are below; read them before you use the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12 lg:gap-16">
          {/* Table of contents */}
          <aside className="lg:sticky lg:top-8 lg:self-start print:hidden">
            <p className="text-[10px] uppercase tracking-[0.25em] opacity-50 mb-4">Contents</p>
            <nav className="flex flex-col gap-2 text-sm">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`transition-colors border-l-2 pl-3 py-1 ${
                    active === s.id
                      ? "border-brand-accent text-brand-text"
                      : "border-transparent opacity-60 hover:opacity-100 hover:border-brand-text/30"
                  }`}
                >
                  <span className="opacity-60 mr-2">{s.n}.</span>
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* Body */}
          <article className="max-w-2xl text-sm md:text-[15px] leading-relaxed space-y-14">
            <Section id="acceptance" n={1} title="Acceptance of Terms">
              <p>
                By creating an account, browsing, or otherwise using Oakmonte, you agree to these
                Terms of Service and any policies referenced within them. If you do not agree with
                any part of these terms, you should not use the platform.
              </p>
            </Section>

            <Section id="what-oakmonte-is" n={2} title="What Oakmonte Is">
              <p>
                Oakmonte is a content-first fashion marketplace built around three types of users:
              </p>
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  <span className="font-medium">Buyers</span> — discover fashion through content and
                  purchase directly from it.
                </li>
                <li>
                  <span className="font-medium">Sellers</span> — vetted brands and vendors who list
                  and fulfill products.
                </li>
                <li>
                  <span className="font-medium">Creators</span> — individuals who post content and
                  link it to listed products, earning through collaborations.
                </li>
              </ul>
              <p>
                Oakmonte is a marketplace facilitator. We are not the manufacturer, owner, or
                merchant of record for products sold by sellers on the platform. Sellers are
                independent parties and are responsible for their own listings, product quality, and
                order fulfillment.
              </p>
            </Section>

            <Section id="eligibility" n={3} title="Eligibility">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  Minimum age to hold an account:{" "}
                  <Placeholder>
                    decide 13+/16+/18+ policy, including any parental consent handling for younger
                    users
                  </Placeholder>
                  .
                </li>
                <li>You must provide accurate registration information and keep it current.</li>
                <li>
                  Oakmonte reserves the right to refuse, suspend, or terminate accounts that violate
                  these terms.
                </li>
              </ul>
            </Section>

            <Section id="verification" n={4} title="Account Verification">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  Browsing and light interaction — liking, following, saving — require no
                  verification.
                </li>
                <li>
                  Phone verification is required at checkout and before publishing a review. This
                  exists to reduce fraud and protect the integrity of reviews on the platform, not
                  as an arbitrary hurdle.
                </li>
                <li>
                  Sellers and creators go through an additional vetting step before they may list
                  products or link content to listings. Our vetting process evolves over time and is
                  applied at Oakmonte's discretion.
                </li>
              </ul>
            </Section>

            <Section id="buyer-terms" n={5} title="Buyer Terms">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  Purchases are made directly through content or product listings on the platform.
                </li>
                <li>
                  Payment is held in escrow and released to the seller only after delivery is
                  confirmed{" "}
                  <Placeholder>
                    define exact escrow release rule: confirmation event and any satisfaction window
                  </Placeholder>
                  .
                </li>
                <li>
                  Refund and return eligibility:{" "}
                  <Placeholder>
                    define return window, condition requirements, and who pays return shipping
                  </Placeholder>
                  .
                </li>
                <li>Buyers are responsible for providing accurate delivery information.</li>
              </ul>
            </Section>

            <Section id="seller-terms" n={6} title="Seller Terms">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>Sellers must accurately represent products, pricing, and availability.</li>
                <li>Sellers are responsible for fulfillment and timely shipping.</li>
                <li>
                  Payment for a sale is released from escrow according to Oakmonte's release policy
                  (see Section 5). Sellers do not receive funds until that condition is met.
                </li>
                <li>
                  Platform fee / commission structure:{" "}
                  <Placeholder>state actual fee percentage and whether flat or tiered</Placeholder>.
                </li>
                <li>
                  Sellers may not solicit buyers to complete transactions outside Oakmonte to avoid
                  fees or escrow protection. This is a prohibited practice — it undermines the trust
                  model the platform is built on.
                </li>
                <li>
                  Repeated unresponsiveness or unfulfilled orders may result in reduced visibility
                  or account suspension, at Oakmonte's discretion.
                </li>
              </ul>
            </Section>

            <Section id="creator-terms" n={7} title="Creator Terms">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>Creators retain ownership of the content they post.</li>
                <li>
                  By posting, creators grant Oakmonte a non-exclusive, worldwide, royalty-free
                  license to display, distribute, and link that content to product listings on the
                  platform. This license is revocable upon deletion of the content.
                </li>
                <li>
                  Creators may link their content to listed products for collaboration-based
                  monetization. The specific payout structure is described in the
                  <Placeholder>Creator Payout Policy — link once published</Placeholder>.
                </li>
                <li>
                  Creators are responsible for ensuring they have rights to any content they post —
                  including their own likeness, footage, music, and any third-party material.
                </li>
              </ul>
            </Section>

            <Section id="prohibited" n={8} title="Prohibited Conduct">
              <p>
                The following are prohibited on Oakmonte and may result in content removal,
                suspension, or termination:
              </p>
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  Fake reviews, fake likes, fake comments or shares, and manufactured scarcity
                  claims.
                </li>
                <li>Circumventing escrow by arranging off-platform payment.</li>
                <li>Uploading content you do not have the rights to.</li>
                <li>Harassment, hate speech, or abusive behavior toward other users.</li>
                <li>
                  Attempting to extract other users' contact information through watermark removal,
                  embedded text, or similar workarounds.
                </li>
                <li>Impersonating another seller, creator, or brand.</li>
              </ul>
            </Section>

            <Section id="payments-escrow" n={9} title="Payments & Escrow">
              <p>
                Funds are collected at the point of purchase and held by Oakmonte, through its
                third-party payment processor{" "}
                <Placeholder>name the actual payment processor once selected</Placeholder>, until
                the release condition described in Section 5 is met. Once the condition is met,
                funds are released to the seller net of applicable fees.
              </p>
              <p>
                Payments are processed by a third-party payment processor. Oakmonte is not itself a
                bank or a licensed financial institution
                <Placeholder>confirm actual regulatory status before publishing</Placeholder>.
              </p>
              <p>
                Currency: <Placeholder>state supported currency or currencies</Placeholder>.
              </p>
            </Section>

            <Section id="ip" n={10} title="Intellectual Property">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>The Oakmonte name, logo, and platform design are owned by Oakmonte.</li>
                <li>
                  User-generated content remains owned by the user who posted it, subject to the
                  license granted in Section 7.
                </li>
                <li>
                  To report intellectual property infringement, contact us at
                  <Placeholder>IP takedown contact address</Placeholder> with a description of the
                  content in question and evidence of your rights. We review takedown requests in
                  good faith.
                </li>
              </ul>
            </Section>

            <Section id="termination" n={11} title="Termination">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>Oakmonte may suspend or terminate accounts for violations of these terms.</li>
                <li>
                  Users may close their own accounts at any time. Pending orders continue through
                  fulfillment and escrow release under these terms; escrowed funds are released or
                  refunded according to the outcome of each pending order.
                </li>
              </ul>
            </Section>

            <Section id="liability" n={12} title="Limitation of Liability">
              <p>
                Oakmonte facilitates transactions between buyers, sellers, and creators. We are not
                liable for product quality, seller conduct, or delivery delays beyond our stated
                vetting and escrow processes.
              </p>
              <p>
                The platform is provided on an "as-is" and "as-available" basis, without warranties
                of any kind, whether express or implied, to the extent permitted by applicable law.
              </p>
              <p>
                <Placeholder>
                  Have counsel draft the enforceable liability cap and disclaimer language for your
                  jurisdiction — do not publish without legal review
                </Placeholder>
                .
              </p>
            </Section>

            <Section id="disputes" n={13} title="Dispute Resolution">
              <p>
                Buyer/seller disputes are handled through Oakmonte's internal resolution process
                before escrowed funds are released or refunded. Both parties may be asked to provide
                evidence — order details, delivery confirmation, photos, or correspondence — as part
                of the review.
              </p>
              <p>
                Governing law and jurisdiction:{" "}
                <Placeholder>
                  confirm governing jurisdiction (e.g. Nigeria) and whether disputes proceed through
                  courts or a named arbitration process
                </Placeholder>
                .
              </p>
            </Section>

            <Section id="changes" n={14} title="Changes to These Terms">
              <p>
                Oakmonte may update these terms from time to time. When we do, we will post the
                updated version on this page with a new "last updated" date. Continued use of the
                platform after an update constitutes acceptance of the revised terms.
              </p>
            </Section>

            <Section id="contact" n={15} title="Contact">
              <p>
                Questions about these terms? Reach us at
                <Placeholder>real support email or address</Placeholder>.
              </p>
            </Section>
          </article>
        </div>
      </div>

      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-brand-text/5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center text-[10px] uppercase tracking-widest opacity-50 print:hidden">
        <div>© 2026 Oakmonte Collective</div>
        <div className="flex gap-8">
          <Link to="/terms">Terms</Link>
          <a href="#">Privacy</a>
          <a href="#">Manifesto</a>
        </div>
      </footer>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <a href={`#${id}`} className="group block mb-4 no-underline">
        <p className="text-[10px] uppercase tracking-[0.25em] opacity-50 mb-2">Section {n}</p>
        <h2 className="font-display text-2xl md:text-3xl tracking-tight leading-tight">
          {title}
          <span className="ml-2 opacity-0 group-hover:opacity-40 transition-opacity text-brand-accent text-lg align-middle">
            #
          </span>
        </h2>
      </a>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline bg-brand-accent/10 text-brand-accent border border-brand-accent/30 px-1.5 py-0.5 text-[12px] rounded-sm mx-0.5 align-baseline">
      [{children}]
    </span>
  );
}
