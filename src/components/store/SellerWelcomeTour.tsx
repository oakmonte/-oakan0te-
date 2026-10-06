import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Check } from "lucide-react";
import { markSellerWelcomeSeen } from "./seller-welcome";

/**
 * A new seller's first look at their storefront, then a three-stop tour of
 * where everything lives.
 *
 *   1. Ten seconds after the storefront opens (sooner if they close it), a
 *      card asks for notification permission with a real switch. Browsers
 *      only show the permission prompt from a tap, which is what the switch
 *      is. Where notifications can't be asked for (iOS outside the installed
 *      app, or already decided) there is no card: the tour simply begins.
 *   2. The storefront slides away and the page darkens. A spotlight lands on
 *      the switch-profile button, glides down to Create in the bottom nav,
 *      then up to the menu. Each stop has a short callout.
 *   3. The last stop opens the menu with "Oakmonte Store" lit.
 *
 * Shown once per seller per device (WELCOME_KEY). The spotlight finds its
 * targets by `data-tour` attributes on the profile page and BottomNav; a
 * target that isn't on screen (no store profile to switch to, say) is
 * skipped rather than spotlighting nothing.
 */

const PUSH = "cubic-bezier(0.32, 0.72, 0, 1)";
const NOTIFY_DELAY_MS = 10000;

type Stop = { target: string; title: string; body: string; cta: string };

const STOPS: Stop[] = [
  {
    target: "switch-profile",
    title: "You have two profiles",
    body: "One for you, the owner, and one for your store. Both carry your storefront and both can sell. Switch between them here, and change it any time in Settings.",
    cta: "Next",
  },
  {
    target: "create",
    title: "Sell from what you post",
    body: "Create and post content, and link your products to it, so customers can buy straight from their For You page with a swipe.",
    cta: "Next",
  },
  {
    target: "menu",
    title: "Your store lives here",
    body: "Tap Oakmonte Store in this menu whenever you want to manage your store.",
    cta: "Show me",
  },
];

type Phase = "waiting" | "prompt" | "tour" | "done";

function notificationState(): "ask" | "granted" | "unavailable" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unavailable";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "unavailable";
  return "ask";
}

