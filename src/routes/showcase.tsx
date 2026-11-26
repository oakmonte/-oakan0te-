import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useActiveStore } from "@/hooks/use-own-store";
import { THEMES, type ThemeId } from "@/components/store-themes/types";
import { type DesktopHero } from "@/components/store-themes/edit-types";
import { clearShowcase } from "@/lib/showcase-handoff";
import { PHONE_H, PHONE_W, PhonePreview, type Motion } from "@/components/store-themes/SamplePhone";

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

/** Three looks as unlike each other as the catalogue has: cool light blue,
 *  dark streetwear, warm editorial. The middle one is in front. */
const SHOWN: { id: ThemeId; motion: Motion; hero: DesktopHero }[] = [
  { id: "ice", motion: "chat", hero: "banner" },
  { id: "motion", motion: "cards", hero: "cards" },
  { id: "banner", motion: "float", hero: "banner" },
];

const GAP = 28;
/** Below this width the three fan out, overlapping, instead of a row. */
const FAN_BELOW = 760;
/** How far each side phone sits from the middle, in phone-widths, and how many
 *  phone-widths the whole fan takes (sides, tilt and all). */
const FAN_OFFSET = 0.86;
const FAN_SPAN = 2.98;
/** Height the heading, captions and Finish button take, around the phones. */
const CHROME_H = 330;
const MIN_HEIGHT_SCALE = 0.3;

function ShowcasePage() {
  const { store } = useActiveStore();
  const navigate = useNavigate();
  const router = useRouter();
  const brandName = store?.brand_name?.trim() || "Your store";
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  // Shown now: a later pass through /welcome (an app launch) goes to the
  // dashboard. And the dashboard is where this leads, so have it ready.
  useEffect(() => {
    clearShowcase();
    void router.preloadRoute({ to: "/store" }).catch(() => {});
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [router]);

  const looks = SHOWN.flatMap((look) => {
    const theme = THEMES.find((t) => t.id === look.id);
    return theme ? [{ ...look, theme }] : [];
  });
  // Portrait screens fan too, whatever their width. Width alone put every
  // iPad held upright (820-1024px) in the row layout: three half-size phones
  // across the middle of a screen far taller than it is wide.
  const fan = vw > 0 && (vw < FAN_BELOW || vh > vw);
  // A row: all three fit across the screen. A fan: one phone's size, with the
  // other two tucked behind it.
  // The fan spans about FAN_SPAN phone-widths (the side phones, their tilt and
  // the gaps), kept inside the screen with a margin either side.
  //
  // Height counts too. The caps used to be fixed (0.4 fanned, 0.5 in a row),
  // tuned for phones and laptops — an iPad mini (744 wide, under FAN_BELOW)
  // got three 156px phones floating in an 1133px-tall screen. Now each phone
  // grows to whatever the width AND the height leave room for, with the
  // heading and the Finish button (CHROME_H) taken off the height first.
  const heightFit = vh > 0 ? (vh - CHROME_H) / (PHONE_H + 70) : 1;
  // Height can shrink a phone only down to MIN_HEIGHT_SCALE: a phone held
  // sideways (375 tall) would otherwise get 78px phones nobody can read.
  // Below that the page scrolls a little instead. Width always wins, so a
  // narrow screen never overflows sideways.
  const byWidth = fan
    ? Math.min(0.85, (vw - 40) / (PHONE_W * FAN_SPAN))
    : Math.min(0.8, (vw - 96 - GAP * 2) / (PHONE_W * 3));
  const scale = Math.min(byWidth, Math.max(MIN_HEIGHT_SCALE, heightFit));
  const phoneW = PHONE_W * scale;

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
          // my-auto: centred in whatever height is left over, rather than
          // hanging under the heading with an empty band above Finish (tall
          // screens — tablets — leave a lot over).
          className={`relative my-auto pt-8 flex justify-center ${fan ? "" : "items-end"}`}
          style={{ gap: fan ? 0 : GAP, height: fan ? PHONE_H * scale + 70 : undefined }}
        >
          {looks.map(({ theme, motion, hero }, i) => {
            // Fan: the middle phone in front, the other two behind and to the side.
            const side = i - 1;
            const fanStyle = fan
              ? {
                  position: "absolute" as const,
                  left: "50%",
                  // In pixels from the phone itself, so the side phones sit at the
                  // same distance either way (a % would follow the caption too).
                  width: phoneW,
                  marginLeft: -phoneW / 2 + side * phoneW * FAN_OFFSET,
                  transform: `rotate(${side * 7}deg) scale(${side === 0 ? 1 : 0.88})`,
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
                  // In the fan the phones keep one shared angle, so no drift of its own.
                  drift={!fan}
                  hero={hero}
                />
                {/* In the fan only the front phone has a caption: a side phone's box is
                    just the phone, so both turn about the same point. */}
                {(!fan || side === 0) && (
                  // Wider than the phone it sits under: boxed to the phone's
                  // width, the eyebrow broke one word a line on short screens
                  // and ran into the Finish button.
                  <figcaption className="relative left-1/2 mt-3 w-max -translate-x-1/2 whitespace-nowrap text-center">
                    <p className="text-[14px] font-semibold">{theme.name}</p>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-brand-text/50">
                      {theme.eyebrow}
                    </p>
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      )}

      <div className="mt-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/store", replace: true })}
          className="mx-auto flex h-14 w-full max-w-sm items-center justify-center rounded-full bg-brand-accent text-[16px] font-semibold text-brand-bg shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_32px_-12px_rgba(0,0,0,0.45)] active:translate-y-0 active:scale-[0.98]"
        >
          Finish set up
        </button>
      </div>
    </div>
  );
}
