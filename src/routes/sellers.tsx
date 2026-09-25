import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Menu, X } from "lucide-react";
import logoO from "@/assets/logo-o.png";

export const Route = createFileRoute("/sellers")({
  head: () => ({
    meta: [
      // White page, so the iOS status strip must be white too — see the
      // theme-color note in __root.tsx.
      { name: "theme-color", content: "#ffffff" },
      { title: "Sell on Oakmonte — Build the unmissable." },
      {
        name: "description",
        content:
          "Oakmonte gives ambitious sellers a beautiful storefront, a sharper studio, and the confidence to turn a point of view into a business.",
      },
      { property: "og:title", content: "Sell on Oakmonte — Build the unmissable." },
      {
        property: "og:description",
        content:
          "A personal storefront, a considered seller studio, and manufacturing support — everything free to start.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
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

/* ---------------- Data ---------------- */
const FEATURES = [
  {
    number: "01",
    title: "Your store, your rules.",
    copy: "Launch a personal storefront with a sharp point of view — no marketplace sameness, no template fatigue.",
  },
  {
    number: "02",
    title: "A studio that stays out of the way.",
    copy: "Products, orders, customers, and signals in one considered workspace built for momentum.",
  },
  {
    number: "03",
    title: "From idea to inventory.",
    copy: "Oakmonte Manufacturers helps first-time brands source, sample, and produce with confidence.",
  },
];

const PLANS = [
  {
    name: "Launch",
    price: "FREE",
    label: "Everything you need to open beautifully",
    features: [
      "Personal storefront",
      "30+ premium store templates",
      "Unlimited products and collections",
      "Seller Studio essentials",
    ],
  },
  {
    name: "Grow",
    price: "FREE",
    label: "More tools. More momentum. Still free.",
    features: [
      "Everything in Launch",
      "Custom store direction",
      "Growth insights and analytics",
      "Marketing tools and support",
    ],
    featured: true,
  },
  {
    name: "Build Your Brand",
    price: "FREE",
    label: "A full runway for your next big move",
    features: [
      "Everything in Grow",
      "Bespoke digital experience",
      "Priority seller support",
      "Oakmonte Manufacturers access",
    ],
  },
];

/* ---------------- Page ---------------- */
function SellersLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFeature, setOpenFeature] = useState(0);

  return (
    <main className="oak-sellers">
      <style>{CSS}</style>

      <header className="site-nav">
        <a className="wordmark" href="#top">
          <img className="wordmark-logo" src={logoO} alt="Oakmonte logo" /> <span>oakmonte</span>
        </a>
        <nav className={menuOpen ? "nav-links is-open" : "nav-links"}>
          <a href="#why" onClick={() => setMenuOpen(false)}>
            Why Oakmonte
          </a>
          <a href="#sellers" onClick={() => setMenuOpen(false)}>
            For sellers
          </a>
          <a href="#manufacturers" onClick={() => setMenuOpen(false)}>
            Manufacturers
          </a>
          <a href="#plans" onClick={() => setMenuOpen(false)}>
            Pricing
          </a>
        </nav>
        <div className="nav-actions">
          <Link className="nav-login" to="/sign-in">
            Log in
          </Link>
          <a className="pill-button pill-button-light" href="#plans">
            Start selling <ArrowUpRight size={15} />
          </a>
          <button
            className="menu-button"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-orbit orbit-one" />
        <div className="hero-orbit orbit-two" />
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" /> The independent commerce company
          </div>
          <h1>
            Build the
            <br />
            <em>unmissable.</em>
          </h1>
          <p>
            Oakmonte gives ambitious sellers a beautiful storefront, a sharper studio, and the
            confidence to turn a point of view into a business.
          </p>
          <div className="hero-buttons">
            <a className="pill-button pill-button-acid" href="#plans">
              Start for free <ArrowUpRight size={16} />
            </a>
            <a className="text-link hero-link" href="#why">
              Why Oakmonte <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
        <div className="hero-side-note">
          <span>EST. 2026</span>
          <strong>
            Commerce
            <br />
            for the
            <br />
            <em>particular.</em>
          </strong>
        </div>
        <div className="hero-bottom">
          <span>Scroll to explore</span>
          <span>↓</span>
        </div>
      </section>

      <section className="ticker-section">
        <span className="ticker-label">As seen in</span>
        <div className="marquee">
          <div className="marquee-track">
            <span>Fast Company</span>
            <span>Forbes</span>
            <span>VOGUE Business</span>
            <span>WIRED</span>
            <span>Monocle</span>
            <span>TechCrunch</span>
            <span>Business Insider</span>
            <span>Fast Company</span>
            <span>Forbes</span>
            <span>VOGUE Business</span>
          </div>
        </div>
      </section>

      <section className="manifesto" id="why">
        <div className="section-kicker">Oakmonte / A better way to begin</div>
        <h2>
          Not a marketplace.
          <br />
          <em>A point of view.</em>
        </h2>
        <p>
          We believe the next great brands will not be built by blending in. Oakmonte gives
          independent sellers the tools, confidence, and runway to make their own category.
        </p>
        <div className="manifesto-sign">
          OAKMONTE
          <br />
          <span>FOR THE PARTICULAR</span>
        </div>
      </section>

      <section className="features-section" id="sellers">
        <div className="feature-intro">
          <div className="section-kicker">The platform</div>
          <h2>
            Everything you need.
            <br />
            <em>Nothing you don't.</em>
          </h2>
          <p>Three moves from idea to a business people come back to.</p>
        </div>
        <div className="feature-list">
          {FEATURES.map((feature, index) => (
            <button
              type="button"
              className={openFeature === index ? "feature-row is-open" : "feature-row"}
              key={feature.number}
              onClick={() => setOpenFeature(index)}
            >
              <span className="feature-number">{feature.number}</span>
              <span className="feature-body">
                <strong>{feature.title}</strong>
                {openFeature === index && <span>{feature.copy}</span>}
              </span>
              <ChevronDown className="feature-chevron" size={20} />
            </button>
          ))}
        </div>
      </section>

      <section className="studio-section">
        <div className="studio-card">
          <div className="studio-top">
            <span className="studio-dot" /> Seller Studio{" "}
            <span className="studio-status">LIVE WORKSPACE</span>
          </div>
          <div className="studio-window">
            <div className="window-nav">
              <span>Overview</span>
              <span>Products</span>
              <span>Orders</span>
              <span>Audience</span>
            </div>
            <div className="window-main">
              <div>
                <small>THIS MONTH</small>
                <strong>$48,920</strong>
                <span className="up">↗ 24.8%</span>
              </div>
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
              <div className="window-rows">
                <span>
                  New orders <b>184</b>
                </span>
                <span>
                  Returning customers <b>68%</b>
                </span>
                <span>
                  Products live <b>42</b>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="studio-copy">
          <div className="section-kicker">02 / Seller Studio</div>
          <h2>
            Run the shop.
            <br />
            <em>Keep the spark.</em>
          </h2>
          <p>
            A calm, clear workspace for the work behind the work. Know what is moving, what is
            working, and what to do next.
          </p>
          <a className="text-link" href="#plans">
            Enter the studio <ArrowUpRight size={15} />
          </a>
        </div>
      </section>

      <section className="manufacturer-section" id="manufacturers">
        <div>
          <div className="section-kicker">03 / Oakmonte Manufacturers</div>
          <h2>
            Make the thing
            <br />
            <em>you can't stop thinking about.</em>
          </h2>
          <p>
            Starting a brand should not mean navigating a maze. We help you find the right
            materials, partners, quantities, and next step.
          </p>
          <a className="pill-button pill-button-dark" href="#plans">
            Meet the makers <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="manufacturer-list">
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
        </div>
      </section>

      <section className="stats-section">
        <div className="section-kicker">The Oakmonte signal</div>
        <div className="stats-grid">
          <div>
            <strong>14.8k</strong>
            <span>independent sellers</span>
          </div>
          <div>
            <strong>92%</strong>
            <span>repeat customer rate</span>
          </div>
          <div>
            <strong>3.4m</strong>
            <span>products discovered</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>ideas in motion</span>
          </div>
        </div>
      </section>

      <section className="plans-section" id="plans">
        <div className="section-kicker">Everything starts free</div>
        <div className="plans-heading">
          <h2>
            30+ ways to begin.
            <br />
            <em>Zero reasons to wait.</em>
          </h2>
          <p>
            Choose your starting point and get every essential perk included — beautiful templates,
            powerful tools, and room to grow, all free.
          </p>
        </div>
        <div className="plan-grid">
          {PLANS.map((plan) => (
            <article className={plan.featured ? "plan-card featured" : "plan-card"} key={plan.name}>
              <div className="plan-label">
                {plan.featured && <span className="plan-badge">MOST CHOSEN</span>}
                <span>{plan.name}</span>
              </div>
              <strong>{plan.price}</strong>
              <p>{plan.label}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={14} />
                    {feature}
                  </li>
                ))}
              </ul>
              <a href="#top">
                Claim free access <ArrowUpRight size={14} />
              </a>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-cta">
          <div className="section-kicker">For the particular</div>
          <h2>
            Your next
            <br />
            <em>big move.</em>
          </h2>
          <a className="pill-button pill-button-acid" href="#plans">
            Claim your free store <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="footer-bottom">
          <a className="wordmark" href="#top">
            <img className="wordmark-logo" src={logoO} alt="Oakmonte logo" /> <span>oakmonte</span>
          </a>
          <span>© 2026 Oakmonte Commerce, Inc.</span>
          <span>
            <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> · Instagram
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
  overflow:hidden;background:#fff;color:var(--foreground);font-family:'Manrope',sans-serif;
}
.oak-sellers *{box-sizing:border-box}
.oak-sellers a{color:inherit;text-decoration:none}
.oak-sellers button{font:inherit;color:inherit}
.oak-sellers .site-nav{height:76px;padding:0 4vw;position:absolute;z-index:5;width:100%;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(17,24,39,.14);background:rgba(255,255,255,.78);backdrop-filter:blur(16px)}
.oak-sellers .wordmark{display:inline-flex;align-items:center;gap:8px;font-size:20px;font-weight:800;letter-spacing:-.08em}
.oak-sellers .wordmark-logo{width:30px;height:30px;object-fit:contain;display:block;filter:none}
.oak-sellers .wordmark span{display:inline-block;animation:oakSellersWordmarkReveal .8s .15s cubic-bezier(.2,.8,.2,1) both}
.oak-sellers .nav-links{display:flex;gap:34px;margin-left:auto;margin-right:5vw;font:11px 'DM Mono',monospace;color:#667085}
.oak-sellers .nav-links a:hover,.oak-sellers .nav-login:hover{color:var(--primary)}
.oak-sellers .nav-actions{display:flex;align-items:center;gap:22px;font-size:12px}
.oak-sellers .pill-button{display:inline-flex;align-items:center;justify-content:center;gap:11px;border-radius:999px;padding:14px 20px;font-size:12px;font-weight:800;transition:transform .25s ease,box-shadow .25s ease,background .25s ease;position:relative;overflow:hidden}
.oak-sellers .pill-button::after{content:'';position:absolute;inset:0;width:35%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.42),transparent);transform:translateX(-140%);animation:oakSellersShimmer 5s 2s ease-in-out infinite}
.oak-sellers .pill-button:hover{transform:translateY(-4px) scale(1.025);box-shadow:0 14px 28px rgba(20,85,217,.2)}
.oak-sellers .pill-button-light{background:#111827;color:#fff}
.oak-sellers .pill-button-acid{background:var(--primary);color:#fff}
.oak-sellers .pill-button-dark{background:#111827;color:#fff}
.oak-sellers .menu-button{display:none;background:none;border:0;cursor:pointer;padding:5px}

.oak-sellers .hero{min-height:750px;height:100vh;position:relative;display:flex;align-items:flex-end;padding:0 7vw 10vw;overflow:hidden;background:linear-gradient(120deg,#fff 0%,#f4f7fb 52%,#eaf1ff 100%)}
.oak-sellers .hero-grid{position:absolute;inset:0;opacity:.5;background-image:linear-gradient(rgba(20,85,217,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(20,85,217,.08) 1px,transparent 1px);background-size:88px 88px;mask-image:linear-gradient(90deg,black,transparent 75%);animation:oakSellersGridPulse 8s ease-in-out infinite}
.oak-sellers .hero-orbit{position:absolute;border:1px solid rgba(20,85,217,.22);border-radius:50%;transform:rotate(-25deg);animation:oakSellersDrift 13s ease-in-out infinite alternate}
.oak-sellers .hero-orbit::after{content:'';position:absolute;width:10px;height:10px;border-radius:50%;background:var(--primary);right:12%;top:8%;box-shadow:0 0 0 8px rgba(20,85,217,.08),0 0 24px rgba(20,85,217,.4);animation:oakSellersPulseRing 3s ease-in-out infinite}
.oak-sellers .orbit-one{width:780px;height:430px;right:-80px;top:160px}
.oak-sellers .orbit-two{width:580px;height:260px;right:30px;top:245px;border-color:rgba(17,24,39,.13);animation-duration:17s;animation-direction:alternate-reverse}
.oak-sellers .hero-copy{position:relative;z-index:1;max-width:740px;animation:oakSellersRise 1s ease both}
.oak-sellers .eyebrow,.oak-sellers .section-kicker{color:var(--primary);text-transform:uppercase;letter-spacing:.06em;font:10px 'DM Mono',monospace}
.oak-sellers .status-dot,.oak-sellers .studio-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--primary);margin-right:8px;box-shadow:0 0 14px rgba(20,85,217,.55);animation:oakSellersBlink 2s ease-in-out infinite}
.oak-sellers .hero h1{margin:26px 0 32px;font-size:clamp(72px,13vw,185px);line-height:.82;letter-spacing:-.1em;font-weight:600;animation:oakSellersHeadlineIn 1.15s .15s ease both}
.oak-sellers .hero h1 em,.oak-sellers .manifesto h2 em,.oak-sellers .feature-intro h2 em,.oak-sellers .studio-copy h2 em,.oak-sellers .manufacturer-section h2 em,.oak-sellers .plans-heading h2 em,.oak-sellers .footer-cta h2 em{font-family:Georgia,serif;font-weight:400;color:var(--primary)}
.oak-sellers .hero-copy p{max-width:440px;color:#475467;line-height:1.55;font-size:16px;animation:oakSellersRise .9s .35s ease both}
.oak-sellers .hero-buttons{display:flex;align-items:center;gap:27px;margin-top:32px;animation:oakSellersRise .9s .5s ease both}
.oak-sellers .text-link{display:inline-flex;align-items:center;gap:8px;font:11px 'DM Mono',monospace}
.oak-sellers .hero-link{color:#344054}
.oak-sellers .hero-side-note{position:absolute;right:7vw;bottom:12vw;z-index:1;display:flex;flex-direction:column;gap:21px;color:#667085;font:10px 'DM Mono',monospace}
.oak-sellers .hero-side-note strong{color:#111827;font:600 32px/1 Georgia,serif;letter-spacing:-.06em}
.oak-sellers .hero-bottom{position:absolute;right:7vw;bottom:4vw;display:flex;gap:14px;color:#667085;font:10px 'DM Mono',monospace}

.oak-sellers .ticker-section{display:flex;align-items:center;gap:40px;padding:20px 0;overflow:hidden;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.oak-sellers .ticker-label{flex:0 0 auto;padding-left:4vw;color:var(--muted);text-transform:uppercase;font:10px 'DM Mono',monospace}
.oak-sellers .marquee{overflow:hidden;flex:1}
.oak-sellers .marquee-track{display:flex;gap:65px;width:max-content;color:#344054;font-size:17px;font-weight:700;animation:oakSellersMarquee 28s linear infinite}
.oak-sellers .marquee-track span:nth-child(3n){font:italic 20px Georgia,serif;color:var(--primary)}

.oak-sellers .manifesto{position:relative;padding:155px 7vw 170px;background:var(--ink);color:#fff}
.oak-sellers .manifesto .section-kicker{color:#7ba2ff}
.oak-sellers .manifesto h2{margin:28px 0;font-size:clamp(56px,9vw,126px);line-height:.88;letter-spacing:-.1em;font-weight:600}
.oak-sellers .manifesto p{max-width:430px;margin-left:40%;color:#c4cad5;line-height:1.6}
.oak-sellers .manifesto-sign{margin-top:120px;color:#7ba2ff;font:12px/1.3 'DM Mono',monospace}
.oak-sellers .manifesto-sign span{font-size:9px;color:#98a2b3}

.oak-sellers .features-section{display:grid;grid-template-columns:.9fr 1.1fr;gap:9vw;padding:130px 7vw}
.oak-sellers .feature-intro h2,.oak-sellers .studio-copy h2,.oak-sellers .manufacturer-section h2,.oak-sellers .plans-heading h2{margin:27px 0;font-size:clamp(49px,7vw,95px);line-height:.9;letter-spacing:-.09em;font-weight:600}
.oak-sellers .feature-intro p,.oak-sellers .studio-copy p,.oak-sellers .manufacturer-section p,.oak-sellers .plans-heading p{max-width:360px;color:var(--muted);line-height:1.6;font-size:14px}
.oak-sellers .feature-list{border-top:1px solid var(--border)}
.oak-sellers .feature-row{width:100%;display:flex;align-items:flex-start;gap:20px;text-align:left;padding:28px 0;border:0;border-bottom:1px solid var(--border);background:none;cursor:pointer;transition:padding .35s ease,background .35s ease}
.oak-sellers .feature-row:hover{padding-left:12px;background:var(--blue-soft)}
.oak-sellers .feature-number{padding-top:4px;color:var(--primary);font:11px 'DM Mono',monospace}
.oak-sellers .feature-body{flex:1;display:flex;flex-direction:column;gap:0}
.oak-sellers .feature-body strong{font-size:clamp(22px,3vw,36px);letter-spacing:-.07em;font-weight:600}
.oak-sellers .feature-body span{max-width:440px;margin-top:13px;color:var(--muted);font-size:13px;line-height:1.5;animation:oakSellersReveal .45s ease both}
.oak-sellers .feature-chevron{color:var(--muted);margin-top:5px;transition:transform .3s}
.oak-sellers .feature-row.is-open .feature-chevron{transform:rotate(180deg);color:var(--primary)}

.oak-sellers .studio-section{display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:9vw;padding:120px 7vw;background:var(--paper)}
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
.oak-sellers .stats-grid div{display:flex;flex-direction:column;gap:7px}
.oak-sellers .stats-grid strong{font-size:clamp(35px,5vw,66px);letter-spacing:-.1em}
.oak-sellers .stats-grid span{color:var(--muted);text-transform:uppercase;font:10px 'DM Mono',monospace}

.oak-sellers .plans-section{padding:125px 7vw;background:var(--paper);color:var(--ink)}
.oak-sellers .plans-section .section-kicker{color:var(--primary)}
.oak-sellers .plans-heading{display:flex;justify-content:space-between;align-items:end}
.oak-sellers .plans-heading p{color:#667085}
.oak-sellers .plan-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:70px}
.oak-sellers .plan-card{min-height:365px;padding:26px;display:flex;flex-direction:column;background:#fff;border:1px solid #d8dee8;transition:transform .3s ease,box-shadow .3s ease}
.oak-sellers .plan-card:hover{transform:translateY(-10px);box-shadow:0 20px 45px rgba(20,85,217,.13)}
.oak-sellers .plan-card.featured{background:var(--ink);color:#fff;border-color:var(--ink)}
.oak-sellers .plan-label{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:17px;text-transform:uppercase;font:10px 'DM Mono',monospace}
.oak-sellers .featured .plan-label{border-color:#3b4657}
.oak-sellers .plan-badge{color:#8eb0ff}
.oak-sellers .plan-card>strong{margin-top:31px;font-size:51px;letter-spacing:-.1em}
.oak-sellers .plan-card>p{color:#667085;font-size:12px}
.oak-sellers .featured>p{color:#c4cad5}
.oak-sellers .plan-card ul{display:grid;gap:10px;list-style:none;padding:0;margin:22px 0;color:#667085;font-size:12px}
.oak-sellers .featured ul{color:#c4cad5}
.oak-sellers .plan-card li{display:flex;align-items:center;gap:7px}
.oak-sellers .plan-card li svg{color:var(--primary)}
.oak-sellers .plan-card>a{display:flex;align-items:center;gap:8px;margin-top:auto;font:10px 'DM Mono',monospace}

.oak-sellers .site-footer{padding:130px 7vw 25px}
.oak-sellers .footer-cta{min-height:445px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.oak-sellers .footer-cta h2{margin:27px 0 45px;font-size:clamp(70px,10vw,145px);line-height:.83;letter-spacing:-.1em}
.oak-sellers .footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:20px;border-top:1px solid var(--border);color:#798078;font:10px 'DM Mono',monospace}
.oak-sellers .footer-bottom .wordmark{color:var(--foreground)}
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
@keyframes oakSellersReveal{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes oakSellersFloatCard{50%{transform:translateY(-7px)}}
@keyframes oakSellersBars{to{transform:scaleY(.82)}}

@media (max-width:800px){
  .oak-sellers .site-nav{padding:0 5vw}
  .oak-sellers .nav-links{display:none;position:absolute;left:0;right:0;top:76px;padding:25px 5vw;margin:0;flex-direction:column;gap:22px;background:#fff}
  .oak-sellers .nav-links.is-open{display:flex}
  .oak-sellers .nav-login{display:none}
  .oak-sellers .menu-button{display:block}
  .oak-sellers .hero{min-height:720px;padding:0 7vw 100px}
  .oak-sellers .hero h1{font-size:clamp(70px,20vw,125px)}
  .oak-sellers .hero-side-note{right:7vw;top:145px;bottom:auto}
  .oak-sellers .hero-bottom{right:7vw}
  .oak-sellers .ticker-section{gap:20px}
  .oak-sellers .ticker-label{padding-left:5vw}
  .oak-sellers .manifesto{padding:100px 7vw}
  .oak-sellers .manifesto p{margin-left:0}
  .oak-sellers .manifesto-sign{margin-top:70px}
  .oak-sellers .features-section,.oak-sellers .studio-section,.oak-sellers .manufacturer-section{display:flex;flex-direction:column;gap:55px;padding:85px 7vw}
  .oak-sellers .studio-window{min-height:320px}
  .oak-sellers .window-nav{width:88px;font-size:9px}
  .oak-sellers .window-main strong{font-size:38px}
  .oak-sellers .stats-section{padding:75px 7vw}
  .oak-sellers .stats-grid{grid-template-columns:repeat(2,1fr);row-gap:35px}
  .oak-sellers .plans-section{padding:85px 7vw}
  .oak-sellers .plans-heading{display:block}
  .oak-sellers .plans-heading p{margin-top:25px}
  .oak-sellers .plan-grid{grid-template-columns:1fr;margin-top:45px}
  .oak-sellers .plan-card{min-height:320px}
  .oak-sellers .footer-bottom{flex-wrap:wrap;gap:17px}
  .oak-sellers .footer-bottom span:last-child{width:100%}
}

@media (prefers-reduced-motion:reduce){
  .oak-sellers .marquee-track,.oak-sellers .hero-orbit,.oak-sellers .hero-grid,.oak-sellers .studio-card,.oak-sellers .chart i,.oak-sellers .wordmark-logo,.oak-sellers .wordmark span,.oak-sellers .pill-button::after,.oak-sellers .hero-orbit::after{animation:none}
  .oak-sellers .hero-copy,.oak-sellers .hero h1,.oak-sellers .hero-copy p,.oak-sellers .hero-buttons{animation:none}
  .oak-sellers .pill-button,.oak-sellers .plan-card,.oak-sellers .feature-row{transition:none}
}
`;
