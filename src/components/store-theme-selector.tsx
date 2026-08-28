import { Check, ChevronRight, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { THEMES, type Theme, type ThemeId } from "./store-themes/types";
import { ThemePreviewSheet } from "./store-themes/full-previews";
import { useStoreTheme } from "./store-themes/useStoreTheme";

// Picks readable text for a swatch of the theme's own background colour —
// most of these themes are near-black, a couple (banner, monochrome) are
// near-white, so a fixed text colour would go invisible on half the grid.
function readableTextColor(hex: string): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.substring(0, 2), 16);
  const g = parseInt(n.substring(2, 4), 16);
  const b = parseInt(n.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1c1b19" : "#ffffff";
}

// Just the theme's real background + accent — a full storefront mockup here
// duplicated what Preview/Edit already show, and made every card ~400px
// tall for no reason. This is a colour reference, not a second preview.
function ThemeColorSwatch({ theme }: { theme: Theme }) {
  const textColor = readableTextColor(theme.background);
  return (
    <div
      className="flex h-24 flex-col justify-between rounded-[1.1rem] p-4"
      style={{ background: theme.background }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: textColor, opacity: 0.65 }}
      >
        {theme.demoBrand}
      </span>
      <span className="h-2 w-10 rounded-full" style={{ background: theme.accent }} />
    </div>
  );
}

export function StoreThemeSelector() {
  const { storeId } = useActiveStoreId();
  const { themeId: selected, selectTheme } = useStoreTheme();
  const [previewing, setPreviewing] = useState<ThemeId | null>(null);
  const [previewMode, setPreviewMode] = useState<"view" | "edit">("view");
  // Themes this store has an actual store_theme_customizations row for —
  // used only to decide whether "Use this theme" should ask first, not to
  // render anything (see PublicStorefront for the render-time read).
  const [customizedThemes, setCustomizedThemes] = useState<Set<ThemeId>>(new Set());
  const [confirmUse, setConfirmUse] = useState<ThemeId | null>(null);

  const previewTheme = THEMES.find((t) => t.id === previewing) ?? null;
  const confirmTheme = THEMES.find((t) => t.id === confirmUse) ?? null;

  useEffect(() => {
    if (!storeId) {
      setCustomizedThemes(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .from("store_theme_customizations")
      .select("theme_slug")
      .eq("store_id", storeId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("StoreThemeSelector: failed to load customizations", error);
        setCustomizedThemes(new Set((data ?? []).map((r) => r.theme_slug as ThemeId)));
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  function openPreview(themeId: ThemeId, mode: "view" | "edit") {
    setPreviewing(themeId);
    setPreviewMode(mode);
  }

  // A seller tapping "Use this theme" on a theme they've never opened would
  // otherwise activate it with nothing but placeholder copy and demo photos
  // live on their storefront — ask first instead of assuming that's wanted.
  function handleUseTheme(themeId: ThemeId) {
    if (selected !== themeId && !customizedThemes.has(themeId)) {
      setConfirmUse(themeId);
      return;
    }
    void selectTheme(themeId);
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f6f5f2] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b735b]">
              Storefront design
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-[#171717] sm:text-3xl">
              Pick a store theme
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#6b6862]">
              Give your store a point of view. Every template is made for products first, and you
              can switch at any time.
            </p>
          </div>
          <div className="rounded-full border border-[#dfdcd5] bg-white px-3.5 py-2 text-xs text-[#6b6862] shadow-sm">
            {THEMES.length} original storefronts
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {THEMES.map((theme) => {
            const isSelected = selected === theme.id;
            return (
              <article
                key={theme.id}
                className={`overflow-hidden rounded-[1.6rem] border bg-white p-3 shadow-[0_12px_35px_rgba(36,31,24,0.07)] transition-all duration-300 ${
                  isSelected
                    ? "border-[#1d1c1a] ring-1 ring-[#1d1c1a]"
                    : "border-[#e4e0d9] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(36,31,24,0.13)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleUseTheme(theme.id)}
                  className="block w-full rounded-[1.1rem] text-left focus:outline-none"
                  aria-pressed={isSelected}
                  aria-label={`Select ${theme.name}`}
                >
                  <ThemeColorSwatch theme={theme} />
                </button>

                <div className="px-2 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold tracking-[-0.025em] text-[#1c1b19]">
                        {theme.name}
                      </p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.11em] text-[#8d8981]">
                        {theme.eyebrow}
                      </p>
                    </div>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                        isSelected
                          ? "border-transparent text-white"
                          : "border-[#dbd7d0] text-transparent"
                      }`}
                      style={{ backgroundColor: isSelected ? theme.accent : "transparent" }}
                      aria-hidden="true"
                    >
                      <Check
                        size={14}
                        strokeWidth={3}
                        className={isSelected ? "oak-motion-pop" : ""}
                      />
                    </span>
                  </div>
                  <p className="mt-3 min-h-10 text-sm leading-5 text-[#706c65]">
                    {theme.description}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openPreview(theme.id, "edit")}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#e1ddd6] py-2.5 text-sm font-medium text-[#262421] transition-colors duration-200 hover:bg-[#f5f3ef]"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openPreview(theme.id, "view")}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#e1ddd6] py-2.5 text-sm font-medium text-[#262421] transition-colors duration-200 hover:bg-[#f5f3ef]"
                    >
                      Preview
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUseTheme(theme.id)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#e1ddd6] py-2.5 text-sm font-medium text-[#262421] transition-colors duration-200 hover:bg-[#f5f3ef]"
                  >
                    {isSelected ? "Selected" : "Use this theme"}
                    {!isSelected && <ChevronRight size={16} />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-[#8c8881]">
          Your storefront content stays yours — a theme only changes how it is presented.
        </p>
      </div>

      {previewTheme && (
        <ThemePreviewSheet
          theme={previewTheme}
          isSelected={selected === previewTheme.id}
          initialMode={previewMode}
          onClose={() => setPreviewing(null)}
          onSelect={() => {
            void selectTheme(previewTheme.id);
            setPreviewing(null);
          }}
        />
      )}

      {confirmTheme && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold tracking-[-0.02em] text-[#1c1b19]">
                Customize {confirmTheme.name} first?
              </p>
              <button
                type="button"
                onClick={() => setConfirmUse(null)}
                aria-label="Cancel"
                className="shrink-0 rounded-full p-1 text-[#8d8981] hover:bg-[#f5f3ef]"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-5 text-[#706c65]">
              You haven't made any changes to this theme yet — it'll go live with placeholder copy
              and photos. Customize it now, or use it as-is and edit later.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const themeId = confirmTheme.id;
                  setConfirmUse(null);
                  openPreview(themeId, "edit");
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1d1c1a] py-2.5 text-sm font-semibold text-white"
              >
                <Pencil size={14} />
                Customize it
              </button>
              <button
                type="button"
                onClick={() => {
                  void selectTheme(confirmTheme.id);
                  setConfirmUse(null);
                }}
                className="rounded-xl border border-[#e1ddd6] py-2.5 text-sm font-medium text-[#262421] hover:bg-[#f5f3ef]"
              >
                Use as-is
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
