import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import fabricImg from "@/assets/fabric-detail.jpg";
import logoO from "@/assets/logo-o.png";

export const Route = createFileRoute("/")({
  component: Index,
});

type MenuKey = "product" | "solutions" | "resources" | "blog";

const MENUS: Record<MenuKey, { label: string; items: { title: string; desc: string; href: string }[] }> = {
  product: {
    label: "Product",
    items: [
      { title: "Content to Sale", desc: "Buy directly from creative content — no third-party links, higher conversion rate.", href: "#product" },
      { title: "Scam Proof", desc: "No payment reaches a seller without customer satisfaction.", href: "#product" },
      { title: "Seller Accountability", desc: "Every product is easily traced back to the creator or brand who promoted it.", href: "#product" },
      { title: "Handled Logistics", desc: "A dedicated delivery service for every seller.", href: "#product" },
      { title: "Sellers Dashboard", desc: "Performance analysis, order handling, Recommendation systems, content marketing\u00a0and\u00a0much more all in one place.", href: "#product" },
      { title: "Find Your Fit", desc: "A recommendation system built to improve product-customer fit and\u00a0over-all customer satisfaction", href: "#product" },
      { title: "Oakmonte Studio", desc: "Dedicated tools for creators and brands to express creativity through content.", href: "#product" },
      { title: "Customizable Storefronts", desc: "Communicate your identity to customers at a glance.", href: "#product" },
      { title: "Improved Marketing", desc: "Human help and intuitive tools for\u00a0effective story-telling and brand positioning.", href: "#product" },
      { title: "Collaboration Tools", desc: "Sellers and creators collaborate for income streams and a better customer experience.", href: "#product" },
    ],
  },
  solutions: {
    label: "Solutions",
    items: [
      { title: "For Sellers", desc: "Customizable storefronts for vetted brands and boutiques.", href: "#sellers" },
      { title: "For Creators", desc: "Monetize your style through content.", href: "#creators" },
      { title: "For Buyers", desc: "Protected access to the trust triangle.", href: "#buyers" },
    ],
  },
  resources: {
    label: "Resources",
    items: [
      { title: "Docs", desc: "Integration guides for sellers and creators.", href: "#" },
      { title: "About / Manifesto", desc: "Our vetting standards and why we built Oakmonte.", href: "#" },
      { title: "Support", desc: "Help with verification, escrow, and payouts.", href: "#" },
    ],
  },
  blog: {
    label: "Blog",
    items: [
      { title: "Journal", desc: "Editorial fashion features and style curation.", href: "#" },
      { title: "Creator Spotlights", desc: "Stories from creators building on Oakmonte.", href: "#" },
      { title: "Style Guides", desc: "Curated collections from our style curators.", href: "#" },
    ],
  },
};

const SECTION_IDS = ["ecosystem", "product", "sellers", "creators", "buyers", "register"];

