import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logoO from "@/assets/logo-o.png";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { clearOnboardingState, readIntent, type Intent } from "@/lib/onboarding-state";
import { OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome to Oakmonte" }] }),
  component: WelcomePage,
});

// The last screen of all three flows, sitting between the final form and the
// user's profile. It is deliberately not part of FLOWS (see COMPLETION_STEP) —
// it asks for nothing, so it must not inflate "step N of M".
//
// It is also not a destination resolvePostAuthRedirect can return: there is no
// column recording that a user has seen it, so routing a returning user here
// would show the welcome on every single sign-in. It is reached by finishing a
// flow, and only then.

type Copy = {
  eyebrow: string;
  heading: string;
  line: string;
  next: [string, string, string];
  secondary: { to: "/store" | "/home"; label: string; hint: string };
};

const COPY: Record<Intent, Copy> = {
  seller: {
    eyebrow: "Store created",
    heading: "Welcome to Oakmonte",
    line: "Your storefront exists. Everything from here is you filling it.",
    next: ["Add your first product", "Set your payout account", "Post content that sells it"],
    secondary: { to: "/store", label: "Go to your store", hint: "Products, orders and payouts." },
  },
  creator: {
    eyebrow: "You're in",
    heading: "Welcome to Oakmonte",
    line: "Your profile is live. Now make something worth watching.",
    next: ["Post your first piece", "Tag the pieces you wear", "Get paid for what you drive"],
    secondary: { to: "/home", label: "Explore Oakmonte", hint: "See what's being made today." },
  },
  curator: {
    eyebrow: "You're in",
    heading: "Welcome to Oakmonte",
    line: "Your fit is on file. Now we only show you things that fit.",
    next: ["Follow the sellers you like", "Save pieces to your wardrobe", "Shop escrow-protected"],
    secondary: { to: "/home", label: "Explore Oakmonte", hint: "Pieces matched to your size." },
  },
};

function WelcomePage() {
  const { userId, checking } = useRequireSession();
  const [username, setUsername] = useState<string | null>(null);
  const [intent, setIntent] = useState<Intent>("creator");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("personal_username, account_type")
        .eq("id", userId)
        .maybeSingle();

      if (error) console.error("welcome: failed to read profile", error);
      if (cancelled) return;

      setUsername(data?.personal_username ?? null);
      // account_type is the durable record of intent; local state is only a
      // fallback for profiles written before that column was filled in.
      const resolved = (data?.account_type as Intent | null) ?? readIntent() ?? "creator";
      setIntent(resolved);
      setLoaded(true);

      // Cleared here rather than in the last form step, so this page still has
      // the local intent to fall back on if the profile read fails.
      clearOnboardingState();
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (checking || !loaded) return <OnboardingChecking />;

  const copy = COPY[intent];

  return (
    <div className="min-h-dvh bg-brand-bg text-brand-text flex flex-col">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-baseline justify-center mb-10 oak-motion-enter">
            <img src={logoO} alt="" className="h-9 w-auto translate-y-1" />
            <span className="text-[22px] font-normal tracking-tight leading-none">akmonte</span>
            <span className="ml-3 -translate-y-0.5 text-[8px] font-medium uppercase tracking-[0.16em] text-brand-accent whitespace-nowrap">
              Created to create.
            </span>
          </div>

          <div className="text-center">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-accent mb-5">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
              {copy.eyebrow}
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">{copy.heading}</h1>
            <p className="text-sm text-brand-text/60 mb-8">{copy.line}</p>
          </div>

          <ul className="mb-8 border-y border-brand-text/10 divide-y divide-brand-text/10">
            {copy.next.map((item, i) => (
              <li key={item} className="flex items-center gap-3 py-3 text-sm">
                <span className="w-5 shrink-0 text-[11px] font-bold tabular-nums text-brand-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-brand-text/80">{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            {/* Both cards echo the landing's hero CTA stack: a filled blue
                primary and a blue-tinted secondary, label over hint. */}
            {username ? (
              <Link
                to="/profile/$username"
                params={{ username }}
                replace
                className="flex flex-col gap-0.5 rounded-2xl border-2 border-brand-accent bg-brand-accent px-5 py-3.5 text-white transition-transform duration-200 hover:-translate-y-0.5"
              >
                <span className="text-base font-bold uppercase leading-tight">
                  Go to your profile
                </span>
                <span className="text-[13px] leading-snug text-white/80">
                  This is where people find you.
                </span>
              </Link>
            ) : (
              <Link
                to="/choose-username"
                replace
                className="flex flex-col gap-0.5 rounded-2xl border-2 border-brand-accent bg-brand-accent px-5 py-3.5 text-white transition-transform duration-200 hover:-translate-y-0.5"
              >
                <span className="text-base font-bold uppercase leading-tight">
                  Pick your username
                </span>
                <span className="text-[13px] leading-snug text-white/80">
                  One thing left before your profile is live.
                </span>
              </Link>
            )}

            <Link
              to={copy.secondary.to}
              className="flex flex-col gap-0.5 rounded-2xl border-2 border-brand-text bg-brand-accent/[0.08] px-5 py-3.5 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span className="text-base font-bold uppercase leading-tight">
                {copy.secondary.label}
              </span>
              <span className="text-[13px] leading-snug text-brand-text/60">
                {copy.secondary.hint}
              </span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
