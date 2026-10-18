import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ogImageMeta } from "@/lib/og-image";
import { canonicalLink } from "@/lib/seo";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isStandalone } from "@/lib/standalone";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { Check, ChevronDown } from "lucide-react";
import logoO from "@/assets/logo-o.png";
import { DashboardDemo } from "@/components/landing/DashboardDemo";
import { DeliveryDemo } from "@/components/landing/DeliveryDemo";
import { MessagingDemo } from "@/components/landing/MessagingDemo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      // White page, so the iOS status strip must be white too — see the
      // theme-color note in __root.tsx.
      { name: "theme-color", content: "#ffffff" },
      { title: "Sell on Oakmonte — Start something remarkable." },
      {
        name: "description",
        content:
          "Oakmonte gives honest sellers a fully customizable storefront and every tool and resource they need to set themselves apart — at whatever scale they choose to sell.",
      },
      { property: "og:title", content: "Sell on Oakmonte — Start something remarkable." },
      {
        property: "og:description",
        content:
          "A fully customizable storefront, escrow-protected payments and every tool you need to stand out — free to start.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...ogImageMeta("sellers", "Sell on Oakmonte: Start something remarkable."),
    ],
    links: [
      canonicalLink("/"),
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: SellersLanding,
});

/* ---------------- Data ----------------
   Grounded in what's actually true about Oakmonte (see routes/index.tsx and
   its FAQ copy) rather than generic SaaS-template language: escrow payments,
   creator-driven distribution, handled logistics, and up-front fees are real
   product facts, not marketing filler. */
// "As seen in" ticker. Rendered twice back to back so the loop is seamless.
const PRESS = [
  "LinkedIn Articles",
  "Substack",
  "Quora",
  "PR.com",
  "Medium",
  "Blogger",
  "IJSTN",
  "X",
];

const FEATURES = [
  {
    number: "01",
    title: "Your storefront, everywhere.",
    copy: "A free, fully customizable storefront your audience can reach from whatever social platform they already follow you on — one link, not a caged-in marketplace page.",
  },
  {
    number: "02",
    title: "Keep your margin.",
    copy: "No commission-hungry marketplace games — list for free, and see every fee before you publish, never after a sale.",
  },
  {
    number: "03",
    title: "Get paid, safely.",
    copy: "Payment sits in escrow until your customer confirms the piece, so a bad-faith return, a chargeback, or a customer who takes the product and refuses to pay doesn't cost you a thing.",
  },
  // Creator features: hidden while this page markets to sellers only.
  /*
  {
    number: "04",
    title: "Collaborate with creators.",
    copy: "Partner directly with creators to shoot the campaigns, drops, and content built around your pieces — not a link shared after the fact, but genius made together.",
  },
  {
    number: "05",
    title: "Customers you didn't chase.",
    copy: "Creators link your pieces right in their own content, so a curator can buy in one swipe — and every seller gets free visibility to curators browsing the app, no ad budget required.",
  },
  */
  {
    number: "04",
    title: "The operations, handled.",
    copy: "Delivery, tracked riders, website hosting — we absorb the pain points so you can focus on the product. Need a manufacturer too? We can connect you with one.",
  },
];

// The same honest, verifiable facts routes/index.tsx already stands behind
// (its RESULTS array) — not fabricated traction numbers. This is a
// pre-launch product; see POSTPONED.md.
const STATS = [
  { value: "0", label: "Payments released before your customer confirms" },
  { value: "100%", label: "Disputes routed through review, not chargebacks" },
  { value: "1", label: "Shared size chart across every listing" },
  { value: "$0", label: "Hidden fees — every cost shown before you publish" },
];

// Replaces three "plan" cards that all said FREE with nothing to actually
// compare — same CTA, same destination, no real tiers. One honest list
// instead of a fake choice.
const INCLUDED = [
  "Personal, customizable storefront",
  "30+ premium store templates",
  "Unlimited products and collections",
  "Escrow-protected payments on every sale",
  "Seller Studio — orders, products, customers, signals",
  "Growth insights and analytics",
  "Marketing tools and creator distribution",
  "Collaborate with creators and produce genius",
  "Full creative control over your store's direction",
  "Priority seller support",
  "Oakmonte Manufacturers access",
];

/* ---------------- Scroll reveal ----------------
   Same IntersectionObserver pattern as routes/index.tsx's Reveal component —
   reused here for consistency rather than reinvented. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, className: `reveal${inView ? " in-view" : ""}` };
}

/** Types its lines out once it scrolls into view. The full text is laid out
 *  invisibly underneath, so nothing below jumps as it types, and screen
 *  readers get the whole sentence at once. Reduced motion shows it all. */
function TypedText({ lines, className = "" }: { lines: string[]; className?: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const full = lines.join("\n");
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(full.length);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [full]);

  useEffect(() => {
    if (!started || count >= full.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), full[count] === "\n" ? 300 : 22);
    return () => clearTimeout(t);
  }, [started, count, full]);

  const render = (text: string) =>
    text.split("\n").flatMap((line, i) => (i ? [<br key={i} />, line] : [line]));

  return (
    <p ref={ref} className={`typed ${className}`} aria-label={lines.join(" ")}>
      <span className="typed-ghost" aria-hidden="true">
        {render(full)}
      </span>
      <span className="typed-live" aria-hidden="true">
        {render(full.slice(0, count))}
        {count < full.length && <span className="typed-caret" />}
      </span>
    </p>
  );
}

function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: 0 | 1 | 2 | 3;
  className?: string;
  as?: React.ElementType;
}) {
  const { ref, className: rc } = useReveal<HTMLDivElement>();
  const delayClass = delay ? ` reveal-delay-${delay}` : "";
  return (
    <Tag ref={ref} className={`${rc}${delayClass} ${className}`.trim()}>
      {children}
    </Tag>
  );
}

