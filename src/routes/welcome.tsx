import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import logoO from "@/assets/logo-o.png";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { clearOnboardingState } from "@/lib/onboarding-state";
import { isPasskeySupported, needsPasskeyOffer } from "@/lib/auth";
import { useRequireSession } from "@/components/onboarding/use-require-session";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [{ title: "Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: WelcomePage,
});

const HEADLINE = "Your style is proof that you think different";
const TYPE_SPEED_MS = 55;
const LEAD_IN_MS = 450;
const FULL_STOP_DELAY_MS = 650;
const TOTAL_TYPE_MS = HEADLINE.length * TYPE_SPEED_MS;

function WelcomePage() {
  const { userId } = useRequireSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const hasNavigated = useRef(false);

  // Paint the launch screen immediately while the session and profile load
  // underneath it. Anonymous users are redirected by useRequireSession.
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
    if (!username) {
      navigate({ to: "/choose-username", replace: true });
      return;
    }

    // Finishing onboarding does NOT go through resolvePostAuthRedirect -- each
    // step calls nextRoute(), which walks the static FLOWS table and lands
    // here. So the passkey gate in the resolver only ever fired on a later
    // sign-in, never at the end of a signup. This is the one place every
    // flow's last step converges (COMPLETION_STEP), so the offer belongs here
    // too. /passkey resolves onward by itself, and skips itself when the
    // device can't make one.
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (needsPasskeyOffer(data.user) && (await isPasskeySupported())) {
        navigate({ to: "/passkey", replace: true });
        return;
      }
      navigate({ to: "/profile/$username", params: { username }, replace: true });
    })();
  }, [loaded, username, navigate]);

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

      <TypingHeadline />
    </div>
  );
}

function TypingHeadline() {
  const [chars, setChars] = useState(0);
  const [periodVisible, setPeriodVisible] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timers: (number | ReturnType<typeof setTimeout>)[] = [];

    const schedule = (fn: () => void, delay: number) => {
      const id = setTimeout(() => {
        if (!cancelled) fn();
      }, delay);
      timers.push(id);
      return id;
    };

    // Type the main sentence one character at a time.
    schedule(() => {
      const interval = setInterval(() => {
        if (cancelled) return;
        setChars((prev) => {
          if (prev >= HEADLINE.length) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, TYPE_SPEED_MS);
      timers.push(interval);
    }, LEAD_IN_MS);

    // Pause before the full stop.
    schedule(() => setPeriodVisible(true), LEAD_IN_MS + TOTAL_TYPE_MS + FULL_STOP_DELAY_MS);

    // Cursor blinks until navigation; cancel it right before the page leaves.
    const cursorInterval = setInterval(() => {
      if (!cancelled) setCursorVisible((v) => !v);
    }, 530);
    timers.push(cursorInterval);

    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id as number));
    };
  }, []);

  return (
    <p className="font-serif text-xl sm:text-2xl text-center leading-snug tracking-tight max-w-sm text-brand-text/85 min-h-[2.5rem]">
      <span className="whitespace-pre-wrap">{HEADLINE.slice(0, chars)}</span>
      <motion.span
        initial={{ opacity: 0, scale: 0.85 }}
        animate={periodVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden={!periodVisible}
      >
        .
      </motion.span>
      <span
        aria-hidden="true"
        className={`inline-block w-[2px] h-[1em] -mb-[0.15em] ml-[1px] align-middle bg-current transition-opacity duration-100 ${
          cursorVisible ? "opacity-100" : "opacity-0"
        }`}
      />
    </p>
  );
}
