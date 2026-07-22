import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import logoO from "@/assets/logo-o.png";
import oakmonteO from "@/assets/oakmonte-o-mark.png.asset.json";

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
  // register section removed
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeText = "Oakmonte is an ecosystem designed for those who expect more. We connect vetted sellers, honest creators and style curators through a content driven marketplace.";
  const typeRef = useRef<HTMLParagraphElement>(null);
  const [typedLength, setTypedLength] = useState(0);

  useEffect(() => {
    const el = typeRef.current;
    if (!el) return;
    const total = typeText.length;
    const periodIndex = typeText.indexOf('.') + 1;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (isMobile) {
      let raf = 0;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let started = false;
      const run = () => {
        const startTime = performance.now();
        const perChar = 25; // ms
        const pauseMs = 700;
        const tick = (now: number) => {
          const elapsed = now - startTime;
          let count: number;
          const preDuration = periodIndex * perChar;
          if (elapsed < preDuration) {
            count = Math.floor(elapsed / perChar);
          } else if (elapsed < preDuration + pauseMs) {
            count = periodIndex;
          } else {
            const after = elapsed - preDuration - pauseMs;
            count = Math.min(total, periodIndex + Math.floor(after / perChar));
          }
          setTypedLength(count);
          if (count < total) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      };
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started) {
            started = true;
            timer = setTimeout(run, 150);
            io.disconnect();
          }
        }
      }, { threshold: 0.4 });
      io.observe(el);
      return () => {
        io.disconnect();
        if (timer) clearTimeout(timer);
        cancelAnimationFrame(raf);
      };
    }

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

  // Re-evaluate :hover during scroll (Chrome/Safari don't update hover state
  // on scroll until the mouse moves). Track last pointer position and
  // dispatch a synthetic mousemove after each scroll tick.
  useEffect(() => {
    let lastX = -1, lastY = -1, raf = 0;
    const onMove = (e: MouseEvent) => { lastX = e.clientX; lastY = e.clientY; };
    const onScroll = () => {
      if (raf || lastX < 0) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = document.elementFromPoint(lastX, lastY);
        if (el) el.dispatchEvent(new MouseEvent("mousemove", {
          bubbles: true, cancelable: true, clientX: lastX, clientY: lastY,
        }));
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
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

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans">
      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 w-full z-50 px-4 sm:px-6 lg:px-8 flex justify-between items-center gap-3 border-b border-brand-text/5 bg-brand-bg/80 backdrop-blur-md transition-[padding] duration-300 ${scrolled ? "py-3 md:py-4" : "py-4 md:py-6"}`}>
        {mobileOpen && mobileGroup ? (
          <button
            type="button"
            onClick={() => setMobileGroup(null)}
            aria-label="Back"
            className="flex items-center gap-2 shrink-0 min-w-0 text-[12px] uppercase tracking-[0.2em] font-semibold hover:text-brand-accent transition-colors duration-300 animate-fade-in"
          >
            <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
        ) : (
          <a href="#top" className="flex items-baseline gap-0 shrink-0 min-w-0">
            {mobileOpen ? (
              <img
                src={oakmonteO.url}
                alt="Oakmonte"
                className="h-14 sm:h-16 w-auto -my-2 inline-block align-middle transition-all duration-300 animate-fade-in"
              />
            ) : (
              <>
                <img src={logoO} alt="Oakmonte" className="h-8 sm:h-10 md:h-11 w-auto inline-block align-baseline mt-1 transition-all duration-300" />
                <span className="font-sans font-normal text-2xl sm:text-3xl tracking-tight leading-none">akmonte</span>
                <span className="hidden sm:inline ml-3 text-[9px] uppercase tracking-[0.25em] opacity-40 font-sans font-normal leading-none pb-1">Style First</span>
              </>
            )}
          </a>
        )}

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
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => { setMobileOpen((v) => !v); setMobileGroup(null); }}
          >
            {mobileOpen ? (
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
                <path d="M4 4l14 14M18 4L4 18" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            ) : (
              <>
                <span className="block w-5 h-px bg-brand-text mb-1.5" />
                <span className="block w-5 h-px bg-brand-text mb-1.5" />
                <span className="block w-5 h-px bg-brand-text" />
              </>
            )}
          </button>
        </div>

      </nav>

      {/* Mobile side drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-500 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-brand-text/30"
          onClick={() => { setMobileOpen(false); setMobileGroup(null); }}
        />
        <aside
          className={`absolute top-0 right-0 h-full w-full bg-brand-bg shadow-2xl flex flex-col transition-transform duration-500 ease-out ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
        >
          {/* Drawer header spacer — top nav owns logo/back/close */}
          <div className="h-[64px] border-b border-brand-text/10" aria-hidden="true" />

          <div className="relative flex-1 overflow-hidden">
            {/* Top-level list */}
            <div
              className={`absolute inset-0 overflow-y-auto transition-transform duration-500 ease-out ${mobileGroup ? "-translate-x-full" : "translate-x-0"}`}
            >
              {(Object.keys(MENUS) as MenuKey[]).map((key) => {
                const m = MENUS[key];
                return (
                  <button
                    key={key}
                    onClick={() => setMobileGroup(key)}
                    className="w-full flex justify-between items-center px-6 py-5 text-[13px] uppercase tracking-[0.2em] font-semibold border-b border-brand-text/10 hover:bg-brand-muted/40 transition-colors"
                  >
                    {m.label}
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                      <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                );
              })}
              <a
                href="mailto:hello@oakmonte.com"
                onClick={() => setMobileOpen(false)}
                className="w-full flex justify-between items-center px-6 py-5 text-[13px] uppercase tracking-[0.2em] font-semibold border-b border-brand-text/10 hover:bg-brand-muted/40 transition-colors"
              >
                Contact us
              </a>
            </div>

            {/* Subgroup panel */}
            <div
              className={`absolute inset-0 overflow-y-auto transition-transform duration-500 ease-out ${mobileGroup ? "translate-x-0" : "translate-x-full"}`}
            >
              {mobileGroup && (
                <div>
                  <div className="px-6 pt-6 pb-3 text-[11px] uppercase tracking-[0.25em] text-brand-text/50">
                    {MENUS[mobileGroup].label}
                  </div>
                  {MENUS[mobileGroup].items.map((it) => (
                    <a
                      key={it.title}
                      href={it.href}
                      onClick={() => { setMobileOpen(false); setMobileGroup(null); }}
                      className="block px-6 py-4 border-b border-brand-text/10 hover:bg-brand-muted/40 transition-colors"
                    >
                      <div className="text-sm font-semibold">{it.title}</div>
                      <div className="text-xs text-brand-text/60 font-light mt-1 leading-snug">{it.desc}</div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

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
                <li>Track your deliveries</li>
                <li>Find and share inspirations and recommendations</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 md:mt-16 pt-10 border-t border-brand-text/10">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent font-bold mb-5 text-center">{"\n"}</p>
            <ul className="flex flex-col sm:flex-row justify-center items-start sm:items-center gap-4 sm:gap-12 text-sm text-brand-text/60 leading-relaxed list-disc list-inside sm:list-outside">
              <li>Easy transfer of content from other platforms</li>
              <li>Absolutely 0 Upfront Cost</li>
              <li>Stay scam proof</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="product" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif leading-tight mb-10 md:mb-16">
            Eliminate the Friction.<br />
            <span className="italic">Elevate the Sale.</span>
          </h2>

          {/* Hero feature card with phone mockup */}
          <FeatureBox className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center p-6 sm:p-10 md:p-14 mb-6 md:mb-8">
            <div>
              <h3 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-tight leading-[0.95] mb-6">
                Content to Cart
              </h3>
              <p className="text-sm sm:text-base text-brand-text/70 leading-relaxed max-w-[46ch]">
                Buy directly from creative content — not third party links, all within the native oakmonte interface meaning Higher sale conversion rate for sellers and Easyier collaboration with creators.
              </p>
            </div>
            <div className="flex justify-center md:justify-end">
              <PhoneMockup src="/videos/content-to-cart-demo.mp4" />
            </div>
          </FeatureBox>

          {/* 2-column bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <FeatureBox className="p-6 sm:p-8 md:p-10">
              <h3 className="text-2xl sm:text-3xl font-serif mb-2">Stay Scam Proof</h3>
              <p className="text-xs sm:text-sm font-display uppercase tracking-[0.15em] mb-5 text-brand-text/80">Stop Getting Scammed</p>
              <div className="space-y-3 text-sm text-brand-text/70 leading-relaxed">
                <p>No payment reaches any seller without customer satisfaction, no fast-fashion noise, just curated luxury and authentic pieces.</p>
                <p>Creators won't make numbers and not get paid.</p>
                <p>Sellers won't get one-upped by crafty curators — every complaint goes through a thorough dispute pipeline.</p>
              </div>
            </FeatureBox>

            <FeatureBox className="p-6 sm:p-8 md:p-10">
              <h3 className="text-2xl sm:text-3xl font-serif mb-5">Find Your Fit</h3>
              <p className="text-sm text-brand-text/70 leading-relaxed">
                A dedicated recommendation system tailored to improve curator-piece fit, and reduce returns as all pieces go through our personal size chart.
              </p>
            </FeatureBox>

            <FeatureBox className="p-6 sm:p-8 md:p-10">
              <h3 className="text-2xl sm:text-3xl font-serif mb-2">Customizable Storefronts</h3>
              <p className="text-xs sm:text-sm font-display uppercase tracking-[0.15em] mb-5 text-brand-text/80">Who Needs A Website?</p>
              <p className="text-sm text-brand-text/70 leading-relaxed">
                Oakmonte offers a fully customizable storefront in-app so your customers can feel your aesthetic at a glance. This means improved customer retention, visibility, and wider profit margins.
              </p>
            </FeatureBox>

            <FeatureBox className="p-6 sm:p-8 md:p-10">
              <h3 className="text-2xl sm:text-3xl font-serif mb-5">Handled Logistics</h3>
              <p className="text-sm text-brand-text/70 leading-relaxed">
                Get a dedicated delivery service for your brand and a purposefully designed seller dashboard to handle sales and marketing, on and off Oakmonte.
              </p>
            </FeatureBox>

            <FeatureBox className="p-6 sm:p-8 md:p-10">
              <h3 className="text-2xl sm:text-3xl font-serif mb-5">Seller &amp; Creator Accountability</h3>
              <p className="text-sm text-brand-text/70 leading-relaxed">
                Unlike other marketplaces, every product is easily traced back to the creator or seller who promoted it. Fair credit, transparent payout.
              </p>
            </FeatureBox>

            <FeatureBox className="p-6 sm:p-8 md:p-10">
              <h3 className="text-2xl sm:text-3xl font-serif mb-5">Improved Marketing</h3>
              <p className="text-sm text-brand-text/70 leading-relaxed">
                Get help from us to tell the stories behind your brand — raising your products beyond their functional value.
              </p>
            </FeatureBox>
          </div>

          {/* Full width closing feature */}
          <FeatureBox className="mt-6 md:mt-8 p-6 sm:p-10 md:p-14">
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-display uppercase tracking-tight leading-[0.95] mb-6">
              Oakmonte Studio
            </h3>
            <p className="text-sm sm:text-base text-brand-text/70 leading-relaxed max-w-[70ch]">
              A dedicated dashboard for creators to produce and upload premium content, manage and flex collaborations, maintain customer relationships, and earn money.
            </p>
          </FeatureBox>
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

function FeatureBox({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { setVisible(true); io.disconnect(); break; }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`border border-brand-text/15 bg-brand-bg transition-all duration-500 ease-out hover:border-brand-text hover:-translate-y-[2px] ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} ${className}`}
    >
      {children}
    </div>
  );
}

function PhoneMockup({ src }: { src: string }) {
  return (
    <div className="relative w-[220px] sm:w-[240px] md:w-[260px] aspect-[9/19.5] rounded-[2.25rem] border border-brand-text/80 bg-brand-text p-[6px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.35)]">
      <div className="relative w-full h-full rounded-[1.85rem] overflow-hidden bg-brand-muted">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 h-[22px] w-[90px] rounded-full bg-brand-text" aria-hidden="true" />
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