/* ---------------- Page ---------------- */
function SellersLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFeature, setOpenFeature] = useState(0);
  const navigate = useNavigate();
  // The installed app is the product, never the sales pitch. iOS saves
  // whatever page Add to Home Screen was tapped on (it doesn't reliably honour
  // the manifest's start_url), so an app saved from here would open here.
  // Layout effect: decided before the first paint, so the landing never
  // flashes up inside the app.
  const [inApp, setInApp] = useState(false);
  useLayoutEffect(() => {
    if (!isStandalone()) return;
    setInApp(true);
    void supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/store" : "/sign-in", replace: true });
    });
  }, [navigate]);

  if (inApp) return null;

  return (
    <main className="oak-sellers">
      <style>{CSS}</style>

      <header className="site-nav">
        <a className="wordmark" href="#top">
          <img className="wordmark-logo" src={logoO} alt="Oakmonte" />
          <span className="wordmark-word">akmonte</span>
          <span className="wordmark-tagline">CREATED TO CREATE.</span>
        </a>
        <nav className={menuOpen ? "nav-links is-open" : "nav-links"}>
          {/* Phone menu only: the desktop header shows Log in beside Start selling. */}
          <Link className="nav-menu-login" to="/sign-in" onClick={() => setMenuOpen(false)}>
            Log in
          </Link>
          {/* Hidden while this page markets to sellers only. Restore when ready.
          <a href="#sellers" onClick={() => setMenuOpen(false)}>
            For sellers
          </a>
          <Link to="/creators" onClick={() => setMenuOpen(false)}>
            Creators
          </Link>
          <Link to="/" onClick={() => setMenuOpen(false)}>
            Main
          </Link> */}
        </nav>
        <div className="nav-actions">
          <Link className="nav-login" to="/sign-in">
            Log in
          </Link>
          <Link className="pill-button pill-button-light" to="/set-up-store">
            Start selling
          </Link>
          {/* Phone menu: hidden; Log in is in the hero. Restore with the Menu/X imports.
          <button
            className="menu-button"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button> */}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-grid" />
        <div className="hero-copy">
          <h1>
            Start something
            <br />
            <em>Remarkable.</em>
          </h1>
          <p>
            Get an online store that actually optimises your business.
            <br />
            At whatever scale you sell at.
            <span className="hero-gap" />
            From automatic deliveries to in-web messaging,
            <br />
            We got you.
          </p>
          <div className="hero-buttons">
            <Link className="pill-button pill-button-acid" to="/set-up-store">
              Get your free website
            </Link>
            <Link className="text-link hero-link" to="/sign-in">
              Login
            </Link>
          </div>
        </div>
        <div className="hero-side-note">
          <strong>
            The tool
            <br />
            for
            <br />
            <em>creatives.</em>
          </strong>
          <span>EST. 2026</span>
        </div>
      </section>

      <section className="ticker-section">
        <span className="ticker-label">As seen in</span>
        <div className="marquee">
          <div className="marquee-track">
            {[...PRESS, ...PRESS].map((name, i) => (
              <span key={i}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="manifesto" id="why">
        <Reveal>
          <div className="section-kicker">Oakmonte / A better way to begin</div>
          <h2>
            Just another website provider.
            <br />
            <em>Till your eyes open.</em>
          </h2>
          <TypedText
            className="manifesto-typed"
            lines={[
              "We believe some realities of starting a brand kills creativity.",
              "We absorb those headaches so you stay creative and focus on what matters.",
            ]}
          />
        </Reveal>
        <Reveal delay={1} className="manifesto-sign">
          OAKMONTE
          <br />
          <span>CREATED TO CREATE.</span>
        </Reveal>
      </section>

      {/* Steps: hidden for now. Restore when needed.
      <section className="steps-section">
        <Reveal className="steps-list">
          <div>
            <span>01</span>
            <strong>Set up your store</strong>
          </div>
          <div>
            <span>02</span>
            <strong>Give us your account number</strong>
          </div>
          <div>
            <span>03</span>
            <strong>We handle the rest!</strong>
          </div>
        </Reveal>
      </section> */}

      <section className="features-section" id="sellers">
        <Reveal className="feature-intro">
          <div className="section-kicker">The platform</div>
          <h2>
            What Oakmonte
            <br />
            <em>does for you.</em>
          </h2>
          <p>Four concrete reasons sellers pick Oakmonte over building alone.</p>
        </Reveal>
        <Reveal delay={1} className="feature-list">
          {FEATURES.map((feature, index) => {
            const isOpen = openFeature === index;
            return (
              <div className={isOpen ? "feature-row is-open" : "feature-row"} key={feature.number}>
                <button
                  type="button"
                  className="feature-trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFeature(isOpen ? -1 : index)}
                >
                  <span className="feature-number">{feature.number}</span>
                  <strong className="feature-title">{feature.title}</strong>
                  <ChevronDown className="feature-chevron" size={20} />
                </button>
                <div className="feature-panel">
                  <div className="feature-panel-inner">
                    <p>{feature.copy}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {/* Hidden while this page markets to sellers only. Restore when ready.
          <div className="feature-more">
            <Link className="pill-button pill-button-acid" to="/creators">
              See more about creators
            </Link>
          </div> */}
        </Reveal>
      </section>

      <section className="studio-section">
        {/* Dashboard phone mock: removed, to be replaced by the three live demos.
        <Reveal className="studio-phone">
          {/ * A picture of the real seller dashboard (store/dashboard): same
              sections, labels and order. Sample store and figures. * /}
          <div className="sp-screen">
            <div className="sp-id">
              <span className="sp-logo">A</span>
              <div>
                <b>Adaeze Atelier</b>
                <small>adaeze.oakmonte.store</small>
              </div>
            </div>
            <div className="sp-pills">
              <span>Share link</span>
              <span>Edit store</span>
            </div>
            <div className="sp-title">Sales analytics</div>
            <div className="sp-chart">
              <small>This month</small>
              <strong>₦1,284,500</strong>
              <div className="chart">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="sp-tiles">
              <div>
                <small>Products listed</small>
                <b>42</b>
              </div>
              <div>
                <small>Orders</small>
                <b>184</b>
              </div>
              <div>
                <small>Net revenue</small>
                <b>₦1.2M</b>
              </div>
              <div>
                <small>Customers</small>
                <b>126</b>
              </div>
            </div>
            <div className="sp-title">Quick actions</div>
            <div className="sp-actions">
              <span>Add product</span>
              <span>Import products</span>
              <span>Pickup locations</span>
              <span>Collections</span>
              <span>Orders</span>
              <span>Discounts</span>
            </div>
          </div>
        </Reveal> */}
        <DashboardDemo />
        <Reveal delay={1} className="studio-copy">
          <div className="section-kicker">02 / Seller Studio</div>
          <h2>
            Run the shop.
            <br />
            <em>Keep the spark.</em>
          </h2>
          <p>
            Products, orders, customers and real-time signals in one screen — not four different
            tools stitched together to run your store.
          </p>
          <Link className="text-link" to="/set-up-store">
            Enter the studio
          </Link>
        </Reveal>
      </section>

      <section className="studio-section demo-flip">
        <Reveal className="studio-copy">
          <div className="section-kicker">03 / Deliveries</div>
          <h2>
            Orders ship.
            <br />
            <em>You get paid.</em>
          </h2>
          <p>
            Your customer pays for delivery at checkout. One tap books the courier, the rider is
            tracked to their door, and your money lands the moment it's delivered.
          </p>
        </Reveal>
        <DeliveryDemo />
      </section>

      <section className="studio-section">
        <MessagingDemo />
        <Reveal delay={1} className="studio-copy">
          <div className="section-kicker">04 / Messaging</div>
          <h2>
            Talk to buyers.
            <br />
            <em>Close the sale.</em>
          </h2>
          <p>
            Customers message you straight from your store. Answer their questions, send them the
            exact piece, and watch the order come in, without leaving Oakmonte.
          </p>
        </Reveal>
      </section>

      <section className="manufacturer-section" id="manufacturers">
        <Reveal>
          <div className="section-kicker">03 / Oakmonte Manufacturers</div>
          <h2>
            Make the thing
            <br />
            <em>you can't stop thinking about.</em>
          </h2>
          <p>
            Starting a brand shouldn't mean navigating a maze alone. Oakmonte Manufacturers connects
            you with vetted materials, partners, and minimum order quantities that actually fit a
            first run.
          </p>
          <Link className="pill-button pill-button-dark" to="/set-up-store">
            Meet the makers
          </Link>
        </Reveal>
        <Reveal delay={1} className="manufacturer-list">
          <div>
            <span>01</span>
            <strong>Source with confidence</strong>
          </div>
          <div>
            <span>02</span>
            <strong>Sample without the guesswork</strong>
          </div>
          <div>
            <span>03</span>
            <strong>Produce your first run</strong>
          </div>
        </Reveal>
      </section>

      <section className="stats-section">
        <Reveal className="section-kicker">The Oakmonte signal</Reveal>
        <div className="stats-grid">
          {STATS.map((stat, index) => (
            <Reveal key={stat.label} delay={(index % 4) as 0 | 1 | 2 | 3}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="plans-section" id="plans">
        <Reveal className="free-panel">
          <div className="section-kicker">Everything starts free</div>
          <h2>
            Everything, from day one.
            <br />
            <em>No tiers to unlock.</em>
          </h2>
          <p>
            Every seller gets the same toolkit, free — there's no plan to pick between and nothing
            you outgrow.
          </p>
          <ul className="free-list">
            {INCLUDED.map((item) => (
              <li key={item}>
                <Check size={14} />
                {item}
              </li>
            ))}
          </ul>
          <Link className="pill-button pill-button-acid" to="/set-up-store">
            Start selling free
          </Link>
        </Reveal>
      </section>

      <footer className="site-footer">
        <Reveal className="footer-cta">
          <div className="section-kicker">For the particular</div>
          <h2>
            Your next
            <br />
            <em>big move.</em>
          </h2>
          <Link className="pill-button pill-button-acid" to="/set-up-store">
            Claim your free store
          </Link>
        </Reveal>
        <div className="footer-bottom">
          <a className="wordmark" href="#top">
            <img className="wordmark-logo" src={logoO} alt="Oakmonte" />
            <span className="wordmark-word">akmonte</span>
          </a>
          <span>© 2026 Oakmonte Multi-Global LTD</span>
          <span>
            <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}

/* ---------------- Styles ----------------
   Scoped entirely under .oak-sellers (never :root or bare html/body) so this
   page's own color tokens can't leak into the app shell that persists across
   routes — see the same convention in routes/index.tsx. */
const CSS = `
.oak-sellers{
  --background:#fff;--foreground:#111827;--primary:#1455d9;--primary-foreground:#fff;
  --border:#d8dee8;--muted:#667085;--paper:#f3f6fa;--ink:#111827;--blue-soft:#eaf1ff;--grey:#eef1f5;
  /* The main landing page's blue (routes/index.tsx's --blue) -- used only for
     the big headline em text and the acid pill buttons, per Diadem's request
     to match the two pages' blues. Everything else (orbit lines, dots,
     eyebrow/kicker subtext, icons, the studio chart bars) stays on --primary
     above, deliberately untouched. */
  --accent-blue:#2151F5;
  /* Motion tokens (transitions.dev scale) -- named so every duration/easing
     choice below is traceable to a usage, not a random number. */
  --ease-out:cubic-bezier(.22,1,.36,1);
  --ease-in-out:cubic-bezier(.65,0,.35,1);
  --duration-quick:150ms;
  --duration-fast:250ms;
  --duration-slow:400ms;
  overflow:hidden;background:#fff;color:var(--foreground);font-family:'Manrope',sans-serif;
}
.oak-sellers *{box-sizing:border-box}
.oak-sellers a{color:inherit;text-decoration:none}
.oak-sellers button{font:inherit;color:inherit}
.oak-sellers .site-nav{height:76px;padding:0 4vw;position:fixed;top:0;left:0;z-index:60;width:100%;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(17,24,39,.14);background:rgba(255,255,255,.78);backdrop-filter:blur(16px)}
.oak-sellers .wordmark{display:flex;align-items:baseline;gap:0}
.oak-sellers .wordmark-logo{height:44px;width:auto;flex:none;display:inline-block;transform:translateY(4px)}
.oak-sellers .wordmark-word{display:inline-block;font-family:'Inter',ui-sans-serif,system-ui,sans-serif;font-weight:400;font-size:26px;letter-spacing:-.01em;line-height:1;color:var(--foreground);animation:oakSellersWordmarkReveal .8s .15s cubic-bezier(.2,.8,.2,1) both}
.oak-sellers .wordmark-tagline{margin-left:16px;font-size:9px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-blue);transform:translateY(-2px);white-space:nowrap}
/* The wordmark keeps its own tuned baseline position (untouched above) --
   these two are nudged down to meet it there, instead of moving the
   wordmark to meet them. */
.oak-sellers .nav-links{display:flex;gap:34px;margin-left:auto;margin-right:5vw;font:11px 'DM Mono',monospace;color:#667085;transform:translateY(19px)}
.oak-sellers .nav-links a{transition:color var(--duration-fast) var(--ease-out)}
.oak-sellers .nav-links a:hover,.oak-sellers .nav-login:hover{color:var(--primary)}

/* Buttons: instant press feedback (emil-design-eng) -- scale(.97) on
   :active, hover lift gated to real pointers so a tap on touch doesn't
   leave the button stuck "lifted" (Touch device hover states). */
.oak-sellers .nav-actions{display:flex;align-items:center;gap:44px;font-size:12px}
/* Desktop: the button's label sits on the same baseline as the links and Log in
   (they are all nudged down 19px to meet the wordmark). translate, not
   transform, so the hover lift above still composes with it. */
@media (min-width:801px){.oak-sellers .nav-actions .pill-button{padding:10px 20px;translate:0 7px}}
.oak-sellers .nav-login{display:inline-block;transform:translateY(7px)}
.oak-sellers .nav-menu-login{display:none}
.oak-sellers .pill-button{display:inline-flex;align-items:center;justify-content:center;gap:11px;border-radius:999px;padding:14px 20px;font-size:12px;font-weight:800;transition:transform var(--duration-fast) var(--ease-out),box-shadow var(--duration-fast) var(--ease-out),background var(--duration-fast) var(--ease-out);position:relative;overflow:hidden}
@media (hover:hover) and (pointer:fine){
  .oak-sellers .pill-button:hover{transform:translateY(-4px) scale(1.025);box-shadow:0 14px 28px rgba(20,85,217,.2)}
}
.oak-sellers .pill-button:active{transform:scale(.97);transition-duration:var(--duration-quick)}
.oak-sellers .pill-button-light{background:#111827;color:#fff}
.oak-sellers .pill-button-acid{background:var(--accent-blue);color:#fff}
.oak-sellers .pill-button-dark{background:#111827;color:#fff}
.oak-sellers .feature-more{margin-top:32px}
.oak-sellers .menu-button{display:none;background:none;border:0;cursor:pointer;padding:5px}

.oak-sellers .hero{min-height:max(750px,100vh);position:relative;display:flex;align-items:flex-end;padding:150px 7vw 4vw;overflow:hidden;background:linear-gradient(120deg,#fff 0%,#f4f7fb 52%,#eaf1ff 100%)}
.oak-sellers .hero-grid{position:absolute;inset:0;opacity:.5;background-image:linear-gradient(rgba(20,85,217,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(20,85,217,.08) 1px,transparent 1px);background-size:88px 88px;mask-image:linear-gradient(90deg,black,transparent 75%);animation:oakSellersGridPulse 8s ease-in-out infinite}
.oak-sellers .hero-orbit{position:absolute;border:1px solid rgba(20,85,217,.22);border-radius:50%;transform:rotate(-25deg);animation:oakSellersDrift 13s ease-in-out infinite alternate}
.oak-sellers .hero-orbit::after{content:'';position:absolute;width:10px;height:10px;border-radius:50%;background:var(--primary);right:12%;top:8%;box-shadow:0 0 0 8px rgba(20,85,217,.08),0 0 24px rgba(20,85,217,.4);animation:oakSellersPulseRing 3s ease-in-out infinite}
.oak-sellers .orbit-one{width:780px;height:430px;right:-80px;top:160px}
.oak-sellers .orbit-two{width:580px;height:260px;right:30px;top:245px;border-color:rgba(17,24,39,.13);animation-duration:17s;animation-direction:alternate-reverse}
.oak-sellers .hero-gap{display:block;height:14px}
.oak-sellers .hero-copy{position:relative;z-index:1;max-width:740px;animation:oakSellersRise 1s ease both}
.oak-sellers .section-kicker{color:var(--primary);text-transform:uppercase;letter-spacing:.06em;font:10px 'DM Mono',monospace}
.oak-sellers .studio-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--primary);margin-right:8px;box-shadow:0 0 14px rgba(20,85,217,.55);animation:oakSellersBlink 2s ease-in-out infinite}
.oak-sellers .hero h1{margin:26px 0 32px;font-size:clamp(72px,13vw,185px);line-height:.82;letter-spacing:-.1em;font-weight:600;animation:oakSellersHeadlineIn 1.15s .15s ease both}
.oak-sellers .hero h1 em,.oak-sellers .manifesto h2 em,.oak-sellers .feature-intro h2 em,.oak-sellers .studio-copy h2 em,.oak-sellers .manufacturer-section h2 em,.oak-sellers .free-panel h2 em,.oak-sellers .footer-cta h2 em{font-family:Georgia,serif;font-weight:400;color:var(--accent-blue)}
.oak-sellers .hero-copy p{max-width:440px;color:#475467;line-height:1.55;font-size:16px;animation:oakSellersRise .9s .35s ease both}
.oak-sellers .hero-buttons{display:flex;align-items:center;gap:27px;margin-top:32px;animation:oakSellersRise .9s .5s ease both}
/* The hero's one real call to action: larger than the header and section pills. */
.oak-sellers .hero-buttons .pill-button{padding:19px 32px;font-size:15px;gap:12px;min-height:58px}
.oak-sellers .text-link{display:inline-flex;align-items:center;gap:8px;font:11px 'DM Mono',monospace;transition:color var(--duration-fast) var(--ease-out)}
.oak-sellers .hero-link{color:#344054}
.oak-sellers .hero-side-note{position:absolute;right:7vw;top:112px;z-index:1;display:flex;flex-direction:column;gap:16px;color:#667085;font:10px 'DM Mono',monospace}
.oak-sellers .hero-side-note strong{color:#111827;font:600 24px/1.2 Georgia,serif;letter-spacing:-.05em}

.oak-sellers .ticker-section{display:flex;align-items:center;gap:40px;padding:20px 0;overflow:hidden;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.oak-sellers .ticker-label{flex:0 0 auto;padding-left:4vw;color:var(--muted);text-transform:uppercase;font:10px 'DM Mono',monospace}
.oak-sellers .marquee{overflow:hidden;flex:1}
.oak-sellers .marquee-track{display:flex;gap:65px;width:max-content;color:#344054;font-size:17px;font-weight:700;animation:oakSellersMarquee 28s linear infinite}
.oak-sellers .marquee-track span:nth-child(3n){font:italic 20px Georgia,serif;color:var(--primary)}

/* Scroll reveal -- same convention as routes/index.tsx's .reveal/.reveal-delay-N. */
.oak-sellers .reveal{opacity:0;transform:translateY(24px);transition:opacity var(--duration-slow) var(--ease-in-out),transform var(--duration-slow) var(--ease-in-out)}
.oak-sellers .reveal.in-view{opacity:1;transform:translateY(0)}
.oak-sellers .reveal-delay-1.in-view{transition-delay:.08s}
.oak-sellers .reveal-delay-2.in-view{transition-delay:.16s}
.oak-sellers .reveal-delay-3.in-view{transition-delay:.24s}

.oak-sellers .manifesto{position:relative;padding:155px 7vw 170px;background:var(--ink);color:#fff}
.oak-sellers .manifesto .section-kicker{color:#7ba2ff}
.oak-sellers .manifesto h2{margin:28px 0;font-size:clamp(56px,9vw,126px);line-height:.88;letter-spacing:-.1em;font-weight:600}
.oak-sellers .manifesto p{max-width:430px;margin-left:40%;color:#c4cad5;line-height:1.6}
.oak-sellers .manifesto .manifesto-typed{margin-top:110px}
.oak-sellers .typed{position:relative}
.oak-sellers .typed-ghost{visibility:hidden}
.oak-sellers .typed-live{position:absolute;inset:0}
.oak-sellers .typed-caret{display:inline-block;width:2px;height:1.05em;margin-left:2px;vertical-align:-.15em;background:#7ba2ff;animation:oakSellersBlink 1s steps(1) infinite}
.oak-sellers .manifesto-sign{margin-top:120px;color:#7ba2ff;font:12px/1.3 'DM Mono',monospace}
.oak-sellers .manifesto-sign span{font-size:9px;color:#98a2b3}

.oak-sellers .steps-section{padding:90px 7vw;border-bottom:1px solid var(--border)}
.oak-sellers .steps-list{max-width:640px;margin:0 auto;border-top:1px solid var(--border)}
.oak-sellers .steps-list div{display:flex;gap:20px;align-items:center;padding:22px 0;border-bottom:1px solid var(--border)}
.oak-sellers .steps-list span{color:var(--primary);font:11px 'DM Mono',monospace}
.oak-sellers .steps-list strong{font-size:20px;letter-spacing:-.05em;font-weight:600}

.oak-sellers .features-section{display:grid;grid-template-columns:.9fr 1.1fr;gap:9vw;padding:130px 7vw}
.oak-sellers .feature-intro h2,.oak-sellers .studio-copy h2,.oak-sellers .manufacturer-section h2,.oak-sellers .free-panel h2{margin:27px 0;font-size:clamp(49px,7vw,95px);line-height:.9;letter-spacing:-.09em;font-weight:600}
.oak-sellers .feature-intro p,.oak-sellers .studio-copy p,.oak-sellers .manufacturer-section p,.oak-sellers .free-panel p{max-width:360px;color:var(--muted);line-height:1.6;font-size:14px}
.oak-sellers .feature-list{border-top:1px solid var(--border)}
.oak-sellers .feature-row{border-bottom:1px solid var(--border)}
.oak-sellers .feature-trigger{width:100%;display:flex;align-items:center;gap:20px;text-align:left;padding:28px 0;border:0;background:none;cursor:pointer;transition:padding var(--duration-fast) var(--ease-out),background var(--duration-fast) var(--ease-out)}
@media (hover:hover) and (pointer:fine){
  .oak-sellers .feature-trigger:hover{padding-left:12px;background:var(--blue-soft)}
}
.oak-sellers .feature-number{color:var(--primary);font:11px 'DM Mono',monospace}
.oak-sellers .feature-title{flex:1;font-size:clamp(22px,3vw,36px);letter-spacing:-.07em;font-weight:600}
.oak-sellers .feature-chevron{color:var(--muted);flex:none;transition:transform var(--duration-fast) var(--ease-out),color var(--duration-fast) var(--ease-out)}
.oak-sellers .feature-row.is-open .feature-chevron{transform:rotate(180deg);color:var(--accent-blue)}
/* Accordion via grid-template-rows, not conditional mount -- animates open
   AND closed, and replaying never restarts from a mount pop (transitions-dev
   accordion pattern). Padding lives on the inner wrapper, never the track,
   or a 0fr row never fully collapses. */
.oak-sellers .feature-panel{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--duration-slow) var(--ease-in-out)}
.oak-sellers .feature-row.is-open .feature-panel{grid-template-rows:1fr}
.oak-sellers .feature-panel-inner{overflow:hidden}
.oak-sellers .feature-panel-inner p{max-width:440px;margin:0;padding:0 32px 24px 72px;color:var(--muted);font-size:13px;line-height:1.6}

.oak-sellers .studio-section{display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:9vw;padding:120px 7vw;background:var(--paper)}
.oak-sellers .iph-fit{justify-self:center;align-self:center;flex:none}
.oak-sellers .iph{padding:5px;border-radius:52px;transform-origin:top left;background:#1b1d22;box-shadow:inset 0 0 0 1.5px #3a3d44,0 30px 80px rgba(20,85,217,.16);box-sizing:border-box}
.oak-sellers .iph-screen{position:relative;display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;border-radius:47px;background:#fff;font-family:Inter,system-ui,sans-serif;color:#111827}
.oak-sellers .iph-status{position:relative;display:flex;align-items:center;justify-content:space-between;height:50px;flex:none;padding:4px 26px 0 34px}
.oak-sellers .iph-time{font-size:15px;font-weight:600;letter-spacing:-.01em}
.oak-sellers .iph-island{position:absolute;left:50%;top:11px;width:98px;height:29px;margin-left:-49px;border-radius:999px;background:#000}
.oak-sellers .iph-icons{display:flex;align-items:center;gap:5px;fill:#111827;stroke:#111827}
.oak-sellers .iph-icons svg:first-child,.oak-sellers .iph-icons svg:nth-child(2){stroke:none}
.oak-sellers .iph-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;padding:10px 18px 30px;overflow:hidden}
.oak-sellers .iph-home{position:absolute;left:50%;bottom:8px;width:116px;height:5px;margin-left:-58px;border-radius:999px;background:#111827}
.oak-sellers .sp-id{display:flex;align-items:center;gap:12px}
.oak-sellers .sp-id b{display:block;font-size:17px;font-weight:700;letter-spacing:-.02em}
.oak-sellers .sp-id small{display:block;margin-top:2px;font-size:12px;color:#667085}
.oak-sellers .sp-logo{display:grid;place-items:center;width:48px;height:48px;border-radius:999px;background:#eaf1ff;color:var(--accent-blue);font:400 22px Georgia,serif}
.oak-sellers .sp-pills{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.oak-sellers .sp-pills span{display:grid;place-items:center;height:38px;border:1px solid #d0d5dd;border-radius:999px;font-size:12px;font-weight:600}
.oak-sellers .sp-title{margin-top:4px;font-size:14px;font-weight:600;letter-spacing:-.02em}
.oak-sellers .sp-chart{border:1px solid #eaecf0;border-radius:20px;padding:14px 14px 0}
.oak-sellers .sp-chart small{font-size:11px;color:#667085}
.oak-sellers .sp-chart strong{display:block;margin-top:4px;font-size:24px;font-weight:700;letter-spacing:-.03em}
.oak-sellers .sp-chart .chart{height:64px;margin:12px 0 0;gap:6px;border-bottom:0}
.oak-sellers .sp-tiles{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.oak-sellers .sp-tiles div{border:1px solid #eaecf0;border-radius:18px;padding:12px}
.oak-sellers .sp-tiles small{display:block;font-size:11px;font-weight:500;color:#667085}
.oak-sellers .sp-tiles b{display:block;margin-top:6px;font-size:18px;font-weight:700;letter-spacing:-.02em}
.oak-sellers .sp-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.oak-sellers .sp-actions span{display:grid;place-items:center;min-height:52px;padding:6px;border:1px solid #eaecf0;border-radius:16px;font-size:10.5px;font-weight:600;text-align:center;line-height:1.25}
.oak-sellers .dd-in{opacity:0;transform:translateY(12px);transition:opacity 450ms var(--ease-out),transform 450ms var(--ease-out)}
.oak-sellers .dd-in.is-on{opacity:1;transform:none}
.oak-sellers .dd-bars i{animation:none;transform:scaleY(0);transition:transform 600ms var(--ease-out)}
.oak-sellers .dd-bars.is-on i{transform:scaleY(1)}
.oak-sellers .sp-actions span{transition:transform 160ms var(--ease-out),background 200ms ease,color 200ms ease,border-color 200ms ease}
.oak-sellers .sp-actions .dd-tap{border-color:var(--accent-blue);animation:oakSellersDemoTap 700ms var(--ease-out)}
@keyframes oakSellersDemoTap{0%{transform:scale(1)}30%{transform:scale(.92);box-shadow:0 0 0 0 rgba(31,79,255,.45)}100%{transform:scale(1);box-shadow:0 0 0 14px rgba(31,79,255,0)}}
.oak-sellers .demo-flip{grid-template-columns:.9fr 1.1fr;background:#fff}
.oak-sellers .dl-order{display:flex;align-items:center;gap:10px;border:1px solid #eaecf0;border-radius:18px;padding:12px}
.oak-sellers .dl-thumb{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:12px;background:#eaf1ff;color:var(--accent-blue)}
.oak-sellers .dl-order-text{min-width:0;flex:1}
.oak-sellers .dl-order-text small{display:block;font-size:10.5px;font-weight:600;color:#12b76a}
.oak-sellers .dl-order-text b{display:block;margin-top:2px;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oak-sellers .dl-order-text span{display:block;font-size:11px;color:#667085}
.oak-sellers .dl-order strong{font-size:13px;font-weight:700}
.oak-sellers .dl-book{display:flex;align-items:center;justify-content:center;gap:7px;height:40px;border-radius:999px;background:#111827;color:#fff;font-size:12.5px;font-weight:600;transition:background 250ms ease,color 250ms ease}
.oak-sellers .dl-book.is-done{background:#ecfdf3;color:#067647}
.oak-sellers .dl-book.dd-tap{animation:oakSellersDemoTap 700ms var(--ease-out)}
.oak-sellers .dl-map{position:relative;height:120px;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#f2f6ff,#eef2f6);background-image:linear-gradient(#e4e9f2 1px,transparent 1px),linear-gradient(90deg,#e4e9f2 1px,transparent 1px);background-size:22px 22px}
.oak-sellers .dl-map svg{position:absolute;inset:0;width:100%;height:100%}
.oak-sellers .dl-route{fill:none;stroke:var(--accent-blue);stroke-width:3;stroke-linecap:round;stroke-dasharray:400;stroke-dashoffset:400;transition:stroke-dashoffset 1100ms var(--ease-out)}
.oak-sellers .dl-route.is-on{stroke-dashoffset:0}
.oak-sellers .dl-rider{fill:#111827;stroke:#fff;stroke-width:3}
.oak-sellers .dl-pin{position:absolute;display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(17,24,39,.15);color:var(--accent-blue)}
.oak-sellers .dl-pin-a{left:calc(24 / 280 * 100% - 12px);top:calc(92 / 120 * 100% - 12px)}
.oak-sellers .dl-pin-b{left:calc(256 / 280 * 100% - 12px);top:calc(24 / 120 * 100% - 12px);color:#12b76a}
.oak-sellers .dl-steps{display:flex;flex-direction:column;gap:10px;padding:2px 4px}
.oak-sellers .dl-step{display:flex;align-items:flex-start;gap:10px}
.oak-sellers .dl-step b{display:block;font-size:12.5px;font-weight:600}
.oak-sellers .dl-step small{display:block;font-size:11px;color:#667085}
.oak-sellers .dl-dot{display:grid;place-items:center;width:18px;height:18px;flex:none;margin-top:1px;border-radius:999px;background:var(--accent-blue);color:#fff}
.oak-sellers .dl-dot.is-done{background:#12b76a}
.oak-sellers .dl-paid{display:flex;align-items:center;gap:10px;border-radius:18px;background:#ecfdf3;padding:12px}
.oak-sellers .dl-paid-icon{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:999px;background:#12b76a;color:#fff}
.oak-sellers .dl-paid b{display:block;font-size:13px;font-weight:700;color:#054f31}
.oak-sellers .dl-paid small{display:block;font-size:11px;color:#067647}
.oak-sellers .ms-head{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid #eaecf0}
.oak-sellers .ms-head b{display:block;font-size:14px;font-weight:600}
.oak-sellers .ms-head small{display:block;font-size:11px;color:#12b76a}
.oak-sellers .ms-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:#fde7d4;color:#b54708;font-weight:700;font-size:14px}
.oak-sellers .ms-thread{flex:1;display:flex;flex-direction:column;gap:9px}
.oak-sellers .ms-row{display:flex}
.oak-sellers .ms-me{justify-content:flex-end}
.oak-sellers .ms-bubble{max-width:78%;margin:0;padding:9px 13px;border-radius:18px;font-size:13px;line-height:1.35}
.oak-sellers .ms-them .ms-bubble{background:#f2f4f7;color:#111827;border-bottom-left-radius:6px}
.oak-sellers .ms-me .ms-bubble{background:var(--accent-blue);color:#fff;border-bottom-right-radius:6px}
.oak-sellers .ms-typing{display:flex;gap:4px;padding:12px 14px}
.oak-sellers .ms-typing i{width:6px;height:6px;border-radius:999px;background:rgba(255,255,255,.85);animation:oakSellersBlink 1s ease-in-out infinite}
.oak-sellers .ms-typing i:nth-child(2){animation-delay:.15s}
.oak-sellers .ms-typing i:nth-child(3){animation-delay:.3s}
.oak-sellers .ms-card{display:flex;align-items:center;gap:10px;width:78%;padding:9px;border:1px solid #eaecf0;border-radius:16px;background:#fff}
.oak-sellers .ms-card b{display:block;font-size:12.5px;font-weight:600}
.oak-sellers .ms-card small{display:block;font-size:11px;color:#667085}
.oak-sellers .ms-card-img{display:grid;place-items:center;width:38px;height:38px;flex:none;border-radius:10px;background:#eaf1ff;color:var(--accent-blue)}
.oak-sellers .ms-card-buy{width:86%}
.oak-sellers .ms-buy{margin-left:auto;padding:6px 12px;border-radius:999px;background:#111827;color:#fff;font-size:11.5px;font-weight:600}
.oak-sellers .ms-ticks{align-self:flex-end;font-size:10.5px;color:#98a2b3;transition:color 300ms ease}
.oak-sellers .ms-ticks.is-read{color:var(--accent-blue)}
.oak-sellers .ms-order{align-self:center;margin-top:6px;padding:7px 12px;border-radius:999px;background:#ecfdf3;color:#067647;font-size:11.5px;font-weight:600}
.oak-sellers .ms-input{display:flex;align-items:center;height:40px;padding:0 14px;border-radius:999px;background:#f2f4f7;font-size:13px;color:#98a2b3}
.oak-sellers .studio-card{border:1px solid #b7c9ed;background:#fff;box-shadow:0 30px 90px rgba(20,85,217,.12);animation:oakSellersFloatCard 5s ease-in-out infinite}
.oak-sellers .studio-top{display:flex;align-items:center;padding:18px 22px;border-bottom:1px solid var(--border);font:11px 'DM Mono',monospace}
.oak-sellers .studio-status{margin-left:auto;color:var(--primary);font-size:9px}
.oak-sellers .studio-window{display:grid;grid-template-columns:115px 1fr;min-height:360px}
.oak-sellers .window-nav{display:flex;flex-direction:column;gap:23px;padding:28px 17px;border-right:1px solid var(--border);color:var(--muted);font:10px 'DM Mono',monospace}
.oak-sellers .window-nav span:first-child{color:var(--primary)}
.oak-sellers .window-main{padding:35px 28px}
.oak-sellers .window-main small,.oak-sellers .window-main>div:first-child span{display:block;color:var(--muted);font:9px 'DM Mono',monospace}
.oak-sellers .window-main strong{display:block;margin:14px 0 5px;font-size:52px;letter-spacing:-.09em}
.oak-sellers .window-main .up{color:var(--primary)}
.oak-sellers .chart{height:100px;display:flex;align-items:end;gap:9px;margin:32px 0 26px;border-bottom:1px solid var(--border)}
.oak-sellers .chart i{display:block;flex:1;background:var(--primary);opacity:.75;transform-origin:bottom;animation:oakSellersBars 2.5s ease-in-out infinite alternate}
.oak-sellers .chart i:nth-child(1){height:30%}
.oak-sellers .chart i:nth-child(2){height:45%;animation-delay:.1s}
.oak-sellers .chart i:nth-child(3){height:35%;animation-delay:.2s}
.oak-sellers .chart i:nth-child(4){height:58%;animation-delay:.3s}
.oak-sellers .chart i:nth-child(5){height:49%;animation-delay:.4s}
.oak-sellers .chart i:nth-child(6){height:74%;animation-delay:.5s}
.oak-sellers .chart i:nth-child(7){height:61%;animation-delay:.6s}
.oak-sellers .chart i:nth-child(8){height:80%;animation-delay:.7s}
.oak-sellers .chart i:nth-child(9){height:72%;animation-delay:.8s}
.oak-sellers .chart i:nth-child(10){height:95%;animation-delay:.9s}
.oak-sellers .window-rows{display:grid;gap:11px;color:var(--muted);font:10px 'DM Mono',monospace}
.oak-sellers .window-rows span{display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:8px}
.oak-sellers .window-rows b{color:var(--foreground);font-weight:400}

.oak-sellers .manufacturer-section{display:grid;grid-template-columns:1fr 1fr;gap:10vw;align-items:center;padding:130px 7vw;background:var(--primary);color:#fff}
.oak-sellers .manufacturer-section .section-kicker{color:#dbe7ff}
.oak-sellers .manufacturer-section h2{margin-bottom:30px}
.oak-sellers .manufacturer-section h2 em{color:#fff}
.oak-sellers .manufacturer-section p{color:#e2eaff;margin-bottom:31px}
.oak-sellers .manufacturer-list{border-top:1px solid rgba(255,255,255,.35)}
.oak-sellers .manufacturer-list div{display:flex;gap:20px;align-items:center;padding:22px 0;border-bottom:1px solid rgba(255,255,255,.35)}
.oak-sellers .manufacturer-list span{color:#dbe7ff;font:11px 'DM Mono',monospace}
.oak-sellers .manufacturer-list strong{font-size:20px;letter-spacing:-.05em}

.oak-sellers .stats-section{padding:90px 7vw;border-bottom:1px solid var(--border)}
.oak-sellers .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:45px}
.oak-sellers .stats-grid .reveal{display:flex;flex-direction:column;gap:7px}
.oak-sellers .stats-grid strong{font-size:clamp(35px,5vw,66px);letter-spacing:-.1em}
.oak-sellers .stats-grid span{color:var(--muted);text-transform:uppercase;font:10px 'DM Mono',monospace}

/* One honest panel instead of three "plan" cards that all said FREE with
   nothing to actually compare (same CTA, same destination each). */
.oak-sellers .plans-section{padding:125px 7vw;background:var(--paper);color:var(--ink)}
.oak-sellers .free-panel{max-width:820px;margin:0 auto;padding:56px;background:#fff;border:1px solid var(--border);border-radius:4px;text-align:center}
.oak-sellers .free-panel .section-kicker{color:var(--primary);display:block}
.oak-sellers .free-panel p{max-width:520px;margin-left:auto;margin-right:auto}
.oak-sellers .free-list{display:grid;grid-template-columns:1fr 1fr;gap:14px 32px;list-style:none;padding:0;margin:40px 0 44px;text-align:left;color:#344054;font-size:14px}
.oak-sellers .free-list li{display:flex;align-items:flex-start;gap:9px;line-height:1.4}
.oak-sellers .free-list li svg{flex:none;margin-top:3px;color:var(--primary)}

.oak-sellers .site-footer{padding:130px 7vw 25px}
.oak-sellers .footer-cta{min-height:445px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.oak-sellers .footer-cta h2{margin:27px 0 45px;font-size:clamp(70px,10vw,145px);line-height:.83;letter-spacing:-.1em}
.oak-sellers .footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:20px;border-top:1px solid var(--border);color:#798078;font:10px 'DM Mono',monospace}
.oak-sellers .footer-bottom .wordmark{color:var(--foreground)}
.oak-sellers .footer-bottom a{transition:color var(--duration-fast) var(--ease-out)}
.oak-sellers .footer-bottom a:hover{color:var(--primary)}

@keyframes oakSellersMarquee{to{transform:translateX(-50%)}}
@keyframes oakSellersWordmarkReveal{from{opacity:0;transform:translateX(-10px);letter-spacing:.08em}to{opacity:1;transform:translateX(0);letter-spacing:-.08em}}
@keyframes oakSellersShimmer{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
@keyframes oakSellersPulseRing{0%,100%{opacity:.25;transform:scale(.96)}50%{opacity:.65;transform:scale(1.04)}}
@keyframes oakSellersRise{from{opacity:0;transform:translateY(25px)}to{opacity:1;transform:translateY(0)}}
@keyframes oakSellersHeadlineIn{from{opacity:0;transform:translateY(40px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes oakSellersDrift{from{transform:rotate(-25deg) translate(0)}to{transform:rotate(-18deg) translate(-35px,20px)}}
@keyframes oakSellersGridPulse{50%{opacity:.2;transform:scale(1.04)}}
@keyframes oakSellersBlink{50%{opacity:.35;transform:scale(.7)}}
@keyframes oakSellersFloatCard{50%{transform:translateY(-7px)}}
@keyframes oakSellersBars{to{transform:scaleY(.82)}}

@media (max-width:800px){
  .oak-sellers .site-nav{padding:0 5vw}
  .oak-sellers .wordmark-tagline{display:none}
  .oak-sellers .nav-links{display:none;position:absolute;left:0;right:0;top:76px;padding:25px 5vw;margin:0;flex-direction:column;gap:22px;background:#fff}
  .oak-sellers .nav-links.is-open{display:flex}
  .oak-sellers .nav-menu-login{display:block}
  .oak-sellers .nav-login{display:none}
  .oak-sellers .menu-button{display:block}
  .oak-sellers .hero{min-height:max(720px,100vh);padding:130px 7vw 30px}
  .oak-sellers .hero-copy p{font-size:14px}
  .oak-sellers .hero h1{font-size:clamp(58px,18vw,125px)}
  .oak-sellers .hero-side-note{right:7vw;top:145px;bottom:auto}
  .oak-sellers .ticker-section{gap:20px}
  .oak-sellers .ticker-label{padding-left:5vw}
  .oak-sellers .manifesto{padding:100px 7vw}
  .oak-sellers .manifesto p{margin-left:0}
  .oak-sellers .manifesto .manifesto-typed{margin-top:70px}
  .oak-sellers .manifesto-sign{margin-top:70px}
  .oak-sellers .steps-section{padding:70px 7vw}
  .oak-sellers .features-section,.oak-sellers .studio-section,.oak-sellers .manufacturer-section{display:flex;flex-direction:column;gap:55px;padding:85px 7vw}
  .oak-sellers .studio-window{min-height:320px}
  .oak-sellers .window-nav{width:88px;font-size:9px}
  .oak-sellers .window-main strong{font-size:38px}
  .oak-sellers .stats-section{padding:75px 7vw}
  .oak-sellers .stats-grid{grid-template-columns:repeat(2,1fr);row-gap:35px}
  .oak-sellers .plans-section{padding:85px 7vw}
  .oak-sellers .free-panel{padding:36px 22px}
  .oak-sellers .free-list{grid-template-columns:1fr}
  .oak-sellers .footer-bottom{flex-wrap:wrap;gap:17px}
  .oak-sellers .footer-bottom span:last-child{width:100%}
}

/* Phones: the logo, "Start selling" and the menu button share one 76px bar.
   Tighten the gap between them and let the logo and button give way as the
   screen narrows, so nothing ever touches. */
@media (max-width:520px){
  .oak-sellers .nav-actions{gap:8px}
  .oak-sellers .nav-actions .pill-button{padding:9px 14px;gap:6px;font-size:11px;white-space:nowrap}
  .oak-sellers .wordmark{min-width:0}
}
@media (max-width:400px){
  .oak-sellers .site-nav{padding:0 4vw}
  .oak-sellers .wordmark-logo{height:36px;transform:translateY(3px)}
  .oak-sellers .wordmark-word{font-size:21px}
  .oak-sellers .nav-actions{gap:4px}
  .oak-sellers .nav-actions .pill-button{padding:8px 11px}
  .oak-sellers .nav-actions .pill-button svg{display:none}
  /* Display headlines have a 49-70px floor that a 320px screen cannot hold
     a long word at. Let them scale down with the screen instead. */
  .oak-sellers .hero h1{font-size:clamp(40px,15.5vw,125px)}
  .oak-sellers .manifesto h2{font-size:clamp(38px,13vw,126px)}
  .oak-sellers .feature-intro h2,.oak-sellers .studio-copy h2,.oak-sellers .manufacturer-section h2,.oak-sellers .free-panel h2{font-size:clamp(38px,12vw,95px)}
  .oak-sellers .footer-cta h2{font-size:clamp(44px,15vw,145px)}
  .oak-sellers .feature-panel-inner p{padding:0 8px 22px 40px}
  .oak-sellers .studio-window{grid-template-columns:72px 1fr}
  .oak-sellers .window-nav{width:72px;padding:24px 10px}
  .oak-sellers .window-main{padding:26px 16px}
}
@media (max-width:340px){
  .oak-sellers .wordmark-logo{height:30px}
  .oak-sellers .wordmark-word{font-size:18px}
  .oak-sellers .nav-actions .pill-button{padding:7px 9px;font-size:10px}
}

@media (prefers-reduced-motion:reduce){
  .oak-sellers .marquee-track,.oak-sellers .hero-orbit,.oak-sellers .hero-grid,.oak-sellers .studio-card,.oak-sellers .chart i,.oak-sellers .wordmark-word,.oak-sellers .pill-button::after,.oak-sellers .hero-orbit::after{animation:none}
  .oak-sellers .hero-copy,.oak-sellers .hero h1,.oak-sellers .hero-copy p,.oak-sellers .hero-buttons{animation:none}
  .oak-sellers .pill-button,.oak-sellers .feature-trigger,.oak-sellers .feature-panel,.oak-sellers .feature-chevron{transition:none}
  .oak-sellers .reveal{transition:opacity var(--duration-slow) linear;transform:none}
}
`;
