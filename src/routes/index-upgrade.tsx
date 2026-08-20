import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode, ElementType } from "react";
import logoO from "@/assets/logo-o.png";
import editorial1 from "@/assets/editorial-1.jpg";
import editorial2 from "@/assets/editorial-2.jpg";
import editorial3 from "@/assets/editorial-3.jpg";
import { useSession } from "@/hooks/use-session";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/index-upgrade")({
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
  component: IndexUpgrade,
});

/* ---------------- Data ---------------- */
const NAV_ITEMS = [
  { label: "Product", href: "#product", key: "PRODUCT" },
  { label: "Story", href: "#story", key: "STORY" },
  { label: "Solutions", href: "#solutions", key: "SOLUTIONS" },
  { label: "FAQ", href: "#faq", key: "FAQ" },
];

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
    who: "David — Seller",
  },
  {
    text: "I share pieces I actually believe in — and I get credit for every sale it drives.",
    who: "Jamal — Creator",
  },
  {
    text: "The size chart alone saved me two returns in my first week.",
    who: "Nathan — Curator",
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
  ...rest
}: {
  children: ReactNode;
  delay?: 0 | 1 | 2 | 3;
  className?: string;
  as?: ElementType;
} & Record<string, unknown>) {
  const { ref, className: rc } = useReveal<HTMLDivElement>();
  const delayClass = delay ? ` reveal-delay-${delay}` : "";
  return (
    <Tag ref={ref} className={`${rc}${delayClass} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

/* Word-by-word masked reveal — the big editorial headline move. */
function SplitText({
  text,
  className = "",
  as: Tag = "h2",
}: {
  text: string;
  className?: string;
  as?: ElementType;
}) {
  const { ref, className: rc } = useReveal<HTMLHeadingElement>();
  const words = text.split(" ");
  return (
    <Tag ref={ref} className={`split-text ${rc} ${className}`.trim()}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`}>
          <span className="sw">
            <span style={{ transitionDelay: `${i * 55}ms` }}>{w}</span>
          </span>
        </span>
      ))}
    </Tag>
  );
}

/* Scroll progress + cursor + magnetic buttons + card tilt.
   All DOM-level so the markup stays readable. */
function useKineticLayer() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const bar = document.querySelector<HTMLElement>(".oak .scroll-progress i");
    const dot = document.querySelector<HTMLElement>(".oak .cursor-dot");
    const halo = document.querySelector<HTMLElement>(".oak .cursor-halo");

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let hx = mx;
    let hy = my;
    let raf = 0;

    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? window.scrollY / h : 0;
      if (bar) bar.style.transform = `scaleX(${p})`;
      document.querySelectorAll<HTMLElement>(".oak [data-parallax]").forEach((el) => {
        const speed = Number(el.dataset.parallax || 0);
        const r = el.getBoundingClientRect();
        const off = (r.top + r.height / 2 - window.innerHeight / 2) * speed;
        el.style.setProperty("--py", `${off.toFixed(2)}px`);
      });
    };

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (dot) dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%,-50%)`;
    };

    const tick = () => {
      hx += (mx - hx) * 0.13;
      hy += (my - hy) * 0.13;
      if (halo) halo.style.transform = `translate3d(${hx}px, ${hy}px, 0) translate(-50%,-50%)`;
      raf = requestAnimationFrame(tick);
    };

    // Magnetic buttons
    const magnets = Array.from(document.querySelectorAll<HTMLElement>(".oak .cta-btn"));
    const magnetMove = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.25;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.35;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const magnetLeave = (e: MouseEvent) => {
      (e.currentTarget as HTMLElement).style.transform = "";
    };
    magnets.forEach((m) => {
      m.addEventListener("mousemove", magnetMove);
      m.addEventListener("mouseleave", magnetLeave);
    });

    // 3D tilt on cards
    const tilts = Array.from(document.querySelectorAll<HTMLElement>(".oak [data-tilt]"));
    const tiltMove = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) translateY(-6px)`;
      el.style.setProperty("--gx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--gy", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    const tiltLeave = (e: MouseEvent) => {
      (e.currentTarget as HTMLElement).style.transform = "";
    };
    tilts.forEach((t) => {
      t.addEventListener("mousemove", tiltMove);
      t.addEventListener("mouseleave", tiltLeave);
    });

    // Cursor grows over interactive things
    const hoverables = Array.from(
      document.querySelectorAll<HTMLElement>(".oak a, .oak button, .oak [data-tilt]"),
    );
    const grow = () => halo?.classList.add("grow");
    const shrink = () => halo?.classList.remove("grow");
    hoverables.forEach((h) => {
      h.addEventListener("mouseenter", grow);
      h.addEventListener("mouseleave", shrink);
    });

    onScroll();
    raf = requestAnimationFrame(tick);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("mousemove", onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("mousemove", onMove);
      magnets.forEach((m) => {
        m.removeEventListener("mousemove", magnetMove);
        m.removeEventListener("mouseleave", magnetLeave);
      });
      tilts.forEach((t) => {
        t.removeEventListener("mousemove", tiltMove);
        t.removeEventListener("mouseleave", tiltLeave);
      });
      hoverables.forEach((h) => {
        h.removeEventListener("mouseenter", grow);
        h.removeEventListener("mouseleave", shrink);
      });
    };
  }, []);
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

