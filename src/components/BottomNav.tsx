import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, useVelocity } from "framer-motion";
import { GLASS_RIM, glassLens, glassLight } from "@/lib/liquid-glass";
import { isStandalone } from "@/lib/standalone";
import { useGoRoot } from "@/hooks/use-back";
import type { NavTarget } from "@/lib/nav-hierarchy";
import homeIcon from "@/assets/Home.svg";
import messagesIcon from "@/assets/messages.svg";
import createIcon from "@/assets/create.svg";
import cartIcon from "@/assets/cart.svg";
import profileIcon from "@/assets/profile.svg";

type NavKey = "home" | "messages" | "create" | "cart" | "profile";

type BottomNavProps = {
  active: NavKey;
  ownUsername?: string;
};

const PADDING = 5;
const NAV_HEIGHT = 60;
// Gap above the safe-area inset. Two values on purpose — see the nav's style.
const GAP_BROWSER = 12;
const GAP_INSTALLED = 4;

// Every screen with a tab bar renders its OWN BottomNav, so switching section
// unmounts one and mounts another. On its own that means the lens never
// travels between tabs — the new nav is born with the lens already in place.
// This is the hand-off: where the lens was, how fast it was going, and which
// tab was lit when the old nav went away. The next nav starts from exactly
// there and carries the motion on, so the slide reads as one continuous move
// across the page change.
//
// Stamped with when it was written, and only honoured for HANDOFF_TTL_MS. A
// nav that mounts long after the last one went away (back from a product page,
// the Explore overlay opening over /home) is not continuing anything — letting
// it inherit a stale x made the lens fly in from a tab you left minutes ago.
let handoff: {
  x: number;
  velocity: number;
  activeIndex: number;
  colWidth: number;
  at: number;
} | null = null;
const HANDOFF_TTL_MS = 900;

// Where the user last TAPPED, until they arrive. useGoRoot unwinds history
// (history.go(-n)) before replacing, so the screen at the bottom of the stack
// — usually /home — mounts its own nav for a moment on the way. Without this,
// that in-between nav aimed the lens at ITS tab, so it set off back toward
// Home and then turned round when the real destination landed: the "lens goes
// the wrong way" bug. A quick second tap during the unwind did the same. Any
// nav that mounts while a heading is fresh keeps aiming at the heading.
let heading: { index: number; at: number } | null = null;
const HEADING_TTL_MS = 1500;

