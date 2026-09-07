import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import logoO from "@/assets/logo-o.png";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { clearOnboardingState } from "@/lib/onboarding-state";
import { OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "Welcome to Oakmonte" }] }),
  component: WelcomePage,
});

const HEADLINE = "Your style is proof that you think different";
const TYPE_SPEED_MS = 55;
const LEAD_IN_MS = 450;
const FULL_STOP_DELAY_MS = 650;
const HOLD_AFTER_MS = 900;

const TOTAL_TYPE_MS = HEADLINE.length * TYPE_SPEED_MS;
const REVEAL_MS = LEAD_IN_MS + TOTAL_TYPE_MS + FULL_STOP_DELAY_MS + HOLD_AFTER_MS;

function WelcomePage() {
  const { userId, checking } = useRequireSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const hasNavigated = useRef(false);

  // Resolve who we're sending them to once the line has played.
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

  useEffect(() => {
    if (!loaded || hasNavigated.current) return;
    hasNavigated.current = true;
    const timeout = setTimeout(() => {
      if (username) {
        navigate({ to: "/profile/$username", params: { username }, replace: true });
      } else {
        navigate({ to: "/choose-username", replace: true });
      }
    }, REVEAL_MS);
    return () => clearTimeout(timeout);
  }, [loaded, username, navigate]);

  if (checking || !loaded) return <OnboardingChecking />;

  return (
    <div className="min-h-dvh bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6">
      <motion.div
        className="flex items-baseline justify-center mb-10"
        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <img src={logoO} alt="" className="h-16 w-auto translate-y-1.5" />
        <span className="text-[36px] font-normal tracking-tight leading-none">akmonte</span>
      </motion.div>

      <motion.p
        className="font-serif text-xl sm:text-2xl text-center leading-snug tracking-tight max-w-sm text-brand-text/85 flex flex-wrap justify-center gap-x-[0.3em]"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { delayChildren: LEAD_IN_S, staggerChildren: WORD_STAGGER_S } },
        }}
      >
        {WORDS.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            className="inline-block"
            variants={{
              hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
              visible: { opacity: 1, y: 0, filter: "blur(0px)" },
            }}
            transition={{ duration: WORD_DURATION_S, ease: [0.22, 1, 0.36, 1] }}
          >
            {word}
          </motion.span>
        ))}
      </motion.p>
    </div>
  );
}

