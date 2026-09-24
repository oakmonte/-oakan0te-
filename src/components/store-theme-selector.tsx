import { Check, ChevronRight, Pencil, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useSession } from "@/hooks/use-session";
import { THEMES, type Theme, type ThemeId } from "./store-themes/types";
import { ThemePreviewSheet } from "./store-themes/full-previews";
import { useStoreTheme } from "./store-themes/useStoreTheme";
import { readableTextColor } from "./store-themes/colors";

// Colour families are DERIVED from each theme's own accent rather than
// tagged by hand. With 43 themes a hand-kept tag is one more thing to forget
// when a palette changes, and the accent already is the theme's colour — so
// the filter can never disagree with the swatch beside it.
const FAMILIES = ["Lavender", "Pink", "Warm", "Green", "Blue", "Neutral"] as const;
type Family = (typeof FAMILIES)[number];

function familyOf(accentHex: string): Family {
  const n = accentHex.replace("#", "");
  const r = parseInt(n.substring(0, 2), 16) / 255;
  const g = parseInt(n.substring(2, 4), 16) / 255;
  const b = parseInt(n.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  // Greys and near-greys are their own bucket — running them through the hue
  // maths below would scatter them across whichever channel won by a hair.
  if (delta < 0.12) return "Neutral";
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  // 10°, not 20°: a dulled orange (Terracotta, Kiln, Hearth) sits at 14-18°
  // and read as Pink; the wines and roses all sit above 330° anyway.
  if (hue < 10 || hue >= 330) return "Pink";
  if (hue < 75) return "Warm";
  if (hue < 170) return "Green";
  if (hue < 255) return "Blue";
  if (hue < 290) return "Lavender";
  return "Pink";
}

function isDarkTheme(bgHex: string): boolean {
  const n = bgHex.replace("#", "");
  const r = parseInt(n.substring(0, 2), 16);
  const g = parseInt(n.substring(2, 4), 16);
  const b = parseInt(n.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors duration-200 ${
        active
          ? "border-[#1d1c1a] bg-[#1d1c1a] text-white"
          : "border-[#e1ddd6] bg-white text-[#4a4741] hover:bg-[#f5f3ef]"
      }`}
    >
      {label}
    </button>
  );
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
  const navigate = useNavigate();
  const { checklist } = useSearch({ from: "/store/theme" });
  const { user } = useSession();
  const { storeId } = useActiveStoreId();
  const { pickedThemeId, selectTheme } = useStoreTheme();
  const [previewing, setPreviewing] = useState<ThemeId | null>(null);
  const [previewMode, setPreviewMode] = useState<"view" | "edit">("view");
  // Themes this store has an actual store_theme_customizations row for —
  // used only to decide whether "Use this theme" should ask first, not to
  // render anything (see PublicStorefront for the render-time read).
  const [customizedThemes, setCustomizedThemes] = useState<Set<ThemeId>>(new Set());
  const [confirmUse, setConfirmUse] = useState<ThemeId | null>(null);
  // Raw stores.theme_id, kept for the checklist flow below. This predates
  // useStoreTheme() exposing `pickedThemeId` and now carries the same
  // information, so the two could be collapsed — left alone here only to keep
  // this change to the selection bug.
  const [themeIdSet, setThemeIdSet] = useState(false);
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<Family | null>(null);
  const [tone, setTone] = useState<"light" | "dark" | null>(null);

  // 43 themes in one flat grid is a wall to scroll, not a catalogue to
  // browse, so the grid is filtered rather than paginated — a seller looking
  // for "something pink and dark" gets there in two taps.
  const visibleThemes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return THEMES.filter((theme) => {
      if (family && familyOf(theme.accent) !== family) return false;
      if (tone && (tone === "dark") !== isDarkTheme(theme.background)) return false;
      if (!q) return true;
      return (
        theme.name.toLowerCase().includes(q) ||
        theme.eyebrow.toLowerCase().includes(q) ||
        theme.description.toLowerCase().includes(q)
      );
    });
  }, [query, family, tone]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("stores")
      .select("theme_id")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("StoreThemeSelector: failed to load theme status", error);
        setThemeIdSet(!!data?.theme_id);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (!checklist || !user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("personal_username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setOwnUsername(data.personal_username);
      });
    return () => {
      cancelled = true;
    };
  }, [checklist, user]);

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
    if (pickedThemeId !== themeId && !customizedThemes.has(themeId)) {
      setConfirmUse(themeId);
      return;
    }
    void selectTheme(themeId);
    setThemeIdSet(true);
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

        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#dfdcd5] bg-white px-4 py-3">
            <Search size={18} className="shrink-0 text-[#8d8981]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search themes"
              aria-label="Search themes"
              className="w-full bg-transparent text-[15px] text-[#1c1b19] placeholder:text-[#a5a199] focus:outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X size={16} className="text-[#8d8981]" />
              </button>
            )}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <FilterChip
              label="All"
              active={!family && !tone}
              onClick={() => {
                setFamily(null);
                setTone(null);
              }}
            />
            {FAMILIES.map((f) => (
              <FilterChip
                key={f}
                label={f}
                active={family === f}
                onClick={() => setFamily((cur) => (cur === f ? null : f))}
              />
            ))}
            <FilterChip
              label="Light"
              active={tone === "light"}
              onClick={() => setTone((t) => (t === "light" ? null : "light"))}
            />
            <FilterChip
              label="Dark"
              active={tone === "dark"}
              onClick={() => setTone((t) => (t === "dark" ? null : "dark"))}
            />
          </div>
        </div>

        {visibleThemes.length === 0 && (
          <p className="py-16 text-center text-sm text-[#8c8881]">
            No theme matches that. Try a different colour or clear the filters.
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {visibleThemes.map((theme) => {
            const isSelected = pickedThemeId === theme.id;
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

        {checklist && themeIdSet && ownUsername && (
          <button
            type="button"
            onClick={() =>
              navigate({ to: "/profile/$username", params: { username: ownUsername } })
            }
            className="mt-6 w-full rounded-xl bg-[#1d1c1a] py-3.5 text-sm font-semibold text-white oak-motion-control active:scale-[0.98]"
          >
            Next — see your store front
          </button>
        )}
      </div>

      {previewTheme && (
        <ThemePreviewSheet
          theme={previewTheme}
          isSelected={pickedThemeId === previewTheme.id}
          initialMode={previewMode}
          onClose={() => setPreviewing(null)}
          onSelect={() => {
            void selectTheme(previewTheme.id);
            setThemeIdSet(true);
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
                  setThemeIdSet(true);
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
