import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import { useActiveStore } from "@/hooks/use-own-store";
import { FullPreview } from "@/components/store-themes/full-previews";
import { THEMES, type ThemeId } from "@/components/store-themes/types";
import { clearShowcase } from "@/lib/showcase-handoff";

// Right after onboarding's Finish (via /welcome): three real storefronts in
// three very different themes, each wearing the seller's own store name and
// slowly scrolling through itself, before the setup checklist -- so the
// checklist reads as the way to get *this*, not a chore.
export const Route = createFileRoute("/showcase")({
  head: () => ({
    meta: [{ title: "Your store — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: ShowcasePage,
});

/** Three looks as unlike each other as the catalogue has: bright white and
 *  modern, dark streetwear, warm editorial. */
const SHOWN: { id: ThemeId; motion: Motion }[] = [
  { id: "paper", motion: "glide" },
  { id: "motion", motion: "flick" },
  { id: "banner", motion: "float" },
];

/** How each phone moves, so the three don't all do the same thing:
 *  glide -- one smooth tour down the whole store and back up;
 *  flick -- a section at a time, with a pause on each, like a thumb scrolling;
 *  float -- stays on its hero slideshow and drifts with a slight 3D tilt. */
type Motion = "glide" | "flick" | "float";
/** Each phone is laid out at a real phone width, then drawn smaller. */
const PHONE_W = 390;
const PHONE_H = 780;
const GAP = 28;
/** Below this width the three fan out, overlapping, instead of a row. */
const FAN_BELOW = 760;

function ShowcasePage() {
  const { checking } = useRequireSession();
  const { store } = useActiveStore();
  const navigate = useNavigate();
  const router = useRouter();
  const brandName = store?.brand_name?.trim() || "Your store";
  const [vw, setVw] = useState(0);

  // Shown now: a later pass through /welcome (an app launch) goes to the
  // dashboard. And the dashboard is where this leads, so have it ready.
  useEffect(() => {
    clearShowcase();
    void router.preloadRoute({ to: "/store" }).catch(() => {});
    const measure = () => setVw(window.innerWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [router]);

  if (checking) return <OnboardingChecking />;

  const themes = SHOWN.flatMap(({ id, motion }) => {
    const theme = THEMES.find((t) => t.id === id);
    return theme ? [{ theme, motion }] : [];
  });
  const fan = vw > 0 && vw < FAN_BELOW;
  // A row: all three fit across the screen. A fan: one phone's size, with the
  // other two tucked behind it.
  const scale = fan
    ? Math.min(0.5, (vw - 48) / (PHONE_W * 1.55))
    : Math.min(0.6, (vw - 96 - GAP * 2) / (PHONE_W * 3));

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-brand-bg text-brand-text">
      <div className="px-6 pt-[calc(env(safe-area-inset-top)+2.5rem)] text-center">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
          Here&apos;s what {brandName} could look like
        </h1>
        <p className="mx-auto mt-2 max-w-[36ch] text-[15px] leading-relaxed text-brand-text/60">
          Real Oakmonte storefronts. Pick your look any time from{" "}
          <span className="font-medium text-brand-text">Customise your store front</span>.
        </p>
      </div>

      {vw > 0 && (
        <div
          className={`relative mt-8 flex justify-center ${fan ? "" : "items-end"}`}
          style={{ gap: fan ? 0 : GAP, height: fan ? PHONE_H * scale + 70 : undefined }}
        >
          {themes.map(({ theme, motion }, i) => {
            // Fan: the middle phone in front, the other two behind and to the side.
            const side = i - 1;
            const fanStyle = fan
              ? {
                  position: "absolute" as const,
                  left: "50%",
                  transform: `translateX(calc(-50% + ${side * 46}%)) rotate(${side * 6}deg) scale(${side === 0 ? 1 : 0.88})`,
                  zIndex: side === 0 ? 2 : 1,
                  transformOrigin: "bottom center",
                }
              : undefined;
            return (
              <figure key={theme.id} style={fanStyle} className="m-0">
                <PhonePreview
                  themeId={theme.id}
                  brandName={brandName}
                  scale={scale}
                  motion={motion}
                />
                <figcaption className={`mt-3 text-center ${fan && side !== 0 ? "invisible" : ""}`}>
                  <p className="text-[14px] font-semibold">{theme.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-brand-text/50">
                    {theme.eyebrow}
                  </p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      <div className="mt-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/store", replace: true })}
          className="mx-auto flex h-14 w-full max-w-sm items-center justify-center rounded-full bg-brand-accent text-[16px] font-semibold text-brand-bg transition-transform active:scale-[0.98]"
        >
          Finish set up
        </button>
      </div>
    </div>
  );
}

/** One storefront in a phone frame, moving its own way (see Motion). */
function PhonePreview({
  themeId,
  brandName,
  scale,
  motion,
}: {
  themeId: ThemeId;
  brandName: string;
  scale: number;
  motion: Motion;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || motion === "float") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let start = 0;
    const ease = (x: number) => 0.5 - 0.5 * Math.cos(x * Math.PI);
    const tick = (t: number) => {
      if (!start) start = t;
      const travel = el.scrollHeight - el.clientHeight;
      if (travel > 0) {
        const ms = t - start;
        if (motion === "glide") {
          // Down and back up in 16s, lingering at each end.
          const phase = (ms % 16000) / 16000;
          el.scrollTop = (0.5 - 0.5 * Math.cos(phase * 2 * Math.PI)) * travel;
        } else {
          // A screen at a time: 0.7s move, 1.8s rest, then back to the top.
          const stepH = el.clientHeight * 0.8;
          const steps = Math.max(1, Math.ceil(travel / stepH));
          const cycle = 2500;
          const n = Math.floor(ms / cycle) % (steps + 1);
          const within = Math.min(1, (ms % cycle) / 700);
          const from = n === 0 ? travel : Math.min(travel, (n - 1) * stepH);
          const to = n === 0 ? 0 : Math.min(travel, n * stepH);
          el.scrollTop = from + (to - from) * ease(within);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion]);

  return (
    <div
      className={`overflow-hidden rounded-[2.5rem] border-[3px] border-neutral-900 bg-neutral-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ${
        motion === "float" ? "oak-phone-float" : ""
      }`}
      // zoom, not transform: the frame takes only its drawn size.
      style={{ width: PHONE_W, height: PHONE_H, zoom: scale }}
    >
      {/* A picture of a store, not a store: no taps get in. */}
      <div
        ref={scrollerRef}
        className="no-scrollbar pointer-events-none h-full overflow-hidden"
        aria-hidden="true"
      >
        <div className="@container overflow-x-clip">
          <FullPreview themeId={themeId} storeId={null} brandName={brandName} />
        </div>
      </div>
    </div>
  );
}
