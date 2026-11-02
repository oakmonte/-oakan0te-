import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import { useActiveStore } from "@/hooks/use-own-store";
import { FullPreview } from "@/components/store-themes/full-previews";
import { THEMES } from "@/components/store-themes/types";
import { clearShowcase } from "@/lib/showcase-handoff";

// Right after onboarding's Finish (via /welcome): a row of real storefronts in
// different themes, each wearing the seller's own store name, before the setup
// checklist -- so the checklist reads as the way to get *this*, not a chore.
export const Route = createFileRoute("/showcase")({
  head: () => ({
    meta: [{ title: "Your store — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: ShowcasePage,
});

/** How many looks to show: the start of the picker's own order (white themes
 *  first). Each is a whole storefront, so a handful, not all sixty. */
const SHOWN = 8;
/** Each phone is laid out at a real phone width, then drawn smaller. */
const PHONE_W = 390;
const PHONE_H = 780;
const SCALE = 0.56;

function ShowcasePage() {
  const { checking } = useRequireSession();
  const { store } = useActiveStore();
  const navigate = useNavigate();
  const router = useRouter();
  const brandName = store?.brand_name?.trim() || "Your store";

  // Shown now: a later pass through /welcome (an app launch) goes to the
  // dashboard. And the dashboard is where this leads, so have it ready.
  useEffect(() => {
    clearShowcase();
    void router.preloadRoute({ to: "/store" }).catch(() => {});
  }, [router]);

  if (checking) return <OnboardingChecking />;

  return (
    <div className="flex min-h-dvh flex-col bg-brand-bg text-brand-text">
      <div className="px-6 pt-[calc(env(safe-area-inset-top)+2.5rem)] text-center">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
          Here&apos;s what {brandName} could look like
        </h1>
        <p className="mx-auto mt-2 max-w-[34ch] text-[15px] leading-relaxed text-brand-text/60">
          Every one of these is a real Oakmonte storefront. Pick yours any time from{" "}
          <span className="font-medium text-brand-text">Customise your store front</span>.
        </p>
      </div>

      <div
        className="no-scrollbar mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-[max(1.5rem,calc(50vw-120px))] pb-4"
        aria-label="Storefront looks"
      >
        {THEMES.slice(0, SHOWN).map((theme) => (
          <figure key={theme.id} className="shrink-0 snap-center">
            <div
              className="overflow-hidden rounded-[2.5rem] border-[3px] border-neutral-900 bg-neutral-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
              // zoom, not transform: the frame takes only its drawn size.
              style={{ width: PHONE_W, height: PHONE_H, zoom: SCALE }}
            >
              {/* A picture of a store, not a store: no taps get in, so a swipe
                  anywhere on it scrolls the row. */}
              <div className="pointer-events-none h-full overflow-hidden" aria-hidden="true">
                <div className="@container overflow-x-clip">
                  <FullPreview themeId={theme.id} storeId={null} brandName={brandName} />
                </div>
              </div>
            </div>
            <figcaption className="mt-3 text-center">
              <p className="text-[14px] font-semibold">{theme.name}</p>
              <p className="text-[11px] uppercase tracking-[0.12em] text-brand-text/50">
                {theme.eyebrow}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
        <button
          type="button"
          onClick={() => navigate({ to: "/store", replace: true })}
          className="mx-auto flex h-14 w-full max-w-sm items-center justify-center rounded-full bg-brand-accent text-[16px] font-semibold text-brand-bg transition-transform active:scale-[0.98]"
        >
          Set up my store
        </button>
      </div>
    </div>
  );
}