function Index() {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<MenuKey | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeText = "Oakmonte is an ecosystem designed for those who expect more. We connect vetted sellers, honest creators and style curators through a content driven marketplace.";
  const typeRef = useRef<HTMLParagraphElement>(null);
  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    const el = typeRef.current;
    if (!el) return;
    const total = typeText.length;
    const periodIndex = typeText.indexOf('.') + 1;
    const pauseStart = periodIndex / total;
    const pauseHold = 0.2;
    const pauseEnd = pauseStart + pauseHold;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const start = windowHeight * 0.85;
      const end = windowHeight * 0.45;
      let progress = 0;
      if (rect.top < start) {
        progress = (start - rect.top) / (start - end);
      }
      progress = Math.max(0, Math.min(1, progress));
      let effective = progress;
      if (progress > pauseStart && progress < pauseEnd) {
        effective = pauseStart;
      } else if (progress >= pauseEnd) {
        effective = pauseStart + ((progress - pauseEnd) / (1 - pauseEnd)) * (1 - pauseStart);
      }
      effective = Math.max(0, Math.min(1, effective));
      setTypedLength(Math.round(effective * total));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      let current = "";
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openWithKey = (key: MenuKey) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setOpenMenu(key);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 150);
  };

  const navLinkClass = "relative inline-flex items-center gap-1 py-1 text-[11px] uppercase tracking-[0.2em] font-semibold transition-colors duration-500 hover:text-brand-accent";

  const underline = (active: boolean) =>
    `pointer-events-none absolute left-0 -bottom-0.5 h-px w-full origin-left bg-brand-accent transition-transform duration-200 ease-out ${active ? "scale-x-100" : "scale-x-0"} group-hover:scale-x-100`;

  const isSectionActive = (key: MenuKey) => {
    if (key === "solutions") return ["sellers", "creators", "buyers"].includes(activeSection);
    if (key === "product") return activeSection === "product" || activeSection === "ecosystem";
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans">
      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 w-full z-50 px-4 sm:px-6 lg:px-8 flex justify-between items-center gap-3 border-b border-brand-text/5 bg-brand-bg/80 backdrop-blur-md transition-[padding] duration-300 ${scrolled ? "py-3 md:py-4" : "py-4 md:py-6"}`}>
        <a href="#top" className="flex items-baseline gap-0 shrink-0 min-w-0">
          <img src={logoO} alt="Oakmonte" className="h-8 sm:h-10 md:h-11 w-auto inline-block align-baseline mt-1" />
          <span className="font-sans font-normal text-2xl sm:text-3xl tracking-tight leading-none">akmonte</span>
          <span className="hidden sm:inline ml-3 text-[9px] uppercase tracking-[0.25em] opacity-40 font-sans font-normal leading-none pb-1">Style First</span>
        </a>

        <div className="hidden lg:flex gap-10" onMouseLeave={scheduleClose}>
          {(Object.keys(MENUS) as MenuKey[]).map((key) => {
            const m = MENUS[key];
            const isOpen = openMenu === key;
            const active = isSectionActive(key);
            return (
              <div key={key} className="group relative" onMouseEnter={() => openWithKey(key)}>
                <button
                  className={navLinkClass}
                  onFocus={() => openWithKey(key)}
                  aria-expanded={isOpen}
                >
                  {m.label}
                  <svg width="8" height="8" viewBox="0 0 8 8" className={`opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                    <path d="M1 2l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  </svg>
                  <span className={underline(active)} />
                </button>
                {isOpen && (
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 pt-4"
                    style={{ animation: "ddFadeIn 180ms ease-out both" }}
                  >
                    <div className={`bg-brand-bg border border-brand-text/10 shadow-xl normal-case tracking-normal py-3 ${key === "product" ? "w-[560px] grid grid-cols-2" : "w-80"}`}>
                      {m.items.map((it, i) => (
                        <a
                          key={it.title}
                          href={it.href}
                          className="block px-5 py-3 hover:bg-brand-muted/40 transition-colors"
                          style={{ animation: `ddItemIn 220ms ease-out ${i * 30}ms both` }}
                        >
                          <div className="text-sm font-semibold">{it.title}</div>
                          <div className="text-xs text-brand-text/60 font-light mt-0.5 leading-snug">{it.desc}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <a href="#" className="hidden md:inline text-[11px] uppercase tracking-[0.2em] font-semibold hover:text-brand-accent transition-colors duration-500">Sign in</a>
          <a href="#register" className="px-3 sm:px-5 md:px-6 py-2 border border-brand-text text-[9px] sm:text-[10px] uppercase tracking-widest whitespace-nowrap hover:bg-brand-text hover:text-brand-bg transition-all">Access Dashboard</a>
          <button
            className="lg:hidden p-2 -mr-2"
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span className="block w-5 h-px bg-brand-text mb-1.5" />
            <span className="block w-5 h-px bg-brand-text mb-1.5" />
            <span className="block w-5 h-px bg-brand-text" />
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-brand-bg border-b border-brand-text/10 shadow-xl">
            {(Object.keys(MENUS) as MenuKey[]).map((key) => {
              const m = MENUS[key];
              const open = mobileGroup === key;
              return (
                <div key={key} className="border-b border-brand-text/5">
                  <button
                    onClick={() => setMobileGroup(open ? null : key)}
                    className="w-full flex justify-between items-center px-6 py-4 text-[11px] uppercase tracking-[0.2em] font-semibold"
                  >
                    {m.label}
                    <span className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      {m.items.map((it) => (
                        <a key={it.title} href={it.href} onClick={() => setMobileOpen(false)} className="block px-6 py-3 hover:bg-brand-muted/40">
                          <div className="text-sm font-semibold">{it.title}</div>
                          <div className="text-xs text-brand-text/60 font-light mt-0.5">{it.desc}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </nav>

      <div className="w-full flex justify-end px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 md:pt-36 pb-2">
        <a href="mailto:hello@oakmonte.com" className="text-[11px] uppercase tracking-[0.2em] font-semibold hover:text-brand-accent transition-colors duration-500">Contact us</a>
      </div>

      {/* HERO */}
      <section id="top" className="pt-4 md:pt-6 pb-16 md:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-12 gap-4 sm:gap-8 items-end">
          <div className="col-span-12 lg:col-span-7">
            <h1 className="leading-[0.85] tracking-tight mb-6 md:mb-8 text-[3.25rem] sm:text-6xl md:text-8xl lg:text-[150px] uppercase break-words" style={{ fontFamily: "Anton, Impact, sans-serif", fontWeight: 400 }}>
              SHARE <br />
              <span className="text-brand-accent">YOUR</span> STYLE.
            </h1>
            <p ref={typeRef} className="max-w-full sm:max-w-md text-base sm:text-lg text-brand-text/70 font-light leading-relaxed mb-6 min-h-[6rem] sm:min-h-[5rem]" aria-label={typeText}>
              {typeText.slice(0, typedLength)}
              <span className="inline-block w-px h-[1em] bg-brand-text/70 align-middle ml-0.5" style={{ animation: 'cursor-blink 0.7s steps(1) infinite' }} aria-hidden="true" />
            </p>
            <p className={`max-w-full sm:max-w-md text-sm sm:text-base italic text-brand-text/50 leading-relaxed mb-10 md:mb-12 transition-all duration-300 ${typedLength === typeText.length ? 'opacity-100 translate-y-0 delay-500' : 'opacity-0 translate-y-3'}`}>
              style is proof that you <span className="font-bold not-italic" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif' }}>think different.</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl">
              <a href="#register" className="text-center px-4 sm:px-6 py-4 md:py-5 bg-brand-text text-brand-bg text-[11px] uppercase tracking-widest font-bold hover:bg-brand-accent transition-colors duration-300">Set up a Store</a>
              <a href="#register" className="text-center px-4 sm:px-6 py-4 md:py-5 bg-brand-text text-brand-bg text-[11px] uppercase tracking-widest font-bold hover:bg-brand-accent transition-colors duration-300">Become a Creator</a>
              <a href="#buyers" className="text-center px-4 sm:px-6 py-4 md:py-5 bg-brand-bg text-brand-text border border-brand-text text-[11px] uppercase tracking-widest font-bold hover:border-brand-accent hover:text-brand-accent transition-colors duration-300">DEFINE YOUR WARDROBE</a>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST TRIANGLE */}
      <section id="ecosystem" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-8 border-y border-brand-text/5">
        <div className="w-full max-w-7xl mx-auto">
          <div className="flex flex-col mb-10 sm:mb-16 md:mb-20">
            <span className="text-[10px] uppercase tracking-[0.3em] text-brand-accent font-bold mb-4">{"\n"}</span>
            <h2 className="text-3xl sm:text-4xl font-serif">{"\n"}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-brand-text/10">
            <div id="buyers" className="bg-brand-bg lg:pr-12 py-8">
              <span className="text-sm font-serif italic mb-6 block">&nbsp;Sellers</span>
              <h3 className="text-xl font-semibold mb-4">{"\n"}</h3>
              <ul className="text-sm text-brand-text/60 leading-relaxed list-disc list-inside space-y-1">
                <li>Logistics Handled</li>
                <li>Wider Customer Base</li>
                <li>Custom Stores</li>
              </ul>
            </div>
            <div id="sellers" className="bg-brand-bg lg:px-12 py-8">
              <span className="text-sm font-serif italic mb-6 block">Creators</span>
              <h3 className="text-xl font-semibold mb-4">{"\n"}</h3>
              <ul className="text-sm text-brand-text/60 leading-relaxed list-disc list-inside space-y-1">
                <li>Make money from your content</li>
                <li>Intuitive creator and collaboration tools</li>
                <li>Greater visibility</li>
              </ul>
            </div>
            <div id="creators" className="bg-brand-bg lg:pl-12 py-8">
              <span className="text-sm font-serif italic mb-6 block">Curators</span>
              <h3 className="text-xl font-semibold mb-4">{"\n"}</h3>
              <ul className="text-sm text-brand-text/60 leading-relaxed list-disc list-inside space-y-1">
                <li>Get pieces that actually fit</li>
                <li>Stay scam proof</li>
                <li>Find and share inspirations and recommendations</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 md:mt-16 pt-10 border-t border-brand-text/10">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent font-bold mb-5 text-center">{"\n"}</p>
            <ul className="flex flex-col sm:flex-row justify-center items-start sm:items-center gap-4 sm:gap-12 text-sm text-brand-text/60 leading-relaxed list-disc list-inside sm:list-outside">
              <li>Easy transfer of content from other platforms</li>
              <li>0 Upfront Cost</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="product" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-12 gap-8 md:gap-12 lg:gap-16 items-center">
          <div className="col-span-12 lg:col-span-6">
            <img src={fabricImg} alt="Close-up of luxury woven fabric with soft neutral tones, highlighting texture and craftsmanship" loading="lazy" width={1200} height={1600} className="w-full aspect-[3/4] object-cover outline outline-1 -outline-offset-1 outline-black/5" />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif leading-tight mb-6 md:mb-8">
              Eliminate the Friction.<br />
              <span className="italic">Elevate the Sale.</span>
            </h2>
            <div className="space-y-6">
              {[
                { t: "Direct Content-to-Cart", n: "Feature 01", d: "No third-party links. Buy directly from the image or video within the native Oakmonte interface." },
                { t: "Trust-First Verification", n: "Feature 02", d: "Every seller is manually vetted. No fast-fashion noise, just curated luxury and authentic archives." },
                { t: "Creator Attribution", n: "Feature 03", d: "Every conversion is traced to the creator who inspired it. Fair credit, transparent payout." },
              ].map((f) => (
                <div key={f.t} className="group cursor-default p-4 -mx-2 sm:-mx-4 rounded-sm border border-transparent transition-all duration-200 hover:-translate-y-1 hover:border-brand-text/10 hover:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.15)]">
                  <div className="flex justify-between items-end border-b border-brand-text/10 pb-4 group-hover:border-brand-text transition-colors">
                    <span className="text-lg sm:text-xl md:text-2xl font-light min-w-0 break-words">{f.t}</span>
                    <span className="text-[10px] uppercase font-bold pb-2 shrink-0 ml-4">{f.n}</span>
                  </div>
                  <p className="mt-4 text-sm text-brand-text/60 leading-relaxed max-w-[52ch]">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* REGISTER */}
      <section id="register" className="py-16 sm:py-24 md:py-32 bg-brand-text text-brand-bg">
        <div className="w-full max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-serif mb-10 md:mb-12 italic">Join the Front Row</h2>
          <div className="bg-white/5 p-6 sm:p-8 md:p-12 rounded-lg backdrop-blur-sm border border-white/10">
            <p className="text-xs md:text-sm uppercase tracking-[0.2em] mb-8 opacity-60 font-semibold">Seller &amp; Creator Registration</p>
            {submitted ? (
              <div className="py-10 text-center">
                <div className="text-2xl font-serif italic mb-3">Request received.</div>
                <p className="text-sm opacity-70">We'll be in touch after our curator review — usually within 3 business days.</p>
              </div>
            ) : (
              <form className="space-y-6 text-left" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input required type="text" placeholder="First Name" className="w-full bg-transparent border-b border-white/20 py-3 focus:outline-none focus:border-brand-bg transition-colors placeholder:text-brand-bg/30 text-sm text-brand-bg" />
                  <input required type="text" placeholder="Last Name" className="w-full bg-transparent border-b border-white/20 py-3 focus:outline-none focus:border-brand-bg transition-colors placeholder:text-brand-bg/30 text-sm text-brand-bg" />
                </div>
                <input required type="email" placeholder="Professional Email" className="w-full bg-transparent border-b border-white/20 py-3 focus:outline-none focus:border-brand-bg transition-colors placeholder:text-brand-bg/30 text-sm text-brand-bg" />

                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] opacity-60 mb-3">I am a…</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { v: "creator", l: "Creator" },
                      { v: "seller", l: "Seller" },
                      { v: "both", l: "Creator & Seller" },
                    ].map((o) => {
                      const selected = role === o.v;
                      return (
                        <button
                          type="button"
                          key={o.v}
                          onClick={() => setRole(o.v)}
                          className={`px-3 py-3 text-[11px] uppercase tracking-widest font-semibold border transition-all duration-300 ${selected ? "bg-brand-accent text-brand-bg border-brand-accent shadow-[0_0_0_2px_rgba(139,115,91,0.25)]" : "bg-transparent border-white/20 text-brand-bg/80 hover:border-brand-bg/60"}`}
                          aria-pressed={selected}
                        >
                          {o.l}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-brand-bg text-brand-text text-[11px] uppercase tracking-[0.3em] font-bold mt-8 hover:bg-brand-accent hover:text-brand-bg transition-all disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Request Invite Access"}
                </button>
              </form>
            )}
            <p className="mt-8 text-[10px] opacity-40 uppercase tracking-widest leading-loose">By requesting access, you agree to our curator vetting process and privacy guidelines.</p>
          </div>
        </div>
      </section>

      <footer className="w-full py-10 md:py-12 px-4 sm:px-6 lg:px-8 border-t border-brand-text/5 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center text-[10px] uppercase tracking-widest opacity-50">
        <div>© 2026 Oakmonte Collective</div>
        <div className="flex flex-wrap gap-4 sm:gap-8">
          <a href="/terms">TERMS&nbsp;OF SERVICE&nbsp;</a>
          <a href="/privacy">PRIVACY POLICY</a>
          <a href="#">Manifesto</a>
        </div>
      </footer>
    </div>
  );
}
