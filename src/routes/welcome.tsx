import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import logoO from "@/assets/logo-o.png";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { clearOnboardingState } from "@/lib/onboarding-state";
import { OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome to Oakmonte" }] }),
  component: WelcomePage,
});

const HEADLINE = "Your style is proof that you think different.";
const TYPE_SPEED_MS = 65; // ms per character
const HOLD_AFTER_TYPE_MS = 900; // pause on the finished line before moving on

function WelcomePage() {
  const { userId, checking } = useRequireSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [typed, setTyped] = useState("");
  const hasNavigated = useRef(false);

  // Resolve who we're sending them to once typing finishes.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("personal_username")
        .eq("id", userId)
        .maybeSingle();

      if (error) console.error("welcome: failed to read profile", error);
      if (cancelled) return;

      setUsername(data?.personal_username ?? null);
      setLoaded(true);
      clearOnboardingState();
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Type out the line once the profile lookup has resolved.
  useEffect(() => {
    if (!loaded) return;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setTyped(HEADLINE.slice(0, i));
      if (i >= HEADLINE.length) clearInterval(interval);
    }, TYPE_SPEED_MS);
    return () => clearInterval(interval);
  }, [loaded]);

  // Once typing finishes, hold briefly then open the profile.
  useEffect(() => {
    if (typed !== HEADLINE || hasNavigated.current) return;
    hasNavigated.current = true;
    const timeout = setTimeout(() => {
      if (username) {
        navigate({ to: "/profile/$username", params: { username }, replace: true });
      } else {
        navigate({ to: "/choose-username", replace: true });
      }
    }, HOLD_AFTER_TYPE_MS);
    return () => clearTimeout(timeout);
  }, [typed, username, navigate]);

  if (checking || !loaded) return <OnboardingChecking />;

  return (
    <div className="min-h-dvh bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6">
      <div className="flex items-baseline justify-center mb-10 oak-motion-enter">
        <img src={logoO} alt="" className="h-16 w-auto translate-y-1.5" />
        <span className="text-[36px] font-normal tracking-tight leading-none">akmonte</span>
      </div>
      <p className="font-serif text-base sm:text-lg text-center leading-snug max-w-xs text-brand-text/80">
        {typed}
        <span className="inline-block w-[2px] h-[1em] align-middle bg-brand-text/70 ml-0.5 animate-pulse" />
      </p>
    </div>
  );
}