export function SellerWelcomeTour({
  userId,
  storefrontOpen,
  closeStorefront,
  openMenuWithStoreLit,
}: {
  userId: string;
  /** Whether the storefront sheet is up; the 10s clock runs while it is. */
  storefrontOpen: boolean;
  closeStorefront: () => void;
  /** Opens the hamburger menu with the Oakmonte Store row highlighted. */
  openMenuWithStoreLit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("waiting");

  // The prompt comes 10s into the storefront, or right away if they close it
  // first -- they've finished looking, so there's nothing to wait for.
  const startTour = useCallback(() => {
    closeStorefront();
    setPhase("tour");
  }, [closeStorefront]);

  // Nothing announces the tour: with no permission to ask for, the
  // storefront just slides away into it.
  const afterStorefront = useCallback(() => {
    if (notificationState() === "ask") setPhase("prompt");
    else startTour();
  }, [startTour]);

  useEffect(() => {
    if (phase !== "waiting") return;
    if (!storefrontOpen) {
      afterStorefront();
      return;
    }
    const t = setTimeout(afterStorefront, NOTIFY_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, storefrontOpen, afterStorefront]);

  const finish = useCallback(
    (openMenu: boolean) => {
      markSellerWelcomeSeen(userId);
      setPhase("done");
      if (openMenu) openMenuWithStoreLit();
    },
    [userId, openMenuWithStoreLit],
  );

  if (typeof document === "undefined" || phase === "waiting" || phase === "done") return null;
  return createPortal(
    phase === "prompt" ? <NotifyPrompt onContinue={startTour} /> : <Spotlight onFinish={finish} />,
    document.body,
  );
}

/* ------------------------------------------------------------------------ */

function NotifyPrompt({ onContinue }: { onContinue: () => void }) {
  const [on, setOn] = useState(false);
  const [asking, setAsking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const leave = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    setShown(false);
    setTimeout(onContinue, 240);
  }, [leaving, onContinue]);

  async function toggle() {
    if (asking || on) return;
    setAsking(true);
    // The switch moves the instant it's tapped; the browser's own prompt
    // then decides whether it stays.
    setOn(true);
    let result: NotificationPermission = "default";
    try {
      result = await Notification.requestPermission();
    } catch {
      result = "denied";
    }
    setAsking(false);
    if (result === "granted") {
      // A beat to see the switch settle on before the tour takes over.
      setTimeout(leave, 700);
    } else {
      setOn(false);
      setBlocked(true);
    }
  }

  return (
    // No tap-outside dismissal, same as the checklist's Next prompt: the only
    // ways on are the buttons.
    <div
      className="fixed inset-0 z-[150]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: shown ? 0.45 : 0, transition: "opacity 240ms ease" }}
      />
      <div
        className="absolute inset-x-3 rounded-[28px] bg-white px-6 pt-7 pb-5 text-black shadow-[0_24px_70px_rgba(0,0,0,0.4)]"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 12px)",
          transform: shown ? "translateY(0)" : "translateY(112%)",
          transition: `transform ${leaving ? 240 : 420}ms ${PUSH}`,
        }}
      >
        <div className="relative mx-auto h-14 w-14">
          {/* Two soft rings breathe out from the icon while it waits. */}
          {!on && (
            <>
              <span className="oak-welcome-ring absolute inset-0 rounded-[18px] bg-black/10" />
              <span
                className="oak-welcome-ring absolute inset-0 rounded-[18px] bg-black/10"
                style={{ animationDelay: "900ms" }}
              />
            </>
          )}
          <span
            className="relative grid h-14 w-14 place-items-center rounded-[18px] bg-black text-white transition-transform duration-300"
            style={{ transform: on ? "rotate(-12deg) scale(1.05)" : undefined }}
          >
            <Bell size={24} strokeWidth={2.25} />
          </span>
        </div>

        <h2
          id="welcome-title"
          className="mt-5 text-center text-[22px] font-bold leading-tight tracking-[-0.02em]"
        >
          Know the moment you make a sale
        </h2>
        <p className="mx-auto mt-2 max-w-[19rem] text-center text-[15px] leading-relaxed text-black/60">
          Turn on notifications for new orders, messages and followers.
        </p>

        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          className="mt-6 flex w-full items-center justify-between rounded-2xl bg-black/[0.05] px-4 py-3.5 text-left transition-transform duration-150 active:scale-[0.98]"
        >
          <span className="text-[16px] font-semibold">Notifications</span>
          <span
            className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
            style={{ background: on ? "#34C759" : "rgba(0,0,0,0.16)" }}
          >
            <span
              className="absolute top-[2px] left-[2px] grid h-[27px] w-[27px] place-items-center rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
              style={{
                transform: on ? "translateX(20px)" : "translateX(0)",
                transition: `transform 260ms ${PUSH}`,
              }}
            >
              {on && !asking && <Check size={14} strokeWidth={3} className="text-[#34C759]" />}
            </span>
          </span>
        </button>
        {blocked && (
          <p className="mt-2 text-center text-[13px] leading-snug text-black/50">
            No problem. You can allow them later in your browser settings.
          </p>
        )}

        {!blocked ? (
          <button
            type="button"
            onClick={leave}
            className="mt-3 h-11 w-full rounded-full text-[15px] font-semibold text-black/50 transition-transform duration-150 active:scale-[0.97]"
          >
            Not now
          </button>
        ) : (
          <button
            type="button"
            onClick={leave}
            className="mt-5 h-[52px] w-full rounded-full bg-black text-[16px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;

function measure(target: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  // A circle around the icon, however wide its hit area: the nav's buttons
  // are full-width flex cells, the icon is what should glow.
  const size = Math.min(Math.max(r.width, r.height), 56) + PAD * 2;
  return {
    top: r.top + r.height / 2 - size / 2,
    left: r.left + r.width / 2 - size / 2,
    width: size,
    height: size,
  };
}

function Spotlight({ onFinish }: { onFinish: (openMenu: boolean) => void }) {
  const stops = useRef<Stop[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);

  // Let the storefront finish sliding away, then keep only the stops that are
  // actually on this page.
  useEffect(() => {
    const t = setTimeout(() => {
      stops.current = STOPS.filter((s) => measure(s.target));
      if (stops.current.length === 0) {
        onFinish(false);
        return;
      }
      setReady(true);
    }, 480);
    return () => clearTimeout(t);
  }, [onFinish]);

  const stop = ready ? stops.current[index] : null;

  useLayoutEffect(() => {
    if (!stop) return;
    const update = () => {
      setRect(measure(stop.target));
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [stop]);

  if (!stop) {
    // The darkening starts at once, so the storefront leaving and the tour
    // arriving read as one motion.
    return <div className="fixed inset-0 z-[150] bg-black/70 animate-in fade-in duration-300" />;
  }

  const last = index === stops.current.length - 1;
  const next = () => (last ? onFinish(true) : setIndex((i) => i + 1));

  // Callout under a target in the top half, above one in the bottom half,
  // centred on it but kept 16px inside the screen.
  const cardWidth = Math.min(340, vw - 32);
  const centre = rect ? rect.left + rect.width / 2 : vw / 2;
  const cardLeft = Math.min(Math.max(16, centre - cardWidth / 2), vw - 16 - cardWidth);
  const below = rect ? rect.top + rect.height / 2 < vh / 2 : true;
  const cardPos = rect
    ? below
      ? { top: rect.top + rect.height + 16 }
      : { bottom: vh - rect.top + 16 }
    : { top: vh / 3 };

  return (
    <div className="fixed inset-0 z-[150]" role="dialog" aria-modal="true" aria-label={stop.title}>
      {rect && (
        // One element is both the dark page and the lit hole: its enormous
        // spread shadow is the scrim, and moving it glides the light from
        // one button to the next.
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            ...rect,
            boxShadow:
              "0 0 0 2px rgba(255,255,255,0.95), 0 0 28px 8px rgba(255,255,255,0.45), 0 0 0 200vmax rgba(0,0,0,0.72)",
            transition: `top 520ms ${PUSH}, left 520ms ${PUSH}, width 520ms ${PUSH}, height 520ms ${PUSH}`,
          }}
        >
          <span className="oak-welcome-glow absolute inset-0 rounded-full" />
        </div>
      )}
      {/* Swallows taps everywhere, the lit button included: the tour moves on
          its own buttons, so a stray tap can't navigate away mid-sentence. */}
      <div className="absolute inset-0" />

      <div
        key={stop.target}
        className="absolute rounded-[22px] bg-white p-5 text-black shadow-[0_18px_50px_rgba(0,0,0,0.45)] animate-in fade-in zoom-in-95 duration-300"
        style={{
          ...cardPos,
          left: cardLeft,
          width: cardWidth,
          animationDelay: index === 0 ? "0ms" : "180ms",
          animationFillMode: "both",
        }}
      >
        <div className="flex items-center gap-1.5">
          {stops.current.map((s, i) => (
            <span
              key={s.target}
              className="h-1.5 rounded-full bg-black transition-all duration-300"
              style={{ width: i === index ? 18 : 6, opacity: i === index ? 1 : 0.2 }}
            />
          ))}
        </div>
        <h3 className="mt-3 text-[18px] font-bold leading-tight tracking-[-0.01em]">
          {stop.title}
        </h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-black/65">{stop.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onFinish(false)}
            className="h-10 px-1 text-[14px] font-semibold text-black/45"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={next}
            className="h-10 rounded-full bg-black px-5 text-[14px] font-semibold text-white transition-transform duration-150 active:scale-[0.96]"
          >
            {stop.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
