import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Oakmonte" },
      { name: "description", content: "How Oakmonte collects, uses, shares, and protects the data of buyers, sellers, and creators on our content-driven fashion marketplace." },
      { property: "og:title", content: "Privacy Policy — Oakmonte" },
      { property: "og:description", content: "How Oakmonte collects, uses, shares, and protects the data of buyers, sellers, and creators on our content-driven fashion marketplace." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const LAST_UPDATED = "July 19, 2026";

const SECTIONS: { id: string; n: number; title: string }[] = [
  { id: "introduction", n: 1, title: "Introduction" },
  { id: "what-we-collect", n: 2, title: "What We Collect" },
  { id: "how-we-use", n: 3, title: "How We Use It" },
  { id: "sharing", n: 4, title: "Who We Share Data With" },
  { id: "cookies", n: 5, title: "Cookies & Tracking" },
  { id: "minors", n: 6, title: "Children & Minors" },
  { id: "retention", n: 7, title: "Data Retention" },
  { id: "rights", n: 8, title: "Your Rights" },
  { id: "security", n: 9, title: "Data Security" },
  { id: "storage", n: 10, title: "Where Data Is Stored" },
  { id: "third-parties", n: 11, title: "Third-Party Services" },
  { id: "changes", n: 12, title: "Changes to This Policy" },
  { id: "contact", n: 13, title: "Contact" },
];

function PrivacyPage() {
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
      <header className="px-4 sm:px-6 lg:px-8 py-6 border-b border-brand-text/10 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-wide">OAKMONTE</Link>
        <div className="flex gap-6 text-[11px] uppercase tracking-widest">
          <Link to="/" className="opacity-70 hover:opacity-100 transition-opacity">Home</Link>
          <button
            onClick={() => typeof window !== "undefined" && window.print()}
            className="opacity-70 hover:opacity-100 transition-opacity print:hidden"
          >
            Print / PDF
          </button>
        </div>
      </header>

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-50 mb-4">Legal</p>
          <h1 className="font-display text-5xl md:text-7xl leading-none tracking-tight">Privacy Policy</h1>
          <p className="mt-6 text-xs uppercase tracking-widest opacity-60">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="border border-brand-text/15 bg-brand-muted/30 p-6 md:p-8 mb-12 max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-3">In plain language</p>
          <p className="text-sm md:text-base leading-relaxed">
            We collect what's needed to run your account, verify sellers and buyers, and
            deliver orders. We don't sell your data. Location is only accessed when you
            actively use a location-based feature. Full details are below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12 lg:gap-16">
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

          <article className="max-w-2xl text-sm md:text-[15px] leading-relaxed space-y-14">
            <Section id="introduction" n={1} title="Introduction">
              <p>
                This Privacy Policy explains how Oakmonte handles the personal information of
                everyone who uses the platform — buyers, sellers, and creators. By using
                Oakmonte, you agree to the practices described here.
              </p>
              <p>
                We've tried to write this plainly. Where a section refers to a specific rule
                that hasn't been finalized yet, we've marked it clearly rather than leave it vague.
              </p>
            </Section>

            <Section id="what-we-collect" n={2} title="What We Collect">
              <p>We collect the following categories of information:</p>
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  <span className="font-medium">Account data</span> — name, email, and phone
                  number. These are collected specifically for checkout and review verification,
                  and are not required simply to browse the platform.
                </li>
                <li>
                  <span className="font-medium">Location data</span> — collected only when you
                  actively use a "use current location" feature. This is opt-in per use.
                  Oakmonte does not track your location passively in the background.
                </li>
                <li>
                  <span className="font-medium">Delivery information</span> — the shipping
                  address you provide at checkout. It is shared only with the relevant seller
                  and delivery partner, and only for the fulfillment of that order.
                </li>
                <li>
                  <span className="font-medium">Content uploads</span> — photos, videos, and
                  listings posted by sellers and creators through the platform.
                </li>
                <li>
                  <span className="font-medium">Payment information</span> — Oakmonte does not
                  store your full card or payment credentials. Payments are handled by
                  <Placeholder>name the payment processor once selected</Placeholder>. We retain
                  only transaction records (amount, date, order reference), not raw payment details.
                </li>
                <li>
                  <span className="font-medium">Usage data</span> — pages viewed, products
                  browsed, and general interaction with the app, used for recommendations
                  and platform improvement.
                </li>
                <li>
                  <span className="font-medium">Verification data</span> — information
                  collected during seller and creator vetting. The specific inputs vary
                  depending on the type of account and evolve as our vetting process matures.
                </li>
              </ul>
            </Section>

            <Section id="how-we-use" n={3} title="How We Use It">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>To operate the marketplace — processing orders, running escrow, and connecting buyers to sellers and creators.</li>
                <li>To verify identity at checkout and before reviews, in order to reduce fraud and prevent fake reviews.</li>
                <li>To deliver location-based features when you opt in to them.</li>
                <li>To improve recommendations and the overall shopping experience.</li>
                <li>To communicate order updates and account notices, and — only if you've opted in — marketing messages.</li>
              </ul>
            </Section>

            <Section id="sharing" n={4} title="Who We Share Data With">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  <span className="font-medium">Sellers</span> receive your delivery
                  information only for orders you place with them — not full access to your account.
                </li>
                <li>
                  <span className="font-medium">Delivery and logistics partners</span> receive
                  what they need to fulfill shipping for a specific order.
                </li>
                <li>
                  <span className="font-medium">Payment processor</span> receives what is
                  required to process the transaction itself.
                </li>
                <li>
                  Oakmonte does not sell personal data to third parties for advertising
                  purposes. <Placeholder>Confirm this remains true before publishing — disclose any ad-network or third-party analytics data-sharing here if present</Placeholder>.
                </li>
                <li>
                  <span className="font-medium">Legal disclosure</span> — data may be shared
                  where required by law, or where necessary to protect the platform and its
                  users from fraud or abuse.
                </li>
              </ul>
            </Section>

            <Section id="cookies" n={5} title="Cookies & Tracking">
              <p>
                Oakmonte uses cookies and similar technologies to keep you signed in, remember
                your preferences, and understand how the platform is used.
              </p>
              <p>
                Analytics provider: <Placeholder>name the analytics tool in use, e.g. Plausible, Google Analytics, PostHog</Placeholder>.
              </p>
              <p>
                You can opt out of non-essential cookies through
                <Placeholder>describe the opt-out mechanism — cookie banner, in-app setting, or browser controls</Placeholder>.
                Essential cookies (those needed for sign-in, checkout, and security) cannot be disabled without breaking core functionality.
              </p>
            </Section>

            <Section id="minors" n={6} title="Children & Minors">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  Minimum age to hold an Oakmonte account: <Placeholder>state minimum age — must match the age policy in the Terms of Service</Placeholder>.
                </li>
                <li>
                  If accounts are permitted below 18: <Placeholder>describe the parental involvement or consent process required</Placeholder>.
                </li>
                <li>
                  If Oakmonte becomes aware that it has collected personal data from a user
                  below the stated minimum age, that account and its associated data will be
                  removed. If you believe a minor has provided us data, contact us using the
                  details in Section 13 so we can act on it.
                </li>
              </ul>
            </Section>

            <Section id="retention" n={7} title="Data Retention">
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>
                  Account, order, and content data is retained for
                  <Placeholder>state retention period — often tied to Nigerian tax/transaction record requirements</Placeholder> after account closure.
                </li>
                <li>
                  When you delete your account, your profile is removed and your uploaded
                  content is unpublished. Records tied to completed transactions (order
                  history, payout records, tax records) are retained for the period above,
                  as required for legal and financial compliance.
                </li>
              </ul>
            </Section>

            <Section id="rights" n={8} title="Your Rights">
              <p>
                Under the Nigeria Data Protection Act (NDPA) and comparable frameworks, you
                generally have the right to:
              </p>
              <ul className="list-disc pl-5 space-y-2 marker:text-brand-accent">
                <li>Access the personal data Oakmonte holds about you.</li>
                <li>Request correction of information that is inaccurate or out of date.</li>
                <li>Request deletion of your data, subject to legal retention requirements (such as transaction records).</li>
                <li>Withdraw consent for optional data uses like marketing communications or location features.</li>
              </ul>
              <p>
                To exercise any of these rights, email us at
                <Placeholder>privacy contact email</Placeholder> or use the in-app request
                flow in your account settings. We aim to respond within a reasonable window
                and may need to verify your identity before acting on a request.
              </p>
            </Section>

            <Section id="security" n={9} title="Data Security">
              <p>
                We protect user data using standard industry practices, including encryption
                in transit, restricted internal access, and authentication controls on
                administrative systems. No online service can guarantee absolute security,
                but we treat the trust placed in the platform as central to how it is built.
              </p>
              <p>
                Oakmonte does not currently claim any specific external security certification.
                If that changes, this section will be updated with the specifics.
              </p>
            </Section>

            <Section id="storage" n={10} title="Where Data Is Stored / International Transfer">
              <p>
                User data is hosted on
                <Placeholder>name hosting infrastructure and region — e.g. Supabase EU/US region</Placeholder>.
              </p>
              <p>
                Where personal data is transferred outside of Nigeria, we do so in accordance
                with the cross-border transfer requirements of the NDPA — including using
                providers with appropriate safeguards in place.
                <Placeholder>Confirm and describe the specific transfer basis once finalized</Placeholder>.
              </p>
            </Section>

            <Section id="third-parties" n={11} title="Third-Party Services">
              <p>
                Oakmonte relies on third-party infrastructure providers to host, build, and
                operate the platform (including hosting, payment processing, analytics, and
                communications tools). We select providers with reasonable security and privacy
                practices, and share only what each provider needs to perform its function.
              </p>
              <p>
                If you have a question about a specific vendor, reach out via the contact
                details in Section 13 and we'll respond directly.
              </p>
            </Section>

            <Section id="changes" n={12} title="Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. When we do, the updated
                version will be posted here with a new "last updated" date. For material
                changes — anything that meaningfully affects your rights or how data is
                handled — we will notify affected users directly (for example, by email)
                rather than rely on a silent update.
              </p>
            </Section>

            <Section id="contact" n={13} title="Contact">
              <p>
                Questions about this policy, or want to exercise your data rights? Reach us at
                <Placeholder>privacy contact email</Placeholder>.
              </p>
              <p>
                Data Protection contact: <Placeholder>name the designated DPO or compliance contact role, if any, under NDPA</Placeholder>.
              </p>
            </Section>
          </article>
        </div>
      </div>

      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-brand-text/5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center text-[10px] uppercase tracking-widest opacity-50 print:hidden">
        <div>© 2026 Oakmonte Collective</div>
        <div className="flex gap-8">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <a href="#">Manifesto</a>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <a href={`#${id}`} className="group block mb-4 no-underline">
        <p className="text-[10px] uppercase tracking-[0.25em] opacity-50 mb-2">Section {n}</p>
        <h2 className="font-display text-2xl md:text-3xl tracking-tight leading-tight">
          {title}
          <span className="ml-2 opacity-0 group-hover:opacity-40 transition-opacity text-brand-accent text-lg align-middle">#</span>
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