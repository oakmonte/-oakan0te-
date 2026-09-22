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
const WORDS = HEADLINE.split(" ");
// Word-by-word resolve, not a character typewriter — see TypingHeadline for
// why. Values extend transitions-dev's streaming-text token set
// (--stream-gap/--stream-fade/--stream-blur/--stream-ease) rather than
// inventing a parallel one; blur/duration are pushed up from that skill's
// chat-message defaults (60ms/350ms/1px) because this is large serif display
// type in a rare, first-time "delight tier" moment, not a fast-moving chat
// line — a 1px blur doesn't read at this size.
const WORD_GAP_MS = 90;
const WORD_FADE_MS = 380;
const WORD_BLUR_PX = 6;
const STREAM_EASE = [0.22, 1, 0.36, 1] as const;
const LEAD_IN_MS = 350;
const PERIOD_DELAY_MS = 120;
/** When every word (not yet the full stop) has started resolving. */
const WORDS_DONE_MS = LEAD_IN_MS + (WORDS.length - 1) * WORD_GAP_MS + WORD_FADE_MS;
/** When the full stop has landed. */
const SENTENCE_END_MS = WORDS_DONE_MS + PERIOD_DELAY_MS + WORD_FADE_MS;
/** A beat of stillness before the page changes, so leaving doesn't read as
 *  cutting the sentence off mid-resolve. */
const SETTLE_MS = 450;
const ANIMATION_MS = SENTENCE_END_MS + SETTLE_MS;

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
  // How many of WORDS have started resolving in. A word past this index
  // stays at its `initial` (invisible, blurred) variant.
  const [visibleWords, setVisibleWords] = useState(0);
  const [periodVisible, setPeriodVisible] = useState(false);

  // Held in a ref so the animation can't be restarted by a caller that
  // re-creates the callback on a render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = (fn: () => void, delay: number) => {
      timers.push(
        setTimeout(() => {
          if (!cancelled) fn();
        }, delay),
      );
    };

    // Same convention as index.tsx's HeroSlideshow: skip the motion outright
    // rather than just shortening it. The sentence still has to be readable
    // before onDone fires, so it appears whole after one short, calm beat
    // instead of resolving word by word.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleWords(WORDS.length);
      setPeriodVisible(true);
      schedule(() => onDoneRef.current(), LEAD_IN_MS + WORD_FADE_MS);
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }

    // Resolve the sentence one word at a time — see the WORD_* constants
    // above for why this replaced a character-by-character typewriter.
    WORDS.forEach((_, i) => {
      schedule(() => setVisibleWords(i + 1), LEAD_IN_MS + i * WORD_GAP_MS);
    });

    schedule(() => setPeriodVisible(true), WORDS_DONE_MS + PERIOD_DELAY_MS);

    // Sentence finished, full stop settled. The page may still be waiting on
    // the profile after this; that wait is the whole job of the screen.
    schedule(() => onDoneRef.current(), ANIMATION_MS);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  const wordVariant = {
    hidden: { opacity: 0, filter: `blur(${WORD_BLUR_PX}px)` },
    shown: { opacity: 1, filter: "blur(0px)" },
  };
  const wordTransition = { duration: WORD_FADE_MS / 1000, ease: STREAM_EASE };

  return (
    // Shrink-to-fit and centred, not full-width-and-left-set: a box that
    // stretches to fill its column left-aligns the sentence hard against the
    // screen's left padding even once finished. Shrinking to the longest
    // wrapped line (capped by max-w so it still wraps on a phone) lets the
    // page's own `items-center` centre the whole block instead — nudged a
    // touch further right on top of that, which is a deliberate optical
    // correction, not a bug in the centring math.
    <p className="relative w-fit max-w-[20rem] translate-x-1.5 font-serif text-xl leading-snug tracking-tight text-brand-text/85 sm:text-2xl">
      {/* Reserves the finished sentence's exact box, including the second
          line it wraps onto. Without it the paragraph grows a line mid-reveal
          and, because the page is vertically centred, shunts the logo
          upward. */}
      <span aria-hidden="true" className="invisible whitespace-pre-wrap">
        {HEADLINE}.
      </span>
      <span className="absolute inset-0 whitespace-pre-wrap">
        {WORDS.map((word, i) => (
          // The space is a plain sibling text node, not inside the
          // inline-block span: a space swallowed *inside* an inline-block
          // gives the line-breaking algorithm nowhere to wrap between words,
          // so the sentence would rather overflow its box than break.
          <span key={i}>
            <motion.span
              initial="hidden"
              animate={i < visibleWords ? "shown" : "hidden"}
              variants={wordVariant}
              transition={wordTransition}
              className="inline-block"
            >
              {word}
            </motion.span>
            {i < WORDS.length - 1 ? " " : ""}
          </span>
        ))}
        <motion.span
          initial="hidden"
          animate={periodVisible ? "shown" : "hidden"}
          variants={wordVariant}
          transition={wordTransition}
          className="inline-block"
        >
          .
        </motion.span>
      </span>
    </p>
  );
}
