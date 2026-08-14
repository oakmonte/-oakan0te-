import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logoO from "@/assets/logo-o.png";
import { useSession } from "@/hooks/use-session";
import { signInWithGoogle, signOut } from "@/lib/auth";
import { supabase } from "@/lib/integrations/my-supabase/client";

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
    return <div className="w-24 h-8" aria-hidden="true" />;
  }

  if (!user) {
    const handleSignIn = async () => {
      const { error } = await signInWithGoogle();
      if (error) {
        console.error("Google sign-in failed", error);
      }
    };

    return (
      <button
        type="button"
        onClick={() => void handleSignIn()}
        className="px-5 py-2 border border-brand-accent text-brand-accent text-[10px] uppercase tracking-widest whitespace-nowrap hover:bg-brand-accent hover:text-brand-bg transition-all duration-300"
      >
        SIGN IN
      </button>
    );
  }

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const fullName = str(meta.full_name) ?? str(meta.name);
  const secondWord = fullName ? (fullName.split(/\s+/)[1] ?? null) : null;
  const providerSecondName = str(meta.family_name) ?? str(meta.last_name) ?? secondWord ?? fullName;

  const label = profileUsername ?? providerSecondName ?? user.email?.split("@")[0] ?? "Account";
  const short = label.length > 22 ? label.slice(0, 20) + "…" : label;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-5 py-2 border border-brand-accent text-brand-accent text-[10px] uppercase tracking-widest whitespace-nowrap hover:bg-brand-accent hover:text-brand-bg transition-all duration-300"
      >
        {short}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-brand-bg border border-brand-text/15 shadow-lg z-50">
          {profileUsername && (
            <Link
              to="/profile/$username"
              params={{ username: profileUsername }}
              onClick={() => setOpen(false)}
              className="block w-full text-left px-4 py-3 text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors"
            >
              View profile
            </Link>
          )}
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            className="w-full text-left px-4 py-3 text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/index-upgrade")({
  component: Index,
});

const NAV_ITEMS = [
  { label: "PRODUCT", href: "#product" },
  { label: "SOLUTIONS", href: "#solutions" },
  { label: "RESOURCES", href: "#resources" },
  { label: "BLOG", href: "#blog" },
];

const CARDS = [
  {
    label: "SELLER",
    className: "card-seller",
    color: "#FF6B5B",
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-08-13%20194546-SOAayuyLAV2kRngcGwL94Z3tO6XNrc.png",
    alt: "Fashion seller editorial image",
  },
  {
    label: "CREATOR",
    className: "card-creator",
    color: "#3B5A85",
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-08-13%20194535-9nz3exqW7gMCZFiVqzFpF78iodX7P6.png",
    alt: "Creator fashion shopping interface",
  },
  {
    label: "MODEL",
    className: "card-model",
    color: "#C4A882",
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-08-13%20194535-9nz3exqW7gMCZFiVqzFpF78iodX7P6.png",
    alt: "Oakmonte model fashion image",
  },
  {
    label: "WARDROBE",
    className: "card-wardrobe",
    color: "#1A1A1A",
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Screenshot%202026-08-13%20194535-9nz3exqW7gMCZFiVqzFpF78iodX7P6.png",
    alt: "Curated wardrobe fashion image",
  },
];

const FEATURES = [
  {
    title: "Sellers",
    points: ["Logistics handled", "Wider customer base", "Custom stores"],
  },
  {
    title: "Creators",
    points: [
      "Make money from your content",
      "Intuitive creator and collaboration tools",
      "Greater visibility",
    ],
  },
  {
    title: "Curators",
    points: [
      "Get pieces that actually fit",
      "Track your deliveries",
      "Find and share inspirations and recommendations",
    ],
  },
];