/* ---------------- Auth ---------------- */
function HeaderAuth() {
  const { user, loading } = useSession();
  const [open, setOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProfileUsername(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("personal_username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfileUsername(data?.personal_username ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return <div style={{ width: 96, height: 36 }} aria-hidden="true" />;
  }

  if (!user) {
    const handleSignIn = async () => {
      const { error } = await signInWithGoogle();
      if (error) {
        console.error("Google sign-in failed", error);
      }
    };
    return (
      <button type="button" className="cta-btn ghost small" onClick={() => void handleSignIn()}>
        Sign in
      </button>
    );
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const fullName = str(meta.full_name) ?? str(meta.name);
  const secondWord = fullName ? (fullName.split(/\s+/)[1] ?? null) : null;
  const providerSecondName = str(meta.family_name) ?? str(meta.last_name) ?? secondWord ?? fullName;
  const label = profileUsername ?? providerSecondName ?? user.email?.split("@")[0] ?? "Account";
  const short = label.length > 18 ? label.slice(0, 16) + "…" : label;

  return (
    <div className="auth-wrap">
      <button type="button" className="cta-btn ghost small" onClick={() => setOpen((v) => !v)}>
        {short}
      </button>
      <div className={`auth-menu${open ? " open" : ""}`}>
        {profileUsername && (
          <Link
            to="/profile/$username"
            params={{ username: profileUsername }}
            onClick={() => setOpen(false)}
          >
            View profile
          </Link>
        )}
        <button
          type="button"
          onClick={async () => {
            setOpen(false);
            await signOut();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ---------------- Shared bits ---------------- */
const EDITORIAL: Record<string, { src: string; alt: string }[]> = {
  "on-black": [
    { src: editorial1, alt: "Model in an oversized tailored coat" },
    { src: editorial3, alt: "Creator photographing an outfit" },
  ],
  "on-blue": [
    { src: editorial2, alt: "Close-up of layered garment fabric" },
    { src: editorial1, alt: "Model in an oversized tailored coat" },
  ],
  "on-light": [
    { src: editorial3, alt: "Creator photographing an outfit" },
    { src: editorial2, alt: "Close-up of layered garment fabric" },
  ],
};

function BrandArt({
  variant,
  caption,
}: {
  variant: "on-black" | "on-blue" | "on-light";
  caption: string;
}) {
  const shots = EDITORIAL[variant]!;
  return (
    <div className={`brand-art ${variant}`}>
      <div className="ed-stack">
        {shots.map((s, i) => (
          <figure key={s.src} className={`ed-frame ed-frame-${i + 1}`}>
            <img src={s.src} alt={s.alt} loading="lazy" width={1024} height={1280} />
            <span className="ed-sheen" />
          </figure>
        ))}
      </div>
      <span className="ed-tint" />
      <span className="cap">{caption}</span>
    </div>
  );
}


// The three real onboarding paths — reused in the hero and the closing CTA so
// visitors are never more than one section away from a working next step.
// The routes each button leads to are still rough (WIP), but where a visitor
// lands from here is correct and final.
function RoleCtaRow() {
  return (
    <div className="role-cta-row">
      <Link to="/set-up-store" className="cta-btn">
        Set up a store
      </Link>
      <Link to="/become-a-creator" className="cta-btn">
        Become a creator
      </Link>
      <Link to="/become-a-curator" className="cta-btn ghost">
        Define your wardrobe
      </Link>
    </div>
  );
}

/* ---------------- Page ---------------- */
function IndexUpgrade() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState("PRODUCT");

  useKineticLayer();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setActiveNav(window.scrollY > window.innerHeight * 0.6 ? "STORY" : "PRODUCT");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="oak">
      <style>{CSS}</style>

      <div className="scroll-progress" aria-hidden="true">
        <i />
      </div>
      <div className="cursor-dot" aria-hidden="true" />
      <div className="cursor-halo" aria-hidden="true" />

      <header style={{ boxShadow: scrolled ? "0 1px 0 rgba(0,0,0,.06)" : "none" }}>
        <div className="wrap">
          <div className="header-row">
            <Link to="/" className="brand">
              <img src={logoO} alt="Oakmonte" />
              <span className="word">
                Oak<span>monte</span>
              </span>
            </Link>

            <nav className="desktop-nav">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  className={`roll${activeNav === item.key ? " active" : ""}`}
                >
                  <span className="roll-inner">
                    <span>{item.label}</span>
                    <span aria-hidden="true">{item.label}</span>
                  </span>
                </a>
              ))}
            </nav>

            <div className="desktop-auth">
              <HeaderAuth />
            </div>

            <button
              className="mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
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
            {NAV_ITEMS.map((item) => (
              <a key={item.key} href={item.href} onClick={() => setMobileOpen(false)}>
                {item.label}
              </a>
            ))}
            <div className="mobile-auth">
              <HeaderAuth />
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

            <RoleCtaRow />

            <p className="trust-line">
              <span className="stars">★★★★★</span>
              *No catches, no fine print — just fashion commerce done right.{" "}
              <b>Loved by our early community.</b>
            </p>

            <div className="hero-media" data-parallax="0.06">
              <BrandArt variant="on-black" caption="Sell · Share · Shop — all in one place" />
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
              <SplitText text="Fashion commerce shouldn't feel like a gamble." />
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

              <Reveal delay={2} className="story-media" data-parallax="0.08">
                <BrandArt variant="on-blue" />
              </Reveal>
            </div>
          </div>
        </section>

        {/* OFFERING */}
        <section className="offering">
          <div className="wrap">
            <Reveal className="offering-head">
              <SplitText text="Pick your path." />
              <p>Whichever side of the closet you're on, Oakmonte has a place for you.</p>
            </Reveal>
            <div className="offering-grid">
              <Reveal className="offer-card blue" data-tilt>
                <span className="tag">For sellers</span>
                <h3>Sell With Oakmonte</h3>
                <p>
                  Open a store, list your pieces, and let creators drive traffic — with payment that
                  only releases once your customer's happy. No chargeback roulette.
                </p>
                <Link to="/set-up-store" className="cta-btn on-black">
                  Set up a store
                </Link>
                <p className="stars-line">
                  <span className="stars">★★★★★</span>Loved by our early sellers
                </p>
              </Reveal>
              <Reveal delay={1} className="offer-card black" data-tilt>
                <span className="tag">For creators</span>
                <h3>Create &amp; Get Paid</h3>
                <p>
                  Share pieces you actually believe in and get paid for every sale your content
                  drives — with real collaboration tools, not empty promises.
                </p>
                <Link to="/become-a-creator" className="cta-btn on-black">
                  Become a creator
                </Link>
                <p className="stars-line">
                  <span className="stars">★★★★★</span>Loved by our early creators
                </p>
              </Reveal>
              <Reveal delay={2} className="offer-card" data-tilt>
                <span className="tag">For curators &amp; shoppers</span>
                <h3>Shop &amp; Curate</h3>
                <p>
                  Find pieces matched to your actual size, track every delivery, and share the finds
                  worth talking about — all backed by our dispute pipeline.
                </p>
                <Link to="/become-a-curator" className="cta-btn">
                  Define your wardrobe
                </Link>
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
              <Reveal delay={1} className="scale-media" data-parallax="0.08">
                <BrandArt variant="on-light" />
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
              <SplitText text="Why people choose Oakmonte." />
            </Reveal>
            <Reveal as="p" className="value-note">
              Sample layout — swap in real customer quotes once you have them.
            </Reveal>
            <div className="quotes-grid">
              {QUOTES.map((q, i) => (
                <Reveal key={q.who} delay={i as 0 | 1 | 2} className="quote-card" data-tilt>
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
              <RoleCtaRow />
            </Reveal>
          </div>
        </section>

        <footer>
          <div className="wrap footer-row">
            <div className="footer-brand">
              <img src={logoO} alt="Oakmonte" />
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
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
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

.oak header{position:sticky;top:0;z-index:100;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);transition:box-shadow .3s ease;}
.oak .header-row{display:flex;align-items:center;justify-content:space-between;height:72px;}
.oak .brand{display:flex;align-items:center;gap:10px;}
.oak .brand img{height:32px;width:auto;}
.oak .footer-brand img{height:26px;width:auto;filter:brightness(0) invert(1);}
.oak .brand .word{font-weight:800;font-size:15px;letter-spacing:-.01em;}
.oak .brand .word span{color:var(--blue);}

.oak nav.desktop-nav{display:flex;align-items:center;gap:36px;}
.oak nav.desktop-nav a{font-size:13px;font-weight:600;position:relative;padding:4px 0;}
.oak nav.desktop-nav a::after{content:"";position:absolute;left:0;bottom:-2px;width:0;height:2px;background:var(--blue);transition:width .25s ease;}
.oak nav.desktop-nav a:hover::after,.oak nav.desktop-nav a.active::after{width:100%;}
.oak nav.desktop-nav a.active{color:var(--blue);}

.oak .cta-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;background:var(--black);color:var(--white);font-size:13px;font-weight:700;border-radius:999px;transition:transform .25s ease,background .25s ease;white-space:nowrap;}
.oak .cta-btn:hover{background:var(--blue);transform:translateY(-2px);}
.oak .cta-btn.ghost{background:transparent;color:var(--black);border:1.5px solid var(--black);}
.oak .cta-btn.ghost:hover{background:var(--black);color:var(--white);}
.oak .cta-btn.small{padding:10px 20px;font-size:12px;}
.oak .cta-btn.big{padding:18px 38px;font-size:15px;}
.oak .cta-btn.on-black{background:var(--blue);}
.oak .cta-btn.on-black:hover{background:var(--white);color:var(--black);}

.oak .role-cta-row{display:grid;grid-template-columns:1fr;gap:14px;}
@media (min-width:640px){.oak .role-cta-row{grid-template-columns:repeat(3,1fr);}}
.oak .hero .role-cta-row{max-width:640px;margin-bottom:18px;opacity:0;animation:oakFadeUp .7s ease forwards;animation-delay:.68s;}
.oak .closing-cta .role-cta-row{max-width:640px;margin:0 auto;}

.oak .desktop-auth{display:flex;align-items:center;gap:14px;}
.oak .auth-wrap{position:relative;}
.oak .auth-menu{position:absolute;right:0;margin-top:10px;width:200px;background:var(--white);border:1px solid var(--line);border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,.12);z-index:50;display:none;overflow:hidden;}
.oak .auth-menu.open{display:block;}
.oak .auth-menu a,.oak .auth-menu button{display:block;width:100%;text-align:left;padding:13px 16px;font-size:13px;font-weight:600;}
.oak .auth-menu a:hover,.oak .auth-menu button:hover{background:#F4F5F7;color:var(--blue);}

.oak .mobile-toggle{display:none;padding:8px;}
.oak .mobile-toggle span{display:block;width:22px;height:2px;background:var(--black);margin-bottom:6px;}
.oak .mobile-toggle span:last-child{margin-bottom:0;}
.oak .mobile-menu{display:none;border-top:1px solid var(--line);}
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

.oak .trust-line{font-size:13px;color:var(--gray);font-weight:500;opacity:0;animation:oakFadeUp .7s ease forwards;animation-delay:.8s;}
.oak .trust-line b{color:var(--black);}
.oak .stars{color:var(--blue);letter-spacing:2px;margin-right:6px;}

.oak .hero-media{position:relative;margin-top:56px;border-radius:24px;overflow:hidden;aspect-ratio:16/7;opacity:0;animation:oakFadeUp .9s ease forwards;animation-delay:.9s;background:#111;}
.oak .media-cap{position:absolute;left:24px;bottom:20px;z-index:3;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6);}

/* Editorial fashion panels — layered photo frames with slow motion */
.oak .brand-art{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.oak .brand-art.on-black{background:radial-gradient(circle at 30% 30%,#132057 0%,var(--black) 65%);}
.oak .brand-art.on-blue{background:linear-gradient(135deg,var(--blue) 0%,#0d2c9e 100%);}
.oak .brand-art.on-light{background:#EFF2FA;}
.oak .brand-art .ed-stack{position:absolute;inset:0;z-index:1;}
.oak .brand-art .ed-frame{position:absolute;margin:0;overflow:hidden;border-radius:14px;box-shadow:0 30px 70px rgba(0,0,0,.38);will-change:transform;}
.oak .brand-art .ed-frame img{width:100%;height:100%;object-fit:cover;object-position:50% 22%;transform-origin:center;animation:oakKen 18s ease-in-out infinite alternate;}
.oak .brand-art .ed-frame-1{top:8%;bottom:8%;left:6%;width:52%;animation:oakDrift 9s ease-in-out infinite;}
.oak .brand-art .ed-frame-2{top:14%;bottom:14%;right:6%;width:34%;animation:oakDrift 11s ease-in-out infinite reverse;}
.oak .brand-art .ed-frame-2 img{animation-duration:22s;animation-direction:alternate-reverse;}
.oak .brand-art .ed-sheen{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);transform:translateX(-120%);animation:oakSheen 7s ease-in-out infinite;}
.oak .brand-art .ed-frame-2 .ed-sheen{animation-delay:1.6s;}
.oak .brand-art .ed-tint{position:absolute;inset:0;z-index:2;pointer-events:none;}
.oak .brand-art.on-blue .ed-tint{background:linear-gradient(135deg,rgba(33,81,245,.42),rgba(13,44,158,.25));mix-blend-mode:multiply;}
.oak .brand-art.on-black .ed-tint{background:linear-gradient(180deg,rgba(10,10,10,.1),rgba(10,10,10,.55));}
.oak .brand-art.on-light .ed-tint{background:linear-gradient(180deg,transparent 55%,rgba(10,10,10,.18));}
@keyframes oakKen{from{transform:scale(1.02);}to{transform:scale(1.14) translate3d(-1.5%,-1.5%,0);}}
@keyframes oakDrift{0%,100%{transform:translate3d(0,0,0) rotate(0deg);}50%{transform:translate3d(0,-14px,0) rotate(-.6deg);}}
@keyframes oakSheen{0%,62%{transform:translateX(-120%);}88%,100%{transform:translateX(120%);}}
.oak .brand-art:hover .ed-frame-1{transform:translate3d(-6px,-8px,0) scale(1.01);}
.oak .brand-art:hover .ed-frame-2{transform:translate3d(8px,6px,0) scale(1.03);}
.oak .brand-art .ed-frame{transition:transform .6s cubic-bezier(.22,1,.36,1);}
.oak .brand-art .cap{position:absolute;left:24px;bottom:20px;z-index:3;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
.oak .brand-art.on-black .cap,.oak .brand-art.on-blue .cap{color:#fff;}
.oak .brand-art.on-light .cap{color:var(--black);}
@media (max-width:640px){
  .oak .brand-art .ed-frame-1{inset:6% 26% 6% 6%;}
  .oak .brand-art .ed-frame-2{width:38%;right:5%;}
}


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

.oak .offering{padding:100px 0;}
.oak .offering-head{max-width:36rem;margin-bottom:48px;}
.oak .offering-head h2{font-family:var(--display);font-size:clamp(30px,4.5vw,56px);line-height:1;text-transform:uppercase;margin:0 0 16px;}
.oak .offering-head p{font-size:16px;color:var(--gray);line-height:1.6;}
.oak .offering-grid{display:grid;grid-template-columns:1fr;gap:24px;}
@media (min-width:640px){.oak .offering-grid{grid-template-columns:repeat(2,1fr);}}
@media (min-width:1024px){.oak .offering-grid{grid-template-columns:repeat(3,1fr);}}
.oak .offer-card{border:2px solid var(--black);border-radius:22px;padding:40px 32px;position:relative;overflow:hidden;transition:transform .3s ease,box-shadow .3s ease;background:var(--white);display:flex;flex-direction:column;}
.oak .offer-card:hover{transform:translateY(-6px);box-shadow:0 24px 48px rgba(10,10,10,.12);}
.oak .offer-card.blue{background:var(--blue);color:#fff;border-color:var(--blue);}
.oak .offer-card.black{background:var(--black);color:#fff;border-color:var(--black);}
.oak .offer-card .tag{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px;display:block;}
.oak .offer-card.blue .tag,.oak .offer-card.black .tag{color:rgba(255,255,255,.8);}
.oak .offer-card:not(.blue):not(.black) .tag{color:var(--blue);}
.oak .offer-card h3{font-family:var(--display);font-size:clamp(22px,3vw,30px);text-transform:uppercase;margin:0 0 16px;line-height:1.05;}
.oak .offer-card p{font-size:15px;line-height:1.6;margin:0 0 28px;flex:1;}
.oak .offer-card:not(.blue):not(.black) p{color:var(--gray);}
.oak .offer-card.blue p,.oak .offer-card.black p{color:rgba(255,255,255,.85);}
.oak .offer-card .cta-btn{align-self:flex-start;}
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

/* ---------- Kinetic layer ---------- */
.oak .scroll-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:300;pointer-events:none;background:transparent;}
.oak .scroll-progress i{display:block;height:100%;width:100%;transform:scaleX(0);transform-origin:0 50%;background:linear-gradient(90deg,var(--blue),#6E8CFF,var(--black));}

.oak .cursor-dot,.oak .cursor-halo{position:fixed;top:0;left:0;z-index:400;pointer-events:none;border-radius:50%;mix-blend-mode:difference;}
.oak .cursor-dot{width:7px;height:7px;background:#fff;}
.oak .cursor-halo{width:38px;height:38px;border:1.5px solid rgba(255,255,255,.85);transition:width .3s cubic-bezier(.16,1,.3,1),height .3s cubic-bezier(.16,1,.3,1),background .3s ease;}
.oak .cursor-halo.grow{width:76px;height:76px;background:rgba(255,255,255,.16);}
@media (hover:none),(max-width:900px){.oak .cursor-dot,.oak .cursor-halo,.oak .scroll-progress{display:none;}}

.oak .split-text{overflow:hidden;}
.oak .split-text .sw{display:inline-block;overflow:hidden;vertical-align:bottom;padding-bottom:.1em;margin-bottom:-.1em;margin-right:.16em;}
.oak .split-text .sw > span{display:inline-block;transform:translateY(110%) rotate(4deg);opacity:0;transition:transform .85s cubic-bezier(.16,1,.3,1),opacity .6s ease;}
.oak .split-text.in-view .sw > span{transform:translateY(0) rotate(0);opacity:1;}

.oak nav.desktop-nav a.roll{overflow:hidden;display:inline-block;height:1.25em;line-height:1.25em;}
.oak nav.desktop-nav a.roll .roll-inner{display:flex;flex-direction:column;transition:transform .45s cubic-bezier(.16,1,.3,1);}
.oak nav.desktop-nav a.roll:hover .roll-inner{transform:translateY(-1.25em);}
.oak nav.desktop-nav a.roll .roll-inner span:last-child{color:var(--blue);}

.oak [data-parallax]{will-change:transform;}
.oak [data-parallax] > *{transform:translate3d(0,calc(var(--py,0px) * -1),0);transition:transform .1s linear;}

.oak [data-tilt]{transform-style:preserve-3d;transition:transform .5s cubic-bezier(.16,1,.3,1),box-shadow .4s ease;position:relative;}
.oak [data-tilt]::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .35s ease;background:radial-gradient(320px circle at var(--gx,50%) var(--gy,50%),rgba(33,81,245,.18),transparent 65%);}
.oak [data-tilt]:hover::after{opacity:1;}
.oak .offer-card:hover{transform:none;}

.oak .cta-btn{position:relative;overflow:hidden;transition:transform .35s cubic-bezier(.16,1,.3,1),background .35s ease,color .35s ease;isolation:isolate;}
.oak .cta-btn::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--blue);transform:translateY(101%);border-radius:inherit;transition:transform .45s cubic-bezier(.16,1,.3,1);}
.oak .cta-btn:hover::before{transform:translateY(0);}
.oak .cta-btn:hover{background:var(--black);}
.oak .cta-btn.ghost:hover{color:var(--white);background:transparent;}

.oak .reveal{transform:translateY(34px) scale(.985);}
.oak .reveal.in-view{transform:translateY(0) scale(1);}

.oak .marquee:hover .marquee-track,.oak .trust-marquee:hover .track{animation-play-state:paused;}

.oak .faq-item{transition:background .3s ease,padding-left .3s ease;}
.oak .faq-item:hover{background:rgba(33,81,245,.04);padding-left:10px;}

.oak .stat b{transition:transform .4s cubic-bezier(.16,1,.3,1),color .3s ease;display:inline-block;}
.oak .stat:hover b{transform:translateY(-6px) scale(1.06);color:var(--blue);}

.oak .hero::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(10,10,10,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(10,10,10,.045) 1px,transparent 1px);background-size:64px 64px;-webkit-mask-image:radial-gradient(circle at 60% 20%,#000,transparent 72%);mask-image:radial-gradient(circle at 60% 20%,#000,transparent 72%);animation:oakGrid 24s linear infinite;}
@keyframes oakGrid{to{background-position:64px 64px,64px 64px;}}

@media (prefers-reduced-motion:reduce){
  .oak .cursor-dot,.oak .cursor-halo{display:none;}
  .oak .split-text .sw > span{transform:none;opacity:1;}
}
`;