function now() {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

function freshHeading() {
  return heading && now() - heading.at < HEADING_TTL_MS ? heading : null;
}

// Quick and slightly elastic: lands in ~350ms with a small overshoot rather
// than a bounce.
const LENS_SPRING = { type: "spring", stiffness: 420, damping: 32, mass: 0.9 } as const;

export function BottomNav({ active, ownUsername }: BottomNavProps) {
  // Tabs REPLACE rather than push, and unwind the stack on the way, so a root
  // always ends up at history index 0. Without this, five taps around the tab
  // bar is five entries deep and the back gesture can never leave the app —
  // which is what every native tab bar does at its root.
  const goRoot = useGoRoot();

  const items: {
    key: NavKey;
    label: string;
    icon: string;
    to: string;
    params?: Record<string, string>;
  }[] = [
    { key: "home", label: "Home", icon: homeIcon, to: "/home" },
    { key: "messages", label: "Messages", icon: messagesIcon, to: "/messages" },
    { key: "create", label: "Create", icon: createIcon, to: "/create" },
    { key: "cart", label: "Cart", icon: cartIcon, to: "/cart" },
    {
      key: "profile",
      label: "Profile",
      icon: profileIcon,
      to: "/profile/$username",
      params: ownUsername ? { username: ownUsername } : undefined,
    },
  ];

  const trackRef = useRef<HTMLDivElement>(null);
  // Seeded from the last nav's measurement, so the lens doesn't jump the
  // moment this one measures itself.
  const [colWidth, setColWidth] = useState(handoff?.colWidth ?? 58);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      setColWidth((el.clientWidth - PADDING * 2) / items.length);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set from an effect, not a lazy initial value: isStandalone() reads
  // `window`, so seeding state with it would render differently on the server
  // than on the client's first pass and trip hydration.
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(isStandalone());
  }, []);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === active),
  );

  // Where the lens is headed. Set on tap, before navigating — the tab root
  // swap can take a few hundred ms to unwind history (useGoRoot), and a lens
  // that waits for it feels like lag.
  // An in-between screen of a tab switch keeps heading where the user tapped.
  const [targetIndex, setTargetIndex] = useState(() => freshHeading()?.index ?? activeIndex);
  const lastActive = useRef(activeIndex);
  useEffect(() => {
    if (heading?.index === activeIndex) heading = null; // arrived
    if (lastActive.current === activeIndex) return;
    lastActive.current = activeIndex;
    setTargetIndex(activeIndex);
  }, [activeIndex]);

  // Read once: whether this nav continues a previous one's motion.
  const [inherited] = useState(() =>
    handoff && now() - handoff.at < HANDOFF_TTL_MS ? handoff : null,
  );
  // Which icon was lit on the previous nav, so its dimming animates too.
  const [litFrom] = useState(() => inherited?.activeIndex ?? activeIndex);

  const x = useMotionValue(inherited ? inherited.x : activeIndex * colWidth);
  const velocity = useVelocity(x);
  // The liquid part: while travelling the lens stretches along the direction
  // of motion and thins, then settles back round as the spring comes to rest.
  const scaleX = useTransform(velocity, [-2400, 0, 2400], [1.3, 1, 1.3]);
  const scaleY = useTransform(velocity, [-2400, 0, 2400], [0.84, 1, 0.84]);

  const firstRun = useRef(true);
  useEffect(() => {
    const to = targetIndex * colWidth;
    const first = firstRun.current;
    firstRun.current = false;
    // The very first nav of the session has nothing to continue: place the
    // lens (including after it measures its real width) instead of flying it
    // in from wherever the placeholder width put it.
    if (!inherited && x.getVelocity() === 0 && targetIndex === activeIndex) {
      x.jump(to);
      return;
    }
    const controls = animate(x, to, {
      ...LENS_SPRING,
      velocity: first && inherited ? inherited.velocity : x.getVelocity(),
    });
    return () => controls.stop();
  }, [targetIndex, colWidth, activeIndex, inherited, x]);

  const targetIndexRef = useRef(targetIndex);
  const colWidthRef = useRef(colWidth);
  useEffect(() => {
    targetIndexRef.current = targetIndex;
    colWidthRef.current = colWidth;
  }, [targetIndex, colWidth]);

  useEffect(
    () => () => {
      handoff = {
        x: x.get(),
        velocity: x.getVelocity(),
        activeIndex: targetIndexRef.current,
        colWidth: colWidthRef.current,
        at: now(),
      };
    },
    [x],
  );

  return (
    <nav
      className="fixed left-1/2 -translate-x-1/2 z-50"
      // The inset, not a bare 12px. Safari reports 0 here while its own
      // toolbar is on screen — the toolbar is chrome, not a safe-area inset —
      // so a hardcoded 12 looked right in a tab and sat straight on the home
      // indicator once installed, where there is no toolbar underneath to rest
      // on. It also matches the toasts, which already position against
      // `env(safe-area-inset-bottom) + 76px` and were drifting out of step.
      //
      // The gap is NOT the same number in both, though it used to be. An equal
      // 12px is not an equal-looking gap: in Safari it rests on a solid
      // toolbar, while installed it floats above ~34px of largely empty inset,
      // which reads as too high. The installed app takes a smaller gap so the
      // pill sits where the toolbar version appears to.
      style={{
        width: 320,
        height: NAV_HEIGHT,
        bottom: `calc(env(safe-area-inset-bottom) + ${installed ? GAP_INSTALLED : GAP_BROWSER}px)`,
      }}
    >
      <div
        ref={trackRef}
        className={`relative flex items-center w-full h-full ${GLASS_RIM}`}
        style={{ ...glassLight, padding: PADDING, borderRadius: 999 }}
      >
        {/* The lens: a brighter drop of the same glass, sprung between tabs
            and stretched by its own velocity — see scaleX/scaleY above. */}
        <motion.span
          aria-hidden
          className={GLASS_RIM}
          style={{
            ...glassLens,
            x,
            scaleX,
            scaleY,
            position: "absolute",
            top: PADDING,
            left: PADDING,
            width: colWidth,
            height: NAV_HEIGHT - PADDING * 2,
            borderRadius: 999,
            willChange: "transform",
          }}
        />

        {items.map(({ key, label, icon, to, params }, i) => {
          const isActive = i === targetIndex;
          const wasActive = i === litFrom;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTargetIndex(i);
                if (key === active) {
                  heading = null;
                  return;
                }
                heading = { index: i, at: now() };
                goRoot({ to, params } as NavTarget);
              }}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className="relative flex-1 flex items-center justify-center"
              style={{
                zIndex: 1,
                height: "100%",
                background: "none",
                border: "none",
                padding: 0,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <motion.img
                src={icon}
                alt=""
                // Start from how the previous nav showed this icon, so the tab
                // being left dims and the one arrived at lifts, across the
                // page change.
                initial={
                  wasActive ? { scale: 1.18, opacity: 1, y: -1 } : { scale: 1, opacity: 0.55, y: 0 }
                }
                whileTap={{ scale: 0.86 }}
                animate={{
                  scale: isActive ? 1.18 : 1,
                  opacity: isActive ? 1 : 0.55,
                  y: isActive ? -1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 20,
                  mass: 0.6,
                }}
                style={{
                  width: 26,
                  height: 26,
                  filter: "brightness(0)",
                  willChange: "transform, opacity",
                }}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
