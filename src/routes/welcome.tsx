import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import logoO from "@/assets/logo-o.png";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { clearOnboardingState } from "@/lib/onboarding-state";
import { useRequireSession } from "@/components/onboarding/use-require-session";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [{ title: "Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: WelcomePage,
});

const HEADLINE = "Your style is proof that you think different";
// A character typewriter, same as before — the request was to make the
// typing animation better, not replace it with a different kind of
// animation. Normal typing pace, a delay before it starts, a delay before
// the full stop lands, and a delay after that before the page moves on.
const TYPE_SPEED_MS = 50;
const LEAD_IN_MS = 450;
const FULL_STOP_DELAY_MS = 650;
const TOTAL_TYPE_MS = HEADLINE.length * TYPE_SPEED_MS;
/** Matches the full stop's own scale-in below, so leaving doesn't clip it. */
const PERIOD_FADE_MS = 250;
/** When the sentence is finished and the full stop has landed. */
const SENTENCE_END_MS = LEAD_IN_MS + TOTAL_TYPE_MS + FULL_STOP_DELAY_MS;
/** A beat of stillness before the page changes. The cursor stops blinking and
 *  simply rests, which reads as "finished" — leaving mid-blink reads as
 *  "interrupted", and the sentence is the whole point of this screen. */
const CURSOR_SETTLE_MS = 520;
const ANIMATION_MS = SENTENCE_END_MS + PERIOD_FADE_MS + CURSOR_SETTLE_MS;

function WelcomePage() {
  const { userId } = useRequireSession();
  const navigate = useNavigate();
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [typedOut, setTypedOut] = useState(false);
  const hasNavigated = useRef(false);

  const handleTypedOut = useCallback(() => setTypedOut(true), []);

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

  // Start pulling the profile down the moment we know whose it is, rather
  // than when we navigate. The route's loader warms its own query (see
  // profile.$username.tsx), so this buys the whole typing animation as fetch
  // time and the page arrives populated instead of empty-then-filling.
  useEffect(() => {
    if (!username) return;
    const id = window.setTimeout(() => {
      void router.preloadRoute({ to: "/profile/$username", params: { username } }).catch(() => {});
    }, 0);
    return () => window.clearTimeout(id);
  }, [router, username]);

  useEffect(() => {
    if (!loaded || hasNavigated.current) return;

    // No username here means onboarding didn't finish, so there is no profile
    // to wait for and nothing to show off -- send them back to fix it rather
    // than holding them through an animation.
    if (!username) {
      hasNavigated.current = true;
      navigate({ to: "/choose-username", replace: true });
      return;
    }

    // Leave on whichever finishes LAST. This screen is both a loading screen
    // and a piece of writing: cutting it off the instant the profile resolves
    // truncated the sentence mid-word, and leaving before the profile is ready
    // would defeat the point of having it at all.
    if (!typedOut) return;
    hasNavigated.current = true;

    // The passkey offer was here briefly, because this is where all three
    // onboarding flows converge (COMPLETION_STEP). Don't put it back. The
    // problem was never reach, it was timing: this screen sits between signing
    // up and finally seeing the app, so the prompt reads as one more thing in
    // the way and gets skipped on reflex. It now runs once, from the seller
    // checklist right after the payout step, where it reads as part of setting
    // up a business -- see needsPasskeyForInstall in src/lib/auth.ts.
    navigate({ to: "/profile/$username", params: { username }, replace: true });
  }, [loaded, typedOut, username, navigate]);

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

      <TypingHeadline onDone={handleTypedOut} />
    </div>
  );
}

function TypingHeadline({ onDone }: { onDone: () => void }) {
  const [chars, setChars] = useState(0);
  const [periodVisible, setPeriodVisible] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Held in a ref so the animation can't be restarted by a caller that
  // re-creates the callback on a render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

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

    // Same convention as index.tsx's HeroSlideshow: skip the motion outright
    // rather than just shortening it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setChars(HEADLINE.length);
      setPeriodVisible(true);
      setCursorVisible(false);
      schedule(() => onDoneRef.current(), LEAD_IN_MS);
      return () => {
        cancelled = true;
        timers.forEach((id) => clearTimeout(id as number));
      };
    }

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
    schedule(() => setPeriodVisible(true), SENTENCE_END_MS);

    // Sentence finished, full stop settled. The page may still be waiting on
    // the profile after this; that wait is the whole job of the screen.
    schedule(() => onDoneRef.current(), ANIMATION_MS);

    // The cursor blinks while there is still typing to do, then holds steady
    // from the full stop onward -- see CURSOR_SETTLE_MS.
    const cursorInterval = setInterval(() => {
      if (!cancelled) setCursorVisible((v) => !v);
    }, 530);
    timers.push(cursorInterval);

    schedule(() => {
      clearInterval(cursorInterval);
      setCursorVisible(true);
    }, SENTENCE_END_MS);

    return () => {
      cancelled = true;
      timers.forEach((id) => clearTimeout(id as number));
    };
  }, []);

  return (
    // Shrink-to-fit and centred, not full-width-and-left-set: a box that
    // stretches to fill its column left-aligns the sentence hard against the
    // screen's left padding even once finished. Shrinking to the longest
    // wrapped line (capped by max-w so it still wraps on a phone) lets the
    // page's own `items-center` centre the whole block instead — nudged a
    // touch further right on top of that, which is a deliberate optical
    // correction, not a bug in the centring math. The typed text, the full
    // stop and the cursor all live in ONE plain text run (no per-word/
    // per-character wrapper elements) so the browser's own line-wrapping
    // handles the sentence exactly the way the invisible reservation below
    // measured it — that's also what keeps the full stop glued to the last
    // word instead of wrapping onto a line by itself.
    <p className="relative w-fit max-w-sm translate-x-1.5 font-serif text-xl leading-snug tracking-tight text-brand-text/85 sm:text-2xl">
      {/* Reserves the finished sentence's exact box, including the second
          line it wraps onto. Without it the paragraph grows a line mid-type
          and, because the page is vertically centred, shunts the logo
          upward. */}
      <span aria-hidden="true" className="invisible whitespace-pre-wrap">
        {HEADLINE}.
        {/* The cursor's own width, so a sentence that exactly fills the last
            line cannot push it onto a line the reserved box does not cover. */}
        <span className="inline-block w-[3px]" />
      </span>
      <span className="absolute inset-0 whitespace-pre-wrap">
        {HEADLINE.slice(0, chars)}
        <motion.span
          initial={{ opacity: 0, scale: 0.85 }}
          animate={periodVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden={!periodVisible}
          className="inline-block"
        >
          .
        </motion.span>
        <span
          aria-hidden="true"
          className={`inline-block w-[2px] h-[1em] -mb-[0.15em] ml-[1px] align-middle bg-current transition-opacity duration-100 ${
            cursorVisible ? "opacity-100" : "opacity-0"
          }`}
        />
      </span>
    </p>
  );
}
