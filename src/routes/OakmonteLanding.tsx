import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import logoAsset from "@/assets/oakmonte-o-mark.png.asset.json";
import logoO from "@/assets/logo-o.png";
import heroAsset from "@/assets/hero-editorial.jpg.asset.json";
import fabricAsset from "@/assets/fabric-detail.jpg.asset.json";

export const Route = createFileRoute("/OakmonteLanding")({
  head: () => ({
    meta: [
      { title: "Oakmonte — Sell, Share & Shop Fashion Safely" },
      {
        name: "description",
        content:
          "Oakmonte is fashion commerce rebuilt: escrow-protected payments, paid creators and size-matched pieces for curators.",
      },
      { property: "og:title", content: "Oakmonte — Sell, Share & Shop Fashion Safely" },
      {
        property: "og:description",
        content:
          "Escrow-protected payments, paid creators and size-matched pieces — fashion commerce done right.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  component: OakmonteLanding,
});

/* ---------------- Images ---------------- */
const IMG_LOGO = logoAsset.url;
const IMG_HERO = heroAsset.url;
const IMG_STORY = fabricAsset.url;
const IMG_SCALE = heroAsset.url;

/* ---------------- Data ---------------- */
const FEATURES = [
  { title: "Sellers", points: ["Logistics handled", "Wider customer base", "Custom stores"] },
  {
    title: "Creators",
    points: ["Get paid for what you drive", "Real collaboration tools", "Greater visibility"],
  },
  {
    title: "Curators",
    points: ["Pieces that actually fit", "Track every delivery", "Share inspiration that matters"],
  },
];

const RESULTS = [
  { value: 0, suffix: "", label: "Payments released before delivery confirmed" },
  { value: 100, suffix: "%", label: "Disputes routed through review" },
  { value: 3, suffix: "", label: "Roles served on one platform" },
  { value: 1, suffix: "", label: "Size chart, shared across every piece" },
];

const QUOTES = [
  {
    text: "Finally get paid without chasing invoices or hoping the buyer follows through.",
    who: "David — Seller (sample)",
  },
  {
    text: "I share pieces I actually believe in — and I get credit for every sale it drives.",
    who: "Jamal — Creator (sample)",
  },
  {
    text: "The size chart alone saved me two returns in my first week.",
    who: "Nathan — Curator (sample)",
  },
];

const FAQS = [
  {
    q: "Is my payment actually safe?",
    a: "Yes. Money sits in escrow until the customer confirms they're satisfied — sellers never get paid before that happens.",
  },
  {
    q: "How do creators get paid?",
    a: "Creators earn a share of the sales they drive through their shared links, tracked automatically through the platform.",
  },
  {
    q: "What if an item doesn't fit?",
    a: "Every piece is checked against our shared size chart before listing, and if something's still off, it goes through our dispute pipeline instead of becoming your problem.",
  },
  {
    q: "Do I need to be a business to sell?",
    a: "No. Whether you're clearing out your closet or running a full storefront, Oakmonte scales with you.",
  },
  {
    q: "Is there a fee to join?",
    a: "Creating an account is free. Selling fees are laid out clearly before you list — no surprise deductions.",
  },
];

/* ---------------- Hooks ---------------- */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.unobserve(e.target);
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

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          if (value === 0) return;
          let current = 0;
          const step = Math.max(1, Math.ceil(value / 30));
          const timer = setInterval(() => {
            current += step;
            if (current >= value) {
              current = value;
              clearInterval(timer);
            }
            setDisplay(current);
          }, 30);
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return (
    <b ref={ref as React.RefObject<HTMLElement>}>
      {display}
      {suffix}
    </b>
  );
}

/* ---------------- Page ---------------- */
function OakmonteLanding() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [authMenu, setAuthMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState("PRODUCT");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setActiveNav(window.scrollY > window.innerHeight * 0.6 ? "STORY" : "PRODUCT");
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const Auth = () =>
    signedIn ? (
      <div className="auth-wrap">
        <button
          className="cta-btn ghost small"
          onClick={() => setAuthMenu((v) => !v)}
          type="button"
        >
          MOCKUSER
        </button>
        <div className={`auth-menu${authMenu ? " open" : ""}`}>
          <a href="#product">View profile</a>
          <button
            type="button"
            onClick={() => {
              setSignedIn(false);
              setAuthMenu(false);
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    ) : (
      <button className="cta-btn ghost small" type="button" onClick={() => setSignedIn(true)}>
        Sign in
      </button>
    );

  return (
    <div className="oak">
      <style>{CSS}</style>

      <header id="site-header" style={{ boxShadow: scrolled ? "0 1px 0 rgba(0,0,0,.06)" : "none" }}>
        <div className="wrap">
          <div className="header-row">
            <a href="#product" className="brand">
              <img src={logoO} alt="Oakmonte" className="brand-o" />
              <span className="word">akmonte</span>
              <span className="tagline">CREATED TO CREATE.</span>
            </a>
            <nav className="desktop-nav">
              <a href="#product" className={activeNav === "PRODUCT" ? "active" : ""}>
                Product
              </a>
              <a href="#story" className={activeNav === "STORY" ? "active" : ""}>
                Story
              </a>
              <a href="#solutions">Solutions</a>
              <a href="#faq">FAQ</a>
            </nav>
            <div className="desktop-auth">
              <Auth />
            </div>
            <button
              className="mobile-toggle"
              aria-label="Toggle navigation"
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
        <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
          <div className="mobile-menu-inner">
            <a href="#product">Product</a>
            <a href="#story">Story</a>
            <a href="#solutions">Solutions</a>
            <a href="#faq">FAQ</a>
            <div className="mobile-auth">
              <Auth />
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="hero-glow" />
          <div className="wrap">
            <p className="eyebrow">Fashion commerce, rebuilt</p>

            <h1 className="headline">
              <span className="line">
                <span>Sell your style.</span>
              </span>
              <span className="line">
                <span>Share your style.</span>
              </span>
              <span className="line">
                <span>Never get burned.</span>
              </span>
            </h1>

            <p className="hero-sub">
              Fashion resale is broken. Sellers eat chargebacks. Creators do the promo work for
              free. Shoppers hand strangers money and hope.{" "}
              <b>
                Oakmonte fixes all three — one platform, one payment system, nobody left holding the
                bag.
              </b>
            </p>

            <div className="hero-cta-stack">
              <Link to="/set-up-store" className="hero-cta-card card-blue">
                <span className="cta-label">Set Up A Store</span>
                <span className="cta-hint">Open your storefront and start selling.</span>
              </Link>
              <Link to="/become-a-creator" className="hero-cta-card card-outline">
                <span className="cta-label">Become A Creator</span>
                <span className="cta-hint">Get paid for the content you create.</span>
              </Link>
              <Link to="/become-a-curator" className="hero-cta-card card-tint">
                <span className="cta-label">Define Your Wardrobe</span>
                <span className="cta-hint">Discover pieces matched to your size.</span>
              </Link>
            </div>

            <p className="trust-line">
              <span className="stars">★★★★★</span>
              *No catches, no fine print — just fashion commerce done right.{" "}
              <b>Loved by our early community.</b>
            </p>

            <div className="hero-media">
              <img
                src={IMG_HERO}
                alt="Models wearing curated fashion pieces"
                width={1920}
                height={848}
              />
              <span className="media-cap">Sell · Share · Shop — all in one place</span>
            </div>
          </div>

          <div className="trust-marquee">
            <div className="track">
              {Array.from({ length: 6 }).flatMap((_, i) =>
                ["ESCROW PROTECTED", "CREATOR VERIFIED", "SIZE-MATCHED", "DISPUTE COVERED"].map(
                  (t) => (
                    <span key={`${i}-${t}`}>
                      <b>·</b> {t}
                    </span>
                  ),
                ),
              )}
            </div>
          </div>
        </section>

        {/* STORY */}
        <section id="story" className="story">
          <div className="wrap">
            <Reveal className="story-head">
              <p className="eyebrow">Why we built this</p>
              <h2>Fashion commerce shouldn't feel like a gamble.</h2>
            </Reveal>

            <div className="story-body">
              <div className="story-copy">
                <Reveal as="p" className="punch">
                  Here's the truth.
                </Reveal>
                <Reveal as="p">
                  Buying and selling fashion online is still built on trust you can't verify.
                </Reveal>
                <Reveal as="p" delay={1}>
                  A seller lists a piece. A creator shares it with their audience. A shopper sends
                  payment and waits. And somewhere in that chain, things go wrong — the item never
                  ships, the size is wrong, or the "creator collab" was never really a partnership
                  at all.
                </Reveal>
                <Reveal as="p" delay={1} className="punch">
                  We didn't think that was good enough.
                </Reveal>
                <Reveal as="p" delay={2}>
                  So we built Oakmonte around one simple rule:{" "}
                  <b>no payment reaches a seller until the customer is satisfied.</b> Every piece
                  goes through a dispute pipeline before money moves. Every creator gets paid for
                  the sales they actually drive. Every curator gets pieces that actually fit,
                  because we built a real recommendation system instead of a guessing game.
                </Reveal>
                <Reveal as="p" delay={3}>
                  It's not flashy. It's just fair — and it's the platform we wished existed when we
                  started.
                </Reveal>
              </div>

              <Reveal delay={2} className="story-media">
                <img
                  src={IMG_STORY}
                  alt="Editorial fashion portrait"
                  loading="lazy"
                  width={912}
                  height={1200}
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* OFFERING */}
        <section className="offering">
          <div className="wrap">
            <Reveal className="offering-head">
              <h2>Pick your path.</h2>
              <p>Whichever side of the closet you're on, Oakmonte has a place for you.</p>
            </Reveal>
            <div className="offering-grid">
              <Reveal className="offer-card blue">
                <span className="tag">For sellers &amp; creators</span>
                <h3>Sell With Oakmonte</h3>
                <p>
                  Open a store, list your pieces, and let creators drive traffic — with payment that
                  only releases once your customer's happy. No chargeback roulette.
                </p>
                <button
                  type="button"
                  className="cta-btn on-black"
                  onClick={() => alert("Preview only — link to your seller onboarding.")}
                >
                  Sell my stuff!
                </button>
                <p className="stars-line">
                  <span className="stars">★★★★★</span>Loved by our early sellers
                </p>
              </Reveal>
              <Reveal delay={1} className="offer-card">
                <span className="tag">For curators &amp; shoppers</span>
                <h3>Shop &amp; Curate</h3>
                <p>
                  Find pieces matched to your actual size, track every delivery, and share the finds
                  worth talking about — all backed by our dispute pipeline.
                </p>
                <button
                  type="button"
                  className="cta-btn"
                  onClick={() => alert("Preview only — link to your shopper onboarding.")}
                >
                  Let's shop!
                </button>
                <p className="stars-line">
                  <span className="stars">★★★★★</span>Loved by our early shoppers
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="results">
          <div className="wrap">
            <div className="results-grid">
              {RESULTS.map((r) => (
                <Reveal key={r.label} className="stat">
                  <CountUp value={r.value} suffix={r.suffix} />
                  <p>{r.label}</p>
                </Reveal>
              ))}
            </div>
            <p className="results-note">
              * Placeholder figures for preview — replace with your verified numbers.
            </p>
          </div>
        </section>

        {/* SCALE */}
        <section className="scale-banner">
          <div className="wrap">
            <div className="scale-banner-inner">
              <Reveal as="h2">
                Built to be the <span>simplest way</span> to sell, share, and shop fashion online.
              </Reveal>
              <Reveal delay={1} className="scale-media">
                <img
                  src={IMG_SCALE}
                  alt="Curated rack of fashion pieces"
                  loading="lazy"
                  width={1008}
                  height={1264}
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* GUARANTEE */}
        <section className="guarantee-banner">
          <div className="wrap">
            <Reveal as="p" className="eyebrow">
              Our guarantee
            </Reveal>
            <Reveal as="h2">
              Your money doesn't move <span>until you're happy.</span> No exceptions.
            </Reveal>
          </div>
        </section>

        {/* FEATURES */}
        <section id="product" className="section-features">
          <div className="wrap">
            <div className="two-col">
              <Reveal>
                <p className="eyebrow">One platform</p>
                <h2 className="headline2">
                  Built for
                  <br />
                  everyone in
                  <br />
                  the chain.
                </h2>
                <p className="section-desc">
                  Oakmonte connects sellers, creators and curators in one native fashion commerce
                  platform — so nobody's doing the work alone.
                </p>
              </Reveal>
              <div className="features-grid">
                {FEATURES.map((f, i) => (
                  <Reveal key={f.title} delay={i as 0 | 1 | 2} className="feature">
                    <span className="num">0{i + 1}</span>
                    <h3>{f.title}</h3>
                    <ul>
                      {f.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* QUOTES */}
        <section className="value-quotes">
          <div className="wrap">
            <Reveal className="value-head">
              <h2>Why people choose Oakmonte.</h2>
            </Reveal>
            <Reveal as="p" className="value-note">
              Sample layout — swap in real customer quotes once you have them.
            </Reveal>
            <div className="quotes-grid">
              {QUOTES.map((q, i) => (
                <Reveal key={q.who} delay={i as 0 | 1 | 2} className="quote-card">
                  <span className="mark">"</span>
                  <p>{q.text}</p>
                  <div className="who">{q.who}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* SOLUTIONS */}
        <section id="solutions" className="section-solutions">
          <div className="wrap">
            <div className="solutions-grid">
              <Reveal>
                <p className="eyebrow">Stay scam-proof</p>
                <h2 className="headline3">Nobody gets ghosted. Nobody gets burned.</h2>
                <div className="solutions-copy">
                  <p>
                    No payment reaches any seller without customer satisfaction. No fast-fashion
                    noise — just curated, authentic pieces from people who stand behind them.
                  </p>
                  <p>
                    Creators won't drive sales and go unpaid. Sellers won't get undercut by
                    unverified resellers. Every complaint runs through a real dispute pipeline
                    before it becomes anyone's problem.
                  </p>
                </div>
              </Reveal>
              <Reveal delay={1} className="guarantee-box">
                <p className="eyebrow">Find your fit</p>
                <p className="big">A recommendation system that actually knows your size.</p>
                <p className="small">
                  Every piece goes through our personal size chart before it reaches you — built to
                  improve curator-piece fit and cut down on returns, not guess and hope.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="faq">
          <div className="wrap">
            <Reveal className="faq-head">
              <p className="eyebrow">Questions</p>
              <h2>
                You've got questions.
                <br />
                Fair ones.
              </h2>
            </Reveal>
            <div className="faq-list">
              {FAQS.map((f, i) => (
                <div key={f.q} className={`faq-item${openFaq === i ? " open" : ""}`}>
                  <button
                    className="faq-q"
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span>{f.q}</span>
                    <span className="plus">+</span>
                  </button>
                  <div className="faq-a" style={{ maxHeight: openFaq === i ? "320px" : 0 }}>
                    <p>{f.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="marquee">
          <div className="marquee-track">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i}>SELL · SHARE · SCALE · SELL · SHARE · SCALE ·</span>
            ))}
          </div>
        </div>

        {/* CLOSING */}
        <section className="closing-cta">
          <div className="wrap">
            <Reveal as="h2">
              Ready to
              <br />
              <span>create?</span>
            </Reveal>
            <Reveal as="p" delay={1}>
              Join the platform built for sellers, creators and curators who want fashion commerce
              done right — no gimmicks, no ghosting.
            </Reveal>
            <Reveal delay={2}>
              <button
                type="button"
                className="cta-btn big"
                onClick={() => alert("Preview only — wire this to your signup flow.")}
              >
                Come join us — it's free!
              </button>
            </Reveal>
          </div>
        </section>

        <footer>
          <div className="wrap footer-row">
            <div className="footer-brand">
              <img src={IMG_LOGO} alt="Oakmonte" className="footer-mark" />
              <span className="tag">CREATED TO CREATE.</span>
            </div>
            <a href="mailto:contact@oakmonte.com">CONTACT US →</a>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ---------------- Styles ---------------- */
const CSS = `
.oak{
  --black:#0A0A0A;--white:#FFFFFF;--blue:#2151F5;--blue-dim:#2151F51a;--gray:#6B6B6B;
  --line:rgba(10,10,10,.1);
  --display:"Archivo Black","Helvetica Neue",Arial,sans-serif;
  --body:"Inter","Helvetica Neue",Arial,sans-serif;
  background:var(--white);color:var(--black);font-family:var(--body);font-weight:400;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;padding-top:88px;
}
.oak *{box-sizing:border-box;}
.oak a{color:inherit;text-decoration:none;}
.oak button{font:inherit;cursor:pointer;background:none;border:none;color:inherit;}
.oak ul{margin:0;padding:0;list-style:none;}
.oak img{display:block;}
.oak .wrap{max-width:1360px;margin:0 auto;padding:0 24px;}
@media (min-width:1024px){.oak .wrap{padding:0 40px;}}

.oak .reveal{opacity:0;transform:translateY(28px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1);}
.oak .reveal.in-view{opacity:1;transform:translateY(0);}
.oak .reveal-delay-1.in-view{transition-delay:.1s;}
.oak .reveal-delay-2.in-view{transition-delay:.2s;}
.oak .reveal-delay-3.in-view{transition-delay:.3s;}

.oak header{position:fixed;top:0;left:0;right:0;width:100%;height:88px;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);transition:box-shadow .3s ease;}
.oak .header-row{display:flex;align-items:flex-end;justify-content:space-between;height:88px;padding-bottom:12px;}
.oak .brand{display:flex;align-items:baseline;gap:0;}
.oak .brand-o{height:48px;width:auto;flex:none;display:inline-block;transform:translateY(5px);}
.oak .footer-mark{width:34px;height:34px;border-radius:9px;background:var(--blue);object-fit:contain;padding:5px;flex:none;}
.oak .brand .word{font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-weight:400;font-size:28px;letter-spacing:-.01em;line-height:1;color:var(--black);}
.oak .brand .tagline{margin-left:10px;font-size:10px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:#2151F5;transform:translateY(-2px);white-space:nowrap;}
@media (max-width:640px){.oak .brand .tagline{margin-left:6px;font-size:9px;letter-spacing:.14em;}}

.oak nav.desktop-nav{display:flex;align-items:center;gap:36px;}
.oak nav.desktop-nav a{font-size:13px;font-weight:600;position:relative;padding:4px 0;}
.oak nav.desktop-nav a::after{content:"";position:absolute;left:0;bottom:-2px;width:0;height:2px;background:var(--blue);transition:width .25s ease;}
.oak nav.desktop-nav a:hover::after,.oak nav.desktop-nav a.active::after{width:100%;}
.oak nav.desktop-nav a.active{color:var(--blue);}

.oak .cta-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;background:var(--black);color:var(--white);font-size:13px;font-weight:700;border-radius:999px;transition:transform .25s ease,background .25s ease;white-space:nowrap;}
.oak .cta-btn:hover{background:var(--blue);transform:translateY(-2px);}
.oak .cta-btn.ghost{background:transparent;color:var(--black);border:1.5px solid var(--black);}
.oak .cta-btn.ghost:hover{background:var(--black);color:var(--white);}
.oak .cta-btn.small{padding:10px 20px;font-size:12px;}
.oak .cta-btn.big{padding:18px 38px;font-size:15px;}
.oak .cta-btn.on-black{background:var(--blue);}
.oak .cta-btn.on-black:hover{background:var(--white);color:var(--black);}

.oak .desktop-auth{display:flex;align-items:center;gap:14px;}
.oak .auth-wrap{position:relative;}
.oak .auth-menu{position:absolute;right:0;margin-top:10px;width:200px;background:var(--white);border:1px solid var(--line);border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,.12);z-index:50;display:none;overflow:hidden;}
.oak .auth-menu.open{display:block;}
.oak .auth-menu a,.oak .auth-menu button{display:block;width:100%;text-align:left;padding:13px 16px;font-size:13px;font-weight:600;}
.oak .auth-menu a:hover,.oak .auth-menu button:hover{background:#F4F5F7;color:var(--blue);}

.oak .mobile-toggle{display:none;padding:8px;}
.oak .mobile-toggle span{display:block;width:22px;height:2px;background:var(--black);margin-bottom:6px;}
.oak .mobile-toggle span:last-child{margin-bottom:0;}
.oak .mobile-menu{display:none;position:fixed;top:88px;left:0;right:0;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);z-index:99;}
.oak .mobile-menu.open{display:block;}
.oak .mobile-menu-inner{padding:24px;display:flex;flex-direction:column;gap:18px;}
.oak .mobile-menu-inner a{font-size:14px;font-weight:700;}
.oak .mobile-auth{padding-top:16px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px;}
@media (max-width:900px){.oak nav.desktop-nav,.oak .desktop-auth{display:none;}.oak .mobile-toggle{display:block;}}
@media (min-width:901px){.oak .mobile-toggle,.oak .mobile-menu{display:none !important;}}

.oak .hero{padding:64px 0 0;position:relative;overflow:hidden;}
.oak .hero-glow{position:absolute;top:-260px;right:-260px;width:640px;height:640px;background:radial-gradient(circle,var(--blue-dim) 0%,transparent 70%);pointer-events:none;animation:oakPulse 6s ease-in-out infinite;}
@keyframes oakPulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.15);opacity:.7;}}

.oak .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin:0 0 24px;}
.oak .eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--blue);}

.oak h1.headline{font-family:var(--display);font-size:clamp(48px,12.5vw,168px);line-height:.86;letter-spacing:-.02em;text-transform:uppercase;margin:0 0 32px;}
.oak h1.headline .line{display:block;overflow:hidden;}
.oak h1.headline .line span{display:block;transform:translateY(115%);opacity:0;animation:oakReveal .9s cubic-bezier(.16,1,.3,1) forwards;}
.oak h1.headline .line:nth-child(1) span{animation-delay:.05s;}
.oak h1.headline .line:nth-child(2) span{animation-delay:.2s;}
.oak h1.headline .line:nth-child(3) span{animation-delay:.35s;color:var(--blue);}
@keyframes oakReveal{to{transform:translateY(0);opacity:1;}}

.oak .hero-sub{font-size:20px;line-height:1.55;color:var(--gray);max-width:36rem;margin:0 0 40px;font-weight:500;opacity:0;animation:oakFadeUp .7s ease forwards;animation-delay:.55s;}
.oak .hero-sub b{color:var(--black);}
@keyframes oakFadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}

.oak .hero-cta-stack{display:flex;flex-direction:column;gap:12px;margin:36px 0 20px;padding:24px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);opacity:0;animation:oakFadeUp .7s ease forwards;animation-delay:.68s;}
.oak .hero-cta-card{display:flex;flex-direction:column;gap:2px;padding:14px 20px;background:var(--white);border:2px solid var(--black);border-radius:16px;transition:transform .25s ease,background .25s ease,border-color .25s ease,color .25s ease;}
.oak .hero-cta-card:hover{background:var(--blue);border-color:var(--blue);color:#fff;transform:translateY(-2px);}
.oak .hero-cta-card.card-blue{background:var(--blue);border-color:var(--blue);color:#fff;}
.oak .hero-cta-card.card-blue .cta-hint{color:rgba(255,255,255,.8);}
.oak .hero-cta-card.card-outline{background:var(--white);border-color:#2151F5;color:var(--black);}
.oak .hero-cta-card.card-outline .cta-label{color:var(--black);}
.oak .hero-cta-card.card-outline:hover .cta-label{color:#fff;}
.oak .hero-cta-card.card-tint{background:rgba(33,81,245,.08);border-color:var(--black);color:var(--black);}
.oak .hero-cta-card.card-tint .cta-label{color:var(--black);}
.oak .hero-cta-card .cta-label{font-family:var(--body);font-size:clamp(16px,2vw,20px);text-transform:uppercase;letter-spacing:.01em;font-weight:700;line-height:1.2;}
.oak .hero-cta-card .cta-hint{font-size:13px;color:var(--gray);line-height:1.35;}
.oak .hero-cta-card:hover .cta-hint{color:rgba(255,255,255,.8);}
@media (max-width:640px){.oak .hero-cta-card{padding:12px 16px;border-radius:14px;}}

.oak .trust-line{font-size:13px;color:var(--gray);font-weight:500;opacity:0;animation:oakFadeUp .7s ease forwards;animation-delay:.8s;}
.oak .trust-line b{color:var(--black);}
.oak .stars{color:var(--blue);letter-spacing:2px;margin-right:6px;}

.oak .hero-media{position:relative;margin-top:56px;border-radius:24px;overflow:hidden;aspect-ratio:16/7;opacity:0;animation:oakFadeUp .9s ease forwards;animation-delay:.9s;background:#111;}
.oak .hero-media img{width:100%;height:100%;object-fit:cover;transform:scale(1);animation:oakKen 18s ease-out forwards;}
@keyframes oakKen{from{transform:scale(1);}to{transform:scale(1.08);}}
.oak .media-cap{position:absolute;left:24px;bottom:20px;z-index:3;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6);}

.oak .trust-marquee{width:100%;overflow:hidden;background:var(--black);padding:16px 0;margin-top:64px;}
.oak .trust-marquee .track{display:flex;white-space:nowrap;width:max-content;animation:oakScroll 22s linear infinite;}
.oak .trust-marquee .track span{margin:0 28px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:rgba(255,255,255,.55);}
.oak .trust-marquee .track span b{color:#6E8CFF;}
@keyframes oakScroll{from{transform:translateX(0);}to{transform:translateX(-50%);}}

.oak .story{padding:110px 0;background:var(--black);color:var(--white);}
.oak .story-head{max-width:44rem;margin-bottom:52px;}
.oak .story-head .eyebrow{color:#6E8CFF;}
.oak .story-head h2{font-family:var(--display);font-size:clamp(34px,6vw,68px);line-height:1;text-transform:uppercase;margin:0;}
.oak .story-body{display:grid;grid-template-columns:1fr;gap:44px;}
@media (min-width:900px){.oak .story-body{grid-template-columns:1fr .9fr;gap:64px;}}
.oak .story-copy p{font-size:17px;line-height:1.75;color:rgba(255,255,255,.78);margin:0 0 20px;}
.oak .story-copy p.punch{font-family:var(--display);font-size:22px;line-height:1.35;color:#fff;text-transform:uppercase;margin:0 0 22px;}
.oak .story-copy b{color:#fff;}
.oak .story-media{border-radius:20px;overflow:hidden;position:relative;aspect-ratio:3/4;}
.oak .story-media img{width:100%;height:100%;object-fit:cover;}

.oak .offering{padding:100px 0;}
.oak .offering-head{max-width:36rem;margin-bottom:48px;}
.oak .offering-head h2{font-family:var(--display);font-size:clamp(30px,4.5vw,56px);line-height:1;text-transform:uppercase;margin:0 0 16px;}
.oak .offering-head p{font-size:16px;color:var(--gray);line-height:1.6;}
.oak .offering-grid{display:grid;grid-template-columns:1fr;gap:24px;}
@media (min-width:800px){.oak .offering-grid{grid-template-columns:1fr 1fr;}}
.oak .offer-card{border:2px solid var(--black);border-radius:22px;padding:44px;position:relative;overflow:hidden;transition:transform .3s ease,box-shadow .3s ease;background:var(--white);}
.oak .offer-card:hover{box-shadow:0 24px 48px rgba(10,10,10,.12);}
.oak .offer-card.blue{background:var(--blue);color:#fff;border-color:var(--blue);}
.oak .offer-card .tag{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px;display:block;}
.oak .offer-card.blue .tag{color:rgba(255,255,255,.8);}
.oak .offer-card:not(.blue) .tag{color:var(--blue);}
.oak .offer-card h3{font-family:var(--display);font-size:clamp(24px,3vw,34px);text-transform:uppercase;margin:0 0 16px;line-height:1.05;}
.oak .offer-card p{font-size:15px;line-height:1.6;margin:0 0 28px;}
.oak .offer-card:not(.blue) p{color:var(--gray);}
.oak .offer-card.blue p{color:rgba(255,255,255,.85);}
.oak .offer-card .stars-line{font-size:12px;font-weight:700;margin-top:16px;margin-bottom:0;}

.oak .results{padding:90px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
.oak .results-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:32px;}
@media (min-width:768px){.oak .results-grid{grid-template-columns:repeat(4,1fr);}}
.oak .stat b{display:block;font-family:var(--display);font-size:clamp(40px,5.5vw,72px);letter-spacing:-.02em;color:var(--black);}
.oak .stat p{margin:10px 0 0;font-size:13px;font-weight:600;color:var(--gray);text-transform:uppercase;letter-spacing:.04em;}
.oak .results-note{margin-top:28px;font-size:12px;color:var(--gray);}

.oak .scale-banner{padding:120px 0;position:relative;overflow:hidden;background:var(--white);}
.oak .scale-banner-inner{display:grid;grid-template-columns:1fr;gap:40px;align-items:center;}
@media (min-width:1000px){.oak .scale-banner-inner{grid-template-columns:1.1fr .9fr;}}
.oak .scale-banner h2{font-family:var(--display);font-size:clamp(32px,6vw,80px);line-height:.98;letter-spacing:-.02em;text-transform:uppercase;margin:0;}
.oak .scale-banner h2 span{color:var(--blue);}
.oak .scale-media{border-radius:22px;overflow:hidden;position:relative;aspect-ratio:4/5;}
.oak .scale-media img{width:100%;height:100%;object-fit:cover;}

.oak .guarantee-banner{background:var(--black);color:#fff;padding:64px 0;text-align:center;}
.oak .guarantee-banner .eyebrow{color:#6E8CFF;justify-content:center;}
.oak .guarantee-banner h2{font-family:var(--display);font-size:clamp(24px,4vw,46px);line-height:1.15;text-transform:uppercase;max-width:56rem;margin:0 auto;}
.oak .guarantee-banner h2 span{color:var(--blue);}

.oak .section-features{padding:100px 0;}
.oak .two-col{display:grid;grid-template-columns:1fr;gap:48px;}
@media (min-width:1024px){.oak .two-col{grid-template-columns:1fr 1fr;gap:80px;}}
.oak h2.headline2{font-family:var(--display);font-size:clamp(30px,5vw,64px);line-height:1;text-transform:uppercase;margin:0;}
.oak .section-desc{margin-top:20px;font-size:16px;color:var(--gray);max-width:28rem;line-height:1.6;}
.oak .features-grid{display:grid;grid-template-columns:1fr;gap:28px;}
@media (min-width:640px){.oak .features-grid{grid-template-columns:repeat(3,1fr);}}
.oak .feature{border:1px solid var(--line);border-radius:16px;padding:26px;transition:border-color .25s ease;}
.oak .feature:hover{border-color:var(--blue);}
.oak .feature .num{font-family:var(--display);font-size:13px;color:var(--blue);margin-bottom:14px;display:block;}
.oak .feature h3{font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;margin:0 0 14px;}
.oak .feature li{font-size:14px;color:var(--gray);line-height:1.6;margin-bottom:10px;padding-left:16px;position:relative;}
.oak .feature li::before{content:"";position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:var(--blue);}

.oak .value-quotes{padding:100px 0;background:#F7F8FA;}
.oak .value-head{max-width:36rem;margin-bottom:20px;}
.oak .value-head h2{font-family:var(--display);font-size:clamp(28px,4.2vw,52px);line-height:1;text-transform:uppercase;margin:0 0 14px;}
.oak .value-note{font-size:12px;color:var(--gray);margin-bottom:44px;}
.oak .quotes-grid{display:grid;grid-template-columns:1fr;gap:24px;}
@media (min-width:800px){.oak .quotes-grid{grid-template-columns:repeat(3,1fr);}}
.oak .quote-card{background:#fff;border-radius:18px;padding:32px;border:1px solid var(--line);}
.oak .quote-card .mark{font-family:var(--display);font-size:40px;color:var(--blue);line-height:1;margin-bottom:12px;display:block;}
.oak .quote-card p{font-size:15px;line-height:1.6;color:var(--black);font-weight:500;margin:0 0 20px;}
.oak .quote-card .who{font-size:12px;color:var(--gray);font-weight:700;text-transform:uppercase;letter-spacing:.04em;}

.oak .section-solutions{padding:100px 0;}
.oak .solutions-grid{display:grid;grid-template-columns:1fr;gap:48px;align-items:center;}
@media (min-width:1024px){.oak .solutions-grid{grid-template-columns:1fr 1fr;}}
.oak h2.headline3{font-family:var(--display);font-size:clamp(28px,4.5vw,58px);line-height:1;text-transform:uppercase;margin:0 0 22px;}
.oak .solutions-copy p{font-size:15px;color:var(--gray);line-height:1.7;max-width:32rem;margin:0 0 16px;}
.oak .guarantee-box{background:var(--black);color:#fff;border-radius:20px;padding:44px;position:relative;overflow:hidden;}
.oak .guarantee-box::before{content:"";position:absolute;top:-80px;right:-80px;width:220px;height:220px;background:radial-gradient(circle,var(--blue-dim) 0%,transparent 70%);}
.oak .guarantee-box .eyebrow{color:#6E8CFF;}
.oak .guarantee-box p.big{font-size:19px;font-weight:700;line-height:1.5;margin:0 0 14px;}
.oak .guarantee-box p.small{font-size:14px;color:rgba(255,255,255,.65);line-height:1.6;margin:0;}

.oak .faq{padding:100px 0;background:#F7F8FA;}
.oak .faq-head{max-width:36rem;margin-bottom:48px;}
.oak .faq-head h2{font-family:var(--display);font-size:clamp(28px,4.5vw,56px);line-height:1;text-transform:uppercase;margin:0;}
.oak .faq-list{max-width:52rem;}
.oak .faq-item{border-bottom:1px solid var(--line);}
.oak .faq-q{width:100%;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:26px 4px;text-align:left;font-size:17px;font-weight:700;}
.oak .faq-q .plus{flex:none;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--black);display:flex;align-items:center;justify-content:center;font-size:16px;transition:transform .3s ease,background .3s ease,color .3s ease;}
.oak .faq-item.open .faq-q .plus{background:var(--blue);border-color:var(--blue);color:#fff;transform:rotate(45deg);}
.oak .faq-a{max-height:0;overflow:hidden;transition:max-height .4s ease;}
.oak .faq-a p{font-size:15px;color:var(--gray);line-height:1.7;padding:0 4px 26px;max-width:42rem;margin:0;}

.oak .marquee{width:100%;overflow:hidden;background:var(--blue);color:var(--white);padding:16px 0;}
.oak .marquee-track{display:flex;white-space:nowrap;width:max-content;animation:oakScroll 20s linear infinite;}
.oak .marquee-track span{margin:0 24px;font-size:14px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;}

.oak .closing-cta{padding:130px 0;text-align:center;}
.oak .closing-cta h2{font-family:var(--display);font-size:clamp(40px,9vw,120px);line-height:.9;letter-spacing:-.02em;text-transform:uppercase;margin:0 0 24px;}
.oak .closing-cta h2 span{color:var(--blue);}
.oak .closing-cta p{font-size:17px;color:var(--gray);max-width:32rem;margin:0 auto 40px;line-height:1.6;}

.oak footer{padding:56px 0;background:var(--black);color:var(--white);}
.oak .footer-row{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:28px;}
@media (min-width:640px){.oak .footer-row{flex-direction:row;align-items:center;}}
.oak .footer-brand{display:flex;align-items:center;gap:10px;}
.oak .footer-brand .tag{font-size:12px;color:rgba(255,255,255,.55);}
.oak .footer-row > a{font-size:13px;font-weight:700;color:#6E8CFF;}
.oak .footer-row > a:hover{color:#fff;}
`;
