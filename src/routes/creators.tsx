import { createFileRoute, Link } from "@tanstack/react-router";
import { ogImageMeta } from "@/lib/og-image";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import logoO from "@/assets/logo-o.png";

const TITLE = "Oakmonte for Creators — Get paid for the content you create";
const DESCRIPTION =
  "Tag products in your fits, reviews and hauls. When your audience buys through your content, you earn. No invoices, no chasing brands, no middlemen.";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      // White page, so the iOS status strip must be white too — see the
      // theme-color note in __root.tsx.
      { name: "theme-color", content: "#ffffff" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      ...ogImageMeta("creators", "Oakmonte for creators: Tag the fit. Get paid for the sale."),
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: CreatorsLanding,
});

/* ---------------- Data ---------------- */
const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Hero demo. Every figure here is illustrative and the card says so.
const PIECES = [
  { n: "Cargo trousers", p: 18500, x: "46%", y: "52%" },
  { n: "Oversized bomber", p: 32000, x: "70%", y: "28%" },
  { n: "Chunky sneakers", p: 27500, x: "38%", y: "86%" },
];

const CHIPS: {
  label: string;
  side: "left" | "right";
  offset: string;
  top: string;
  delay: number;
}[] = [
  { label: "Escrow protected", side: "left", offset: "-34px", top: "18%", delay: 0 },
  { label: "Creator verified", side: "right", offset: "-26px", top: "46%", delay: 1.3 },
  // 68%, not the source design's 82%: that landed on top of the price in the
  // tag card below and hid the one number the demo exists to show.
  { label: "Paid for what you drive", side: "left", offset: "-20px", top: "68%", delay: 2.4 },
];

const HEADLINE = [
  ["Tag", "the", "fit."],
  ["Get", "paid"],
  ["for", "the", "sale."],
];

type CaseKey = "Fits" | "Reviews" | "Hauls";
const CASE_KEYS: CaseKey[] = ["Fits", "Reviews", "Hauls"];
const CASES: Record<CaseKey, { t: string; d: string; i: [string, string][] }> = {
  Fits: {
    t: "Post the fit, tag every piece",
    d: "Show your outfit the way you already do. Tag the trousers, the jacket, the shoes. Every tag is a link back to the seller's piece.",
    i: [
      ["Cargo trousers", "tagged"],
      ["Oversized bomber", "tagged"],
      ["Chunky sneakers", "tagged"],
    ],
  },
  Reviews: {
    t: "Review it, and earn when people trust you",
    d: "Say what you really think of a piece. Viewers who buy through your review are tracked back to you automatically.",
    i: [
      ["Fit check: bomber jacket", "review"],
      ["Is the fabric worth it?", "review"],
      ["Wash test, week 2", "review"],
    ],
  },
  Hauls: {
    t: "Turn a haul into income",
    d: "Unbox five pieces from five sellers. Tag them all in one post and each sale is credited to you, with no separate deal for each brand.",
    i: [
      ["Thrift haul, 5 sellers", "haul"],
      ["Tailor-made set", "haul"],
      ["Streetwear drop", "haul"],
    ],
  },
};

const STEPS: [string, string][] = [
  ["Tag the pieces", "Add products from any Oakmonte store to your fits, reviews or hauls."],
  ["Share your link", "Your audience clicks through to the piece. The link carries your name."],
  [
    "Sales are tracked",
    "Every sale you drive is tracked automatically. Nothing to log or invoice.",
  ],
  [
    "Escrow holds the payment",
    "The buyer's money sits in escrow until they confirm they're satisfied.",
  ],
  [
    "You earn your share",
    "You're paid for the sales you drove. Disputes go through review before money moves.",
  ],
];

const FAQ: [string, string][] = [
  [
    "How do creators get paid?",
    "Creators earn a share of the sales they drive through their shared links, tracked automatically through the platform.",
  ],
  [
    "Is there a fee to join?",
    "Creating an account is free, and creators pay no fees at all. What you earn is yours.",
  ],
  [
    "Will I get paid if a buyer disputes?",
    "Every complaint runs through a real dispute pipeline first. Payment only reaches a seller once the customer is satisfied.",
  ],
  [
    "Do I need to run a business?",
    "No. Whether you're clearing your closet or running a full storefront, Oakmonte scales with you.",
  ],
];

const MARQUEE = [
  "Tag it",
  "Share it",
  "Earn from it",
  "Escrow protected",
  "Creator verified",
  "Paid for what you drive",
];