function Marquee() {
  return (
    <div className="w-full overflow-hidden bg-brand-text text-brand-bg py-4">
      <div className="marquee-track flex whitespace-nowrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="mx-6 text-sm uppercase tracking-widest font-medium">
            CONTENT · COMMUNITY · COMMERCE · CONTENT · COMMUNITY · COMMERCE ·
          </span>
        ))}
      </div>
    </div>
  );
}

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState("PRODUCT");

  useEffect(() => {
    const onScroll = () =>
      setActive(window.scrollY > window.innerHeight * 0.6 ? "SOLUTIONS" : "PRODUCT");
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-brand-bg/90 backdrop-blur-md border-b border-brand-text/10">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoO} alt="Oakmonte" className="h-8 w-auto" />
              <span className="text-[10px] uppercase tracking-widest text-brand-accent hidden sm:inline-block">
                CREATED TO CREATE.
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`text-[11px] uppercase tracking-widest transition-colors duration-300 hover:text-brand-accent ${
                    active === item.label ? "text-brand-accent" : "text-brand-text"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-6">
              <HeaderAuth />
            </div>

            <button
              className="md:hidden p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              <div className="w-5 h-0.5 bg-brand-text mb-1.5 transition-transform duration-300" />
              <div className="w-5 h-0.5 bg-brand-text mb-1.5 transition-opacity duration-300" />
              <div className="w-5 h-0.5 bg-brand-text transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-brand-bg border-t border-brand-text/10">
            <div className="px-4 py-6 flex flex-col gap-4">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-[12px] uppercase tracking-widest hover:text-brand-accent transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-4 border-t border-brand-text/10">
                <HeaderAuth />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="pt-16">
        {/* Contact + Hero */}
        <section className="relative px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="mx-auto max-w-[1400px]">
            <div className="flex justify-end mb-12">
              <a
                href="mailto:contact@oakmonte.com"
                className="text-[10px] uppercase tracking-widest text-brand-accent hover:text-brand-text transition-colors duration-300"
              >
                CONTACT US
              </a>
            </div>

            <div className="max-w-4xl mb-16">
              <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent mb-4">
                WE ARE A
              </p>
              <h1 className="font-display text-[clamp(48px,10vw,120px)] leading-[0.9] tracking-tight text-brand-text uppercase mb-6">
                FASHION
                <br />
                COMMERCE
                <br />
                PLATFORM
              </h1>
              <p className="text-base sm:text-lg text-brand-text/70 max-w-md font-light">
                A better way to shop, share and sell your style.
              </p>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CARDS.map((card, index) => (
                <div
                  key={card.label}
                  className={`group relative aspect-[3/4] overflow-hidden rounded-2xl cursor-pointer ${card.className}`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  <div
                    className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                    style={{ backgroundColor: card.color }}
                  >
                    <img
                      src={card.image}
                      alt={card.alt}
                      className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-multiply"
                    />
                  </div>
                  <div className="absolute inset-0 flex flex-col justify-between p-5">
                    <span className="text-[11px] uppercase tracking-widest text-white/90 font-medium">
                      {card.label}
                    </span>
                    <div className="flex items-center justify-between text-white">
                      <span className="text-[10px] uppercase tracking-widest">OAKMONTE</span>
                      <span className="text-[10px] uppercase tracking-widest">↗</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 02 / ONE PLATFORM */}
        <section id="product" className="px-4 sm:px-6 lg:px-8 py-20 bg-white">
          <div className="mx-auto max-w-[1400px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent mb-4">
                  02 / ONE PLATFORM
                </p>
                <h2 className="font-display text-[clamp(40px,7vw,90px)] leading-[0.95] tracking-tight text-brand-text uppercase">
                  BETTER WAY
                  <br />
                  TO SHOP.
                </h2>
                <p className="mt-6 text-base text-brand-text/70 font-light max-w-md">
                  Oakmonte connects sellers, creators and curators in one native fashion commerce
                  platform.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {FEATURES.map((feature) => (
                  <div key={feature.title}>
                    <h3 className="text-[12px] uppercase tracking-widest font-medium mb-4 pb-2 border-b border-brand-text/10">
                      {feature.title}
                    </h3>
                    <ul className="space-y-3">
                      {feature.points.map((point) => (
                        <li
                          key={point}
                          className="text-[13px] text-brand-text/70 font-light leading-relaxed"
                        >
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stay Scam Proof */}
        <section id="solutions" className="px-4 sm:px-6 lg:px-8 py-20">
          <div className="mx-auto max-w-[1400px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent mb-4">
                  Stay Scam Proof
                </p>
                <h2 className="font-display text-[clamp(36px,6vw,72px)] leading-[0.95] tracking-tight text-brand-text uppercase mb-6">
                  STOP GETTING SCAMMED!
                </h2>
                <div className="space-y-4 text-[14px] text-brand-text/70 font-light leading-relaxed max-w-lg">
                  <p>
                    No payment reaches any seller without customer satisfaction. No fast-fashion
                    noise, just curated luxury and authentic pieces.
                  </p>
                  <p>
                    Creators won't make numbers and not get paid. Sellers won't get one-upped by
                    craft curators — every complaint goes through a thorough dispute pipeline.
                  </p>
                </div>
              </div>
              <div className="bg-brand-muted/50 rounded-2xl p-8 lg:p-12">
                <p className="text-[10px] uppercase tracking-[0.25em] text-brand-accent mb-4">
                  Find Your Fit
                </p>
                <p className="text-[15px] text-brand-text/80 font-light leading-relaxed">
                  A dedicated recommendation system tailored to improve curator-piece fit, and
                  reduce returns as all pieces go through our personal size chart.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee */}
        <Marquee />

        {/* Footer */}
        <footer className="px-4 sm:px-6 lg:px-8 py-16 bg-brand-bg border-t border-brand-text/10">
          <div className="mx-auto max-w-[1400px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logoO} alt="Oakmonte" className="h-7 w-auto" />
              <span className="text-[10px] uppercase tracking-widest text-brand-text/60">
                CREATED TO CREATE.
              </span>
            </div>
            <a
              href="mailto:contact@oakmonte.com"
              className="text-[11px] uppercase tracking-widest text-brand-accent hover:text-brand-text transition-colors duration-300"
            >
              CONTACT US ↗
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
