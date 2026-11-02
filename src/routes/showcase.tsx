import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import { useActiveStore } from "@/hooks/use-own-store";
import { FullPreview } from "@/components/store-themes/full-previews";
import { THEMES, type ThemeId } from "@/components/store-themes/types";
import {
  createInitialEditState,
  type DesktopHero,
  type ThemeEditingProps,
} from "@/components/store-themes/edit-types";
import { HERO_SLIDESHOW_IMAGES } from "@/components/store-themes/hero-placeholders";
import { GLASS_RIM, glassLens, glassLight } from "@/lib/liquid-glass";
import { clearShowcase } from "@/lib/showcase-handoff";
import shopIcon from "@/assets/Store.svg";
import homeIcon from "@/assets/Home.svg";
import messagesIcon from "@/assets/messages.svg";

// Right after onboarding's Finish (via /welcome): three real storefronts in
// three very different themes, each wearing the seller's own store name and
// each moving its own way, before the setup checklist -- so the checklist
// reads as the way to get *this*, not a chore.
export const Route = createFileRoute("/showcase")({
  head: () => ({
    meta: [{ title: "Your store — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: ShowcasePage,
});

/** How each phone moves, so the three don't all do the same thing:
 *  shop   -- glides down to a product, taps it, and its page slides in;
 *  cards  -- the floating-cards hero, its 3D ring turning, the phone at rest;
 *  float  -- the hero slideshow, the phone drifting with a slight 3D tilt. */
type Motion = "shop" | "cards" | "float";

/** Three looks as unlike each other as the catalogue has: bright white and
 *  modern, dark streetwear, warm editorial. The middle one is in front. */
const SHOWN: { id: ThemeId; motion: Motion; hero: DesktopHero }[] = [
  { id: "paper", motion: "shop", hero: "banner" },
  { id: "motion", motion: "cards", hero: "cards" },
  { id: "banner", motion: "float", hero: "banner" },
];

/** Each phone is laid out at a real phone width, then drawn smaller. */
const PHONE_W = 390;
const PHONE_H = 780;
const GAP = 28;
/** Below this width the three fan out, overlapping, instead of a row. */
const FAN_BELOW = 760;

const noop = () => {};

/** View-only storefront settings, like the live storefront builds: the
 *  theme's placeholder photos, and which hero to show. */
function viewOnly(hero: DesktopHero): ThemeEditingProps {
  const s = createInitialEditState();
  return {
    isEditing: false,
    logoMode: s.logoMode,
    onLogoModeChange: noop,
    logoImage: s.logoImage,
    onLogoChange: noop,
    slideshowImages: HERO_SLIDESHOW_IMAGES,
    onAddSlideshowImages: noop,
    onRemoveSlideshowImage: noop,
    onClearSlideshow: noop,
    slideshowCrops: s.slideshowCrops,
    onSlideshowCropChange: noop,
    slideshowAspectRatio: s.slideshowAspectRatio,
    onSlideshowAspectRatioChange: noop,
    tileCrops: s.tileCrops,
    onTileCropChange: noop,
    text: s.text,
    onTextChange: noop,
    textFonts: s.textFonts,
    onTextFontChange: noop,
    hiddenBlocks: s.hiddenBlocks,
    onRemoveBlock: noop,
    onRestoreBlock: noop,
    layoutId: s.layoutId,
    onLayoutChange: noop,
    columns: s.columns,
    onColumnsChange: noop,
    onTileTapBlocked: noop,
    stickyBottom: s.stickyBottom,
    desktopHero: hero,
  };
}

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

  const looks = SHOWN.flatMap((look) => {
    const theme = THEMES.find((t) => t.id === look.id);
    return theme ? [{ ...look, theme }] : [];
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
          {looks.map(({ theme, motion, hero }, i) => {
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
                  hero={hero}
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

type Demo = {
  /** Where the tap lands, in the frame's own pixels. */
  tap: { x: number; y: number } | null;
  /** The product page sliding in over the store. */
  product: { image: string; title: string; price: string } | null;
};

/** One storefront in a phone frame, with the storefront's store / feed /
 *  messages pill at the bottom, moving its own way (see Motion). */
function PhonePreview({
  themeId,
  brandName,
  scale,
  motion,
  hero,
}: {
  themeId: ThemeId;
  brandName: string;
  scale: number;
  motion: Motion;
  hero: DesktopHero;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const editing = useMemo(() => viewOnly(hero), [hero]);
  const [demo, setDemo] = useState<Demo>({ tap: null, product: null });
  const [pageIn, setPageIn] = useState(false);

  // "shop": scroll to the first product, tap it, open its page, close, repeat.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || motion !== "shop") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    const glide = (to: number, ms: number) =>
      new Promise<void>((done) => {
        const from = el.scrollTop;
        let start = 0;
        const step = (t: number) => {
          if (cancelled) return;
          if (!start) start = t;
          const x = Math.min(1, (t - start) / ms);
          el.scrollTop = from + (to - from) * (0.5 - 0.5 * Math.cos(x * Math.PI));
          if (x < 1) raf = requestAnimationFrame(step);
          else done();
        };
        raf = requestAnimationFrame(step);
      });

    // The first real product photo below the hero.
    const findTile = () => {
      const frameTop = el.getBoundingClientRect().top;
      return [...el.querySelectorAll("img")].find((img) => {
        const r = img.getBoundingClientRect();
        return r.height > 60 && r.top - frameTop + el.scrollTop > el.clientHeight * 0.85;
      });
    };

    const run = async () => {
      if (cancelled) return;
      await new Promise((r) => later(1200, () => r(null)));
      const img = findTile();
      if (!img || cancelled) return later(1500, run);
      const box = img.getBoundingClientRect();
      const frame = el.getBoundingClientRect();
      // getBoundingClientRect is in screen pixels (after zoom); the frame's own
      // pixels are those divided by the zoom.
      const z = frame.width / el.clientWidth || 1;
      const imgTop = (box.top - frame.top) / z + el.scrollTop;
      await glide(Math.max(0, imgTop - 160), 2600);
      if (cancelled) return;
      const now = img.getBoundingClientRect();
      const tile = img.closest("button, a, article, li, div") as HTMLElement | null;
      const lines = (tile?.parentElement?.innerText ?? "").split("\n").map((l) => l.trim());
      setDemo({
        tap: {
          x: (now.left - frame.left + now.width / 2) / z,
          y: (now.top - frame.top + now.height / 2) / z,
        },
        product: {
          image: img.currentSrc || img.src,
          title: lines.find((l) => l && !l.includes("₦") && l.length < 40) ?? "New piece",
          price: lines.find((l) => l.includes("₦")) ?? "",
        },
      });
      later(700, () => setPageIn(true));
      later(4200, () => setPageIn(false));
      later(4700, () => setDemo({ tap: null, product: null }));
      later(5000, () => {
        void glide(0, 1800).then(() => later(1500, run));
      });
    };
    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [motion]);

  return (
    <div
      className={`relative overflow-hidden rounded-[2.5rem] border-[3px] border-neutral-900 bg-neutral-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ${
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
          <FullPreview themeId={themeId} storeId={null} brandName={brandName} editing={editing} />
        </div>
      </div>

      {/* The tap: a ring that lands and fades. */}
      {demo.tap && (
        <span
          className="oak-showcase-tap pointer-events-none absolute z-20 h-16 w-16 rounded-full border-4 border-white bg-white/30"
          style={{ left: demo.tap.x - 32, top: demo.tap.y - 32 }}
          aria-hidden="true"
        />
      )}

      {/* The product page, sliding in from the right like the real one. */}
      {demo.product && (
        <div
          className="pointer-events-none absolute inset-0 z-30 flex flex-col bg-white text-[#111] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ transform: pageIn ? "translateX(0)" : "translateX(100%)" }}
          aria-hidden="true"
        >
          <img
            src={demo.product.image}
            alt=""
            className="mx-auto mt-14 aspect-[4/5] w-[78%] rounded-3xl object-cover"
          />
          <div className="px-6 pt-5">
            <p className="text-[24px] font-medium leading-tight">{demo.product.title}</p>
            <p className="mt-1 text-[20px]">{demo.product.price}</p>
            <div className="mt-5 flex gap-2.5">
              <span className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-[#111] text-[18px] font-semibold text-white">
                Buy Now
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <span className="flex h-14 items-center justify-center rounded-2xl bg-[#111] text-[16px] font-semibold text-white">
                Make Offer
              </span>
              <span className="flex h-14 items-center justify-center rounded-2xl bg-[#111] text-[16px] font-semibold text-white">
                Add to Bag
              </span>
            </div>
          </div>
        </div>
      )}

      {/* The storefront's own nav: store, feed, messages. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center">
        <div
          className={`${GLASS_RIM} relative flex h-[60px] items-center rounded-full p-[5px]`}
          style={glassLight}
        >
          {[shopIcon, homeIcon, messagesIcon].map((icon, i) => (
            <span key={icon} className="relative grid h-full w-[62px] place-items-center">
              {i === 0 && (
                <span className={`${GLASS_RIM} absolute inset-0 rounded-full`} style={glassLens} />
              )}
              <img
                src={icon}
                alt=""
                className="relative"
                style={{
                  width: 25,
                  height: 25,
                  filter: "brightness(0)",
                  opacity: i === 0 ? 1 : 0.55,
                }}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