/* ---------------- Hooks / small components ---------------- */
function useInView<T extends HTMLElement>(threshold = 0.15, rootMargin = "0px") {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);
  return [ref, seen] as const;
}

function Reveal({
  children,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  as?: React.ElementType;
  className?: string;
}) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <Tag ref={ref} className={`rv ${className}${seen ? " in" : ""}`.trim()}>
      {children}
    </Tag>
  );
}

function H2({ children }: { children: ReactNode }) {
  const [ref, seen] = useInView<HTMLHeadingElement>(0, "0px 0px -8% 0px");
  return (
    <h2 ref={ref} className={`h2r${seen ? " in" : ""}`}>
      {children}
    </h2>
  );
}

// Tweens from wherever it currently is, so a slider dragged mid-animation
// never snaps back to the previous target first.
function Num({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = current.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = start + (value - start) * eased;
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{naira(shown)}</>;
}

/* ---------------- Hero ---------------- */
type Spark = { id: number; x: string; y: string; dx: number; dy: number; d: number };

function Hero() {
  const [on, setOn] = useState<number[]>([0]);
  const [sales, setSales] = useState(0);
  const [toast, setToast] = useState<{ k: number; t: string } | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const fitRef = useRef<HTMLDivElement | null>(null);
  const sparkId = useRef(0);
  const total = on.reduce((sum, i) => sum + (PIECES[i]?.p ?? 0), 0);

  useEffect(() => {
    if (on.length === 0) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      const i = on[Math.floor(Math.random() * on.length)];
      const piece = i === undefined ? undefined : PIECES[i];
      if (!piece) return;
      setSales((s) => s + 1);
      setToast({ k: Date.now(), t: "Sale on " + piece.n });
      clearTimeout(hide);
      hide = setTimeout(() => setToast(null), 2200);
    }, 3400);
    return () => {
      clearInterval(id);
      clearTimeout(hide);
    };
  }, [on]);

  // Tilt is written straight to the element: a state update per pointer move
  // would re-render the whole hero (and its sale timer) 60 times a second.
  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = fitRef.current;
    if (!el || e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const b = el.getBoundingClientRect();
    const rx = ((e.clientY - b.top) / b.height - 0.5) * -12;
    const ry = ((e.clientX - b.left) / b.width - 0.5) * 14;
    el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  };
  const untilt = () => {
    if (fitRef.current) fitRef.current.style.transform = "";
  };

  const toggle = (i: number) => {
    setOn((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));
    const piece = PIECES[i];
    if (!piece || prefersReducedMotion()) return;
    const burst: Spark[] = Array.from({ length: 14 }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 50;
      return {
        id: ++sparkId.current,
        x: piece.x,
        y: piece.y,
        dx: Math.cos(a) * r,
        dy: Math.sin(a) * r,
        d: 0.8 + Math.random() * 0.4,
      };
    });
    setSparks((s) => [...s, ...burst]);
  };

  let wordIndex = 0;
  return (
    <div className="hero">
      <div>
        <h1>
          {HEADLINE.map((line, li) => (
            <span key={li} style={{ display: "block" }}>
              {line.map((word) => {
                const i = wordIndex++;
                return (
                  <span className="w" key={i}>
                    <span style={{ "--i": i } as CSSProperties}>{word}&nbsp;</span>
                  </span>
                );
              })}
            </span>
          ))}
        </h1>
        <p className="lead">
          Tag products in your fits, reviews and hauls. When your audience buys through your
          content, you earn. No invoices, no chasing brands, no middlemen.
        </p>
        <div className="row">
          <Link className="btn" to="/become-a-creator">
            Start creating
          </Link>
          <a className="btn ghost" href="#how" onClick={jumpTo("how")}>
            See how you get paid
          </a>
        </div>
      </div>
      <div className="phone">
        <div className="fit" ref={fitRef} onPointerMove={tilt} onPointerLeave={untilt}>
          <div className="fig" aria-hidden="true">
            <i
              style={{
                left: "32%",
                top: "0",
                width: "36%",
                height: "20%",
                borderRadius: "50%",
                background: "#16132E",
              }}
            />
            <i
              style={{
                left: "14%",
                top: "20%",
                width: "72%",
                height: "34%",
                borderRadius: "24px 24px 8px 8px",
                background: "#F5F3FF",
                opacity: 0.92,
              }}
            />
            <i
              style={{
                left: "22%",
                top: "52%",
                width: "56%",
                height: "34%",
                borderRadius: "8px",
                background: "#16132E",
                opacity: 0.85,
              }}
            />
            <i
              style={{
                left: "18%",
                top: "88%",
                width: "64%",
                height: "12%",
                borderRadius: "14px",
                background: "#fff",
              }}
            />
          </div>
          {PIECES.map((p, i) => {
            const tagged = on.includes(i);
            return (
              <button
                key={p.n}
                type="button"
                className={`hs${tagged ? " on" : ""}`}
                style={{ left: p.x, top: p.y }}
                aria-label={"Tag " + p.n}
                aria-pressed={tagged}
                onClick={() => toggle(i)}
              >
                {tagged ? "✓" : "+"}
              </button>
            );
          })}
          {sparks.map((s) => (
            <i
              key={s.id}
              className="spark"
              style={
                {
                  left: `calc(${s.x} + 13px)`,
                  top: `calc(${s.y} + 13px)`,
                  "--dx": `${s.dx}px`,
                  "--dy": `${s.dy}px`,
                  "--d": `${s.d}s`,
                } as CSSProperties
              }
              onAnimationEnd={() => setSparks((all) => all.filter((x) => x.id !== s.id))}
            />
          ))}
          <div className="tagcard">
            <b>
              <Num value={total} />
            </b>
            <small>
              {on.length} piece{on.length === 1 ? "" : "s"} tagged · {sales} sale
              {sales === 1 ? "" : "s"} tracked
            </small>
            <small>Tap the dots to tag. Example figures.</small>
          </div>
        </div>
        {toast && (
          <div className="toast" key={toast.k} role="status">
            💸 {toast.t}
          </div>
        )}
        {CHIPS.map((c) => (
          <div
            key={c.label}
            className="chip"
            aria-hidden="true"
            style={{
              [c.side]: c.offset,
              top: c.top,
              animationDelay: `${c.delay}s`,
            }}
          >
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function jumpTo(id: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };
}

/* ---------------- Sections ---------------- */
function Cases() {
  const [key, setKey] = useState<CaseKey>("Fits");
  const tabRefs = useRef<Record<CaseKey, HTMLButtonElement | null>>({
    Fits: null,
    Reviews: null,
    Hauls: null,
  });
  const c = CASES[key];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = CASE_KEYS[(CASE_KEYS.indexOf(key) + dir + CASE_KEYS.length) % CASE_KEYS.length];
    if (!next) return;
    setKey(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="cases">
      <div className="wrap">
        <H2>Make money from your content.</H2>
        <Reveal as="p" className="sub">
          Three ways creators already post fashion. Oakmonte turns each one into earnings.
        </Reveal>
        <div className="tabs" role="tablist" aria-label="How creators post" onKeyDown={onKey}>
          {CASE_KEYS.map((n) => (
            <button
              key={n}
              type="button"
              role="tab"
              id={`oc-tab-${n}`}
              className="tab"
              aria-selected={n === key}
              aria-controls={`oc-panel-${n}`}
              tabIndex={n === key ? 0 : -1}
              ref={(el) => {
                tabRefs.current[n] = el;
              }}
              onClick={() => setKey(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div
          className="panel"
          key={key}
          role="tabpanel"
          id={`oc-panel-${key}`}
          aria-labelledby={`oc-tab-${key}`}
        >
          <div>
            <h3>{c.t}</h3>
            <p>{c.d}</p>
            <Link className="btn" to="/become-a-creator">
              Start creating
            </Link>
          </div>
          <div className="items">
            {c.i.map((x, i) => (
              <div className="item" key={x[0]} style={{ animationDelay: `${i * 0.1}s` }}>
                <b>{x[0]}</b>
                <em>{x[1]}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Calc() {
  const [audience, setAudience] = useState(25000);
  const [convert, setConvert] = useState(1.5);
  const [order, setOrder] = useState(25000);
  const [share, setShare] = useState(10);
  const earn = (((audience * convert) / 100) * order * share) / 100;

  return (
    <section>
      <div className="wrap">
        <H2>See what one post could earn.</H2>
        <div className="calc">
          <div>
            <Range
              label="Audience reached"
              value={audience}
              min={1000}
              max={500000}
              step={1000}
              format={(v) => v.toLocaleString("en-NG")}
              onChange={setAudience}
            />
            <Range
              label="Viewers who buy"
              value={convert}
              min={0.1}
              max={5}
              step={0.1}
              format={(v) => `${v.toFixed(1)}%`}
              onChange={setConvert}
            />
            <Range
              label="Average order"
              value={order}
              min={5000}
              max={100000}
              step={1000}
              format={naira}
              onChange={setOrder}
            />
            <Range
              label="Your share of each sale"
              value={share}
              min={3}
              max={20}
              step={1}
              format={(v) => `${v}%`}
              onChange={setShare}
            />
          </div>
          <div className="result">
            <div>Earnings from one post</div>
            <div className="big" aria-hidden="true">
              <Num value={earn} />
            </div>
            <span className="sr" aria-live="polite">
              {naira(earn)}
            </span>
            <small>
              Illustrative only. Oakmonte shows the exact share before you tag a product.
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label>
      {label}
      <span>{format(value)}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

/* ---------------- Page ---------------- */
function CreatorsLanding() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const marqRef = useRef<HTMLDivElement | null>(null);
  const phoneHostRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const tlRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // One passive scroll listener drives everything scroll-linked (progress bar,
  // marquee skew, hero parallax, timeline fill). Writes go straight to the
  // elements; React state only changes when the active timeline step does.
  useEffect(() => {
    const reduced = prefersReducedMotion();
    let raf = 0;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let skew = 0;
    let step = -1;

    const frame = () => {
      raf = 0;
      const y = window.scrollY;
      const now = performance.now();
      const vh = window.innerHeight;

      const bar = barRef.current;
      if (bar) {
        const max = document.documentElement.scrollHeight - vh;
        bar.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, y / max)) : 0})`;
      }

      let moving = false;
      if (!reduced) {
        const dt = Math.max(1, now - lastT);
        const velocity = ((y - lastY) / dt) * 1000;
        const target = Math.max(-14, Math.min(14, velocity / -180));
        skew += (target - skew) * 0.25;
        if (Math.abs(skew) < 0.05 && Math.abs(target) < 0.05) skew = 0;
        moving = skew !== 0;
        if (marqRef.current) {
          marqRef.current.style.transform = `rotate(-1.2deg) skewX(${skew.toFixed(2)}deg)`;
        }
        const host = phoneHostRef.current;
        if (host) {
          const r = host.getBoundingClientRect();
          const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
          const phone = host.querySelector<HTMLElement>(".phone");
          if (phone) phone.style.transform = `translate3d(0, ${(-8 * p).toFixed(2)}%, 0)`;
        }
      }
      lastY = y;
      lastT = now;

      const tl = tlRef.current;
      if (tl) {
        const r = tl.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (vh * 0.7 - r.top) / (r.height + vh * 0.1)));
        if (fillRef.current) fillRef.current.style.height = `${p * 100}%`;
        const next = Math.min(STEPS.length - 1, Math.floor(p * STEPS.length * 1.001));
        if (next !== step) {
          step = next;
          setActive(next);
        }
      }

      if (moving) raf = requestAnimationFrame(frame);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="oak-creators">
      <style>{CSS}</style>
      <div className="oc-glow" aria-hidden="true" />
      <div className="oc-bar" ref={barRef} aria-hidden="true" />

      <header>
        <div className="wrap">
          <nav>
            <Link className="logo" to="/" aria-label="Oakmonte home">
              <img className="logo-o" src={logoO} alt="" />
              <span className="word">akmonte</span>
              <small>CREATED TO CREATE.</small>
            </Link>
            <div className={menuOpen ? "links is-open" : "links"}>
              <Link to="/" onClick={() => setMenuOpen(false)}>
                Main
              </Link>
              <Link to="/sellers" onClick={() => setMenuOpen(false)}>
                Sellers
              </Link>
            </div>
            <div className="nav-end">
              <Link className="btn ghost" to="/sign-in">
                Sign in
              </Link>
              <button
                type="button"
                className="menu-btn"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span />
                <span />
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <div className="wrap" ref={phoneHostRef}>
          <Hero />
        </div>

        <div className="marq" ref={marqRef} aria-hidden="true">
          <div>
            {[0, 1].map((k) => MARQUEE.map((t) => <span key={`${k}-${t}`}>{t} &nbsp;✦</span>))}
          </div>
        </div>

        <Cases />

        <section id="how">
          <div className="wrap">
            <H2>Creators won't drive sales and go unpaid.</H2>
            <Reveal as="p" className="sub">
              Here is what happens between your post and your payout.
            </Reveal>
            <div className="tl" ref={tlRef}>
              <div className="rail" />
              <div className="fill" ref={fillRef} />
              {STEPS.map((s, i) => (
                <div className={`st${i <= active ? " act" : ""}`} key={s[0]}>
                  <div className="dot">{i + 1}</div>
                  <h3>{s[0]}</h3>
                  <p>{s[1]}</p>
                </div>
              ))}
            </div>
            <div className="more">
              <Link className="btn" to="/sellers">
                See more about sellers
              </Link>
            </div>
          </div>
        </section>

        <Calc />

        <section>
          <div className="wrap">
            <Reveal as="p" className="quote">
              “I share pieces I actually believe in — and I get credit for every sale it drives.”
            </Reveal>
            <Reveal as="p" className="sub">
              Jamal, early creator
            </Reveal>
          </div>
        </section>

        <section className="faq">
          <div className="wrap">
            <H2>Fair questions.</H2>
            <div style={{ marginTop: 34 }}>
              {FAQ.map((f) => (
                <details key={f[0]}>
                  <summary>{f[0]}</summary>
                  <p>{f[1]}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <div className="wrap cta">
          <H2>Ready to create?</H2>
          <Link className="btn" to="/become-a-creator">
            Come join us. It's free.
          </Link>
          <div>
            <Link className="btn ghost back" to="/">
              Back to landing page
            </Link>
          </div>
        </div>
      </main>

      <div className="wrap">
        <footer>
          <span>© 2026 Oakmonte Multiglobal Limited</span>
          <span>
            <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> ·{" "}
            <a href="mailto:contact@oakmonte.store">contact@oakmonte.store</a>
          </span>
        </footer>
      </div>
    </div>
  );
}

/* ---------------- Styles ----------------
   Everything is scoped under .oak-creators (never :root/html/body) so this
   page's tokens can't leak into the app shell -- same convention as
   routes/index.tsx and routes/sellers.tsx. The page background itself comes
   from the "marketing" surface (lib/surface.ts), which keeps the scroll-bounce
   edge and status strip white. */
const CSS = `
.oak-creators{
  --bg:#fff;--ink:#0A0A0A;--mut:#6B6B73;--card:#fff;--soft:#F4F5F8;--line:#E3E4EA;--blue:#1F4DFF;
  --ease:cubic-bezier(.2,.9,.3,1);--ease-expo:cubic-bezier(.16,1,.3,1);
  position:relative;isolation:isolate;overflow-x:clip;background:var(--bg);color:var(--ink);
  font:400 17px/1.55 Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  padding-bottom:env(safe-area-inset-bottom,0px);
}
.oak-creators *,.oak-creators *::before,.oak-creators *::after{box-sizing:border-box}
.oak-creators h1,.oak-creators h2,.oak-creators h3{font-family:'Archivo Black','Helvetica Neue',Arial,sans-serif;line-height:1;margin:0;letter-spacing:-.02em;font-weight:400}
.oak-creators h1,.oak-creators h2,.oak-creators h3{text-transform:uppercase}
.oak-creators h3{font-weight:400}
.oak-creators p{margin:0}
.oak-creators a{color:inherit}
.oak-creators button{font:inherit;color:inherit}
.oak-creators .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.oak-creators .wrap{max-width:1120px;margin:0 auto;padding:0 22px}
.oak-creators :focus-visible{outline:3px solid var(--blue);outline-offset:3px}

.oak-creators .oc-glow{position:fixed;inset:-20%;z-index:-1;pointer-events:none;will-change:transform;
  background:radial-gradient(circle at 25% 15%,rgba(31,77,255,.12),transparent 38%),radial-gradient(circle at 80% 65%,rgba(10,10,10,.06),transparent 40%);
  animation:ocDrift 16s ease-in-out infinite alternate}
.oak-creators .oc-bar{position:fixed;left:0;right:0;top:0;height:4px;background:var(--blue);transform:scaleX(0);transform-origin:0 50%;z-index:100;pointer-events:none}

.oak-creators nav{display:flex;justify-content:space-between;align-items:center;padding:20px 0}
.oak-creators header{position:sticky;top:0;z-index:50;padding-top:env(safe-area-inset-top,0px);background:rgba(255,255,255,.92);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.oak-creators .logo{display:flex;align-items:baseline;text-decoration:none}
.oak-creators .logo-o{height:44px;width:auto;flex:none;display:block;transform:translateY(4px)}
.oak-creators .logo .word{font:400 26px/1 Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:-.01em;color:var(--ink)}
.oak-creators .logo small{margin-left:16px;font:500 9px Inter,sans-serif;letter-spacing:.16em;color:var(--blue);transform:translateY(-2px);white-space:nowrap}
@media (max-width:640px){.oak-creators .logo small{margin-left:10px;font-size:7px;letter-spacing:.1em}.oak-creators header .btn{padding:8px 14px;font-size:13px;white-space:nowrap}}
@media (max-width:480px){.oak-creators .logo small{display:none}.oak-creators .nav-end{gap:4px}}
/* Slim phones: the logo gives way before the Sign in button can touch it. */
@media (max-width:400px){
  .oak-creators .wrap{padding:0 16px}
  .oak-creators .logo-o{height:36px}
  .oak-creators .logo .word{font-size:21px}
  .oak-creators header .btn{padding:7px 12px;font-size:12px}
  .oak-creators .menu-btn{width:34px}
  .oak-creators .menu-btn span{left:7px;right:7px}
}
@media (max-width:340px){
  .oak-creators .logo-o{height:30px}
  .oak-creators .logo .word{font-size:18px}
  .oak-creators header .btn{padding:6px 10px;font-size:11px}
}

.oak-creators .links{display:flex;gap:32px;margin-left:auto;margin-right:28px;font-weight:600;font-size:15px}
.oak-creators .links a{text-decoration:none;color:var(--mut);transition:color .2s}
.oak-creators .links a:hover{color:var(--ink)}
.oak-creators .nav-end{display:flex;align-items:center;gap:10px}
.oak-creators .menu-btn{display:none;width:40px;height:40px;border:0;background:none;cursor:pointer;position:relative}
.oak-creators .menu-btn span{position:absolute;left:10px;right:10px;height:2px;background:var(--ink);border-radius:2px;transition:transform .25s var(--ease)}
.oak-creators .menu-btn span:first-child{top:15px}
.oak-creators .menu-btn span:last-child{top:23px}
.oak-creators .menu-btn[aria-expanded="true"] span:first-child{transform:translateY(4px) rotate(45deg)}
.oak-creators .menu-btn[aria-expanded="true"] span:last-child{transform:translateY(-4px) rotate(-45deg)}
.oak-creators .cta .back{margin-top:14px}
.oak-creators .more{margin-top:72px;text-align:center}
@media (max-width:760px){
  .oak-creators .menu-btn{display:block}
  .oak-creators .links{display:none;position:absolute;left:0;right:0;top:100%;margin:0;padding:18px 22px 22px;flex-direction:column;gap:18px;font-size:17px;background:#fff;border-bottom:1px solid var(--line)}
  .oak-creators .links.is-open{display:flex}
}
.oak-creators .btn{position:relative;overflow:hidden;display:inline-block;background:var(--blue);color:#fff;padding:14px 26px;border-radius:999px;font-weight:600;font-size:16px;line-height:1.55;text-decoration:none;border:0;cursor:pointer;transition:transform .2s var(--ease),background .2s,color .2s}
.oak-creators .btn::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.5) 50%,transparent 70%);transform:translateX(-120%);animation:ocShine 3.5s infinite}
.oak-creators .btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--ink)}
.oak-creators .btn.ghost::after{display:none}
@media (hover:hover) and (pointer:fine){
  .oak-creators .btn:hover{transform:translateY(-2px)}
  .oak-creators .btn.ghost:hover{background:var(--ink);color:#fff}
}
.oak-creators .btn:active{transform:scale(.97);transition-duration:.1s}

.oak-creators .hero{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center;padding:40px 0 70px}
.oak-creators .hero h1{font-size:clamp(46px,6.2vw,76px)}
.oak-creators .hero h1 .w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.14em;margin-bottom:-.06em}
.oak-creators .hero h1 .w span{display:inline-block;animation:ocWordUp 1s var(--ease-expo) both;animation-delay:calc(var(--i,0) * 80ms + 100ms)}
.oak-creators .hero p.lead{max-width:34ch;color:var(--mut);font-size:19px;margin:24px 0 30px}
.oak-creators .row{display:flex;gap:12px;flex-wrap:wrap}
.oak-creators .phone{position:relative;perspective:900px;justify-self:center;width:min(340px,100%);will-change:transform}
.oak-creators .fit{position:relative;aspect-ratio:3/4.1;border-radius:34px;overflow:hidden;background:linear-gradient(160deg,#0A0A0A 0%,#1A2A8F 50%,#1F4DFF 100%);box-shadow:0 40px 80px -30px rgba(31,77,255,.5);transition:transform .15s ease-out}
.oak-creators .fit .fig{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:62%;height:84%}
.oak-creators .fig i{position:absolute;display:block}
.oak-creators .hs{position:absolute;width:34px;height:34px;border-radius:50%;border:0;background:#fff;color:#16132E;font-weight:700;cursor:pointer;display:grid;place-items:center;font-size:18px;z-index:3;transition:transform .15s var(--ease)}
.oak-creators .hs:active{transform:scale(.9)}
.oak-creators .hs::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid #fff;animation:ocPing 1.8s infinite}
.oak-creators .hs.on{background:var(--blue);color:#fff;animation:ocHsPop .6s cubic-bezier(.34,1.56,.64,1)}
.oak-creators .hs.on::after{animation:none;opacity:0}
.oak-creators .spark{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#fff;pointer-events:none;z-index:7;animation:ocSpark var(--d,1s) cubic-bezier(.22,1,.36,1) forwards}
.oak-creators .tagcard{position:absolute;left:14px;right:14px;bottom:14px;background:rgba(255,255,255,.94);color:#16132E;border-radius:20px;padding:14px 16px;z-index:4}
.oak-creators .tagcard b{font:400 28px 'Archivo Black'}
.oak-creators .tagcard small{display:block;color:#5E5A7A;font-size:13px}
.oak-creators .toast{position:absolute;right:-8px;top:26px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:10px 14px;font-size:14px;z-index:5;box-shadow:0 12px 30px -12px rgba(0,0,0,.4);animation:ocPop .5s cubic-bezier(.3,1.6,.5,1)}
.oak-creators .chip{position:absolute;background:#fff;border:1px solid var(--line);border-radius:999px;padding:8px 14px;font:600 13px Inter;box-shadow:0 14px 30px -14px rgba(0,0,0,.35);z-index:6;white-space:nowrap;animation:ocBob 4s ease-in-out infinite}
.oak-creators .chip::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--blue);margin-right:8px}

.oak-creators .marq{overflow:hidden;background:var(--ink);color:var(--bg);padding:16px 0;transform:rotate(-1.2deg);margin:20px -20px}
.oak-creators .marq div{display:flex;width:max-content;animation:ocMq 26s linear infinite;font:400 22px 'Archivo Black'}
.oak-creators .marq span{padding:0 28px;white-space:nowrap}

.oak-creators section{padding:80px 0}
.oak-creators h2{font-size:clamp(34px,5.4vw,64px);font-weight:800;max-width:15ch}
.oak-creators .h2r{clip-path:inset(0 0 100% 0);transform:translateY(45%);transition:clip-path 1.1s var(--ease-expo),transform 1.1s var(--ease-expo)}
.oak-creators .h2r.in{clip-path:inset(-12% -5% -12% -5%);transform:none}
.oak-creators .sub{color:var(--mut);max-width:46ch;margin:16px 0 0}
.oak-creators .rv{opacity:0;transform:translateY(34px);transition:opacity .8s var(--ease),transform .8s var(--ease)}
.oak-creators .rv.in{opacity:1;transform:none}

.oak-creators .tabs{display:flex;gap:8px;margin:34px 0 22px;flex-wrap:wrap}
.oak-creators .tab{border:1.5px solid var(--line);background:transparent;color:var(--ink);padding:10px 20px;border-radius:999px;font:600 16px Inter;cursor:pointer;transition:background .25s,color .25s,border-color .25s,transform .15s var(--ease)}
.oak-creators .tab:active{transform:scale(.97)}
.oak-creators .tab[aria-selected=true]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.oak-creators .panel{animation:ocPanelIn .55s var(--ease);display:grid;grid-template-columns:1fr 1fr;gap:30px;background:var(--card);border:1px solid var(--line);border-radius:30px;padding:34px;min-height:340px}
.oak-creators .panel h3{font-size:34px;margin-bottom:12px}
.oak-creators .panel p{color:var(--mut);margin:0 0 18px}
.oak-creators .items{display:grid;gap:10px;align-content:start}
.oak-creators .item{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--soft);border-radius:16px;padding:14px 18px;animation:ocSlide .5s var(--ease) backwards}
.oak-creators .item b{font-family:'Archivo Black';font-weight:400}
.oak-creators .item em{font-style:normal;color:var(--blue);font-weight:600;font-size:14px}

.oak-creators #how{scroll-margin-top:12px}
.oak-creators .tl{position:relative;display:grid;gap:34px;margin-top:44px;padding-left:64px}
.oak-creators .tl .rail{position:absolute;left:21px;top:6px;bottom:6px;width:3px;background:var(--line);border-radius:3px}
.oak-creators .tl .fill{position:absolute;left:21px;top:6px;width:3px;background:var(--blue);border-radius:3px;height:0;max-height:calc(100% - 12px)}
.oak-creators .st{position:relative}
.oak-creators .st .dot{position:absolute;left:-64px;top:-2px;width:44px;height:44px;border-radius:50%;background:var(--card);border:3px solid var(--line);display:grid;place-items:center;font:400 17px 'Archivo Black';transition:background .4s,border-color .4s,color .4s,transform .4s}
.oak-creators .st.act .dot{animation:ocPulse 1.8s infinite;background:var(--blue);border-color:var(--blue);color:#fff;transform:scale(1.15)}
.oak-creators .st h3{font-size:28px;margin-bottom:6px}
.oak-creators .st p{color:var(--mut);max-width:52ch}

.oak-creators .calc{display:grid;grid-template-columns:1fr 1fr;gap:34px;background:var(--ink);color:var(--bg);border-radius:34px;padding:40px;margin-top:40px}
.oak-creators .calc label{display:block;margin:0 0 22px;font-weight:500}
.oak-creators .calc label span{float:right;font-weight:700}
.oak-creators .calc input{width:100%;accent-color:#6D8BFF;margin-top:8px}
.oak-creators .result{align-self:center}
.oak-creators .big{font:400 clamp(44px,7vw,84px)/1 'Archivo Black';letter-spacing:-.04em;color:#7B96FF;overflow-wrap:anywhere}
.oak-creators .calc small{opacity:.7;display:block;margin-top:14px;font-size:14px}
.oak-creators .quote{font:400 clamp(26px,4vw,46px)/1.1 'Archivo Black';letter-spacing:-.03em;max-width:22ch}

.oak-creators .faq details{border-top:1.5px solid var(--line);padding:22px 0}
.oak-creators .faq details:last-child{border-bottom:1.5px solid var(--line)}
.oak-creators .faq summary{font:400 22px 'Archivo Black';cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:16px}
.oak-creators .faq summary::-webkit-details-marker{display:none}
.oak-creators .faq summary::after{content:"+";transition:transform .3s var(--ease)}
.oak-creators .faq details[open] summary::after{transform:rotate(45deg)}
.oak-creators .faq p{color:var(--mut);margin:12px 0 0;max-width:60ch}
.oak-creators .cta{text-align:center;padding-top:110px;padding-bottom:110px}
.oak-creators .cta h2{margin:0 auto 24px;max-width:12ch}
.oak-creators footer{border-top:1.5px solid var(--line);padding:28px 0;color:var(--mut);font-size:14px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}

@keyframes ocShine{60%,100%{transform:translateX(120%)}}
@keyframes ocPing{0%{transform:scale(.7);opacity:1}100%{transform:scale(1.6);opacity:0}}
@keyframes ocPop{from{transform:translateY(-14px) scale(.8);opacity:0}}
@keyframes ocMq{to{transform:translateX(-50%)}}
@keyframes ocPanelIn{from{opacity:0;transform:translateY(24px) scale(.98)}}
@keyframes ocPulse{0%{box-shadow:0 0 0 0 rgba(31,77,255,.5)}100%{box-shadow:0 0 0 16px rgba(31,77,255,0)}}
@keyframes ocBob{50%{transform:translateY(-14px) rotate(2deg)}}
@keyframes ocDrift{to{transform:translate(6%,4%) scale(1.15)}}
@keyframes ocSlide{from{transform:translateX(40px);opacity:0}}
@keyframes ocWordUp{from{transform:translateY(110%)}}
@keyframes ocHsPop{from{transform:scale(.6)}}
@keyframes ocSpark{to{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}

@media (max-width:820px){
  .oak-creators .hero,.oak-creators .panel,.oak-creators .calc{grid-template-columns:1fr}
  .oak-creators .panel,.oak-creators .calc{padding:24px}
  .oak-creators .toast{right:0}
  .oak-creators .chip{display:none}
  .oak-creators .big{font-size:clamp(30px,10.5vw,84px)}
}

@media (prefers-reduced-motion:reduce){
  .oak-creators *,.oak-creators *::before,.oak-creators *::after{animation:none!important;transition:none!important}
  .oak-creators .rv{opacity:1;transform:none}
  .oak-creators .h2r{clip-path:none;transform:none}
  .oak-creators .spark{display:none}
}
`;
