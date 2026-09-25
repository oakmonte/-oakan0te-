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
import { searchThemes } from "./store-themes/theme-search";
import { blocksBelowGrid, type LayoutId } from "./store-themes/layout-presets";
import { useStoreLiveDrop } from "@/hooks/use-store-live-drop";

// Written in the dashboard's --sd-* tokens like every other /store screen,
// but always rendered in their LIGHT values: /store/theme is held light by
// isHeldLight() (lib/surface.ts), because the cards are swatches of real
// storefront colours and the dark ones disappear on a dark page.

// Just the theme's real background + accent — a full storefront mockup here
// duplicated what Preview/Edit already show, and made every card ~400px
// tall for no reason. This is a colour reference, not a second preview.
function ThemeColorSwatch({ theme }: { theme: Theme }) {
  const textColor = readableTextColor(theme.background);
  return (
    <div
      className="flex h-24 flex-col justify-between rounded-xl p-4"
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

// Shared by the pinned "Your theme" card and the regular grid below it, so
// pulling the selected theme out of the grid (see StoreThemeSelector) doesn't
// mean maintaining two copies of this markup.
function ThemeCard({
  theme,
  matched,
  isSelected,
  onUse,
  onPreview,
  sticky,
  onStickyChange,
}: {
  theme: Theme;
  /** Search keywords this theme matched, shown so the seller can see why it
   * came up. Empty when there is no search, or it matched on its name. */
  matched: string[];
  isSelected: boolean;
  onUse: () => void;
  onPreview: (mode: "view" | "edit") => void;
  /** This theme's stick-to-page setting, or null when its layout has nothing
   * below the grid to stick, in which case there is no toggle at all. */
  sticky: boolean | null;
  onStickyChange: (next: boolean) => void;
}) {
  return (
    <article
      className={`rounded-2xl border bg-sd-surface p-3 transition-colors duration-200 ${
        // sd-line is a 10% hairline and read as barely there around a card
        // this size; the ink at 22% holds its edge without shouting.
        isSelected ? "border-sd-ink" : "border-sd-ink/[0.22]"
      }`}
    >
      <button
        type="button"
        onClick={onUse}
        className="oak-tap block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-sd-focus focus-visible:ring-offset-2"
        aria-pressed={isSelected}
        aria-label={`Select ${theme.name}`}
      >
        <ThemeColorSwatch theme={theme} />
      </button>

      <div className="px-1 pb-1 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-sd-ink">{theme.name}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-sd-ink-faint">
              {theme.eyebrow}
            </p>
          </div>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
              isSelected ? "border-transparent" : "border-sd-ink/30 text-transparent"
            }`}
            // The tick takes whichever of black/white reads on the accent. A
            // fixed white one vanished on the pale accents (Burgundy's
            // champagne, the golds, mint, lime).
            style={
              isSelected
                ? { backgroundColor: theme.accent, color: readableTextColor(theme.accent) }
                : undefined
            }
            aria-hidden="true"
          >
            <Check size={14} strokeWidth={3} className={isSelected ? "oak-motion-pop" : ""} />
          </span>
        </div>
        {matched.length > 0 && (
          <div
            className="mt-2.5 flex flex-wrap gap-1.5"
            role="group"
            aria-label="Matched your search"
          >
            {matched.map((word) => (
              <span
                key={word}
                className="rounded-full bg-sd-accent-tint px-2.5 py-1 text-[12px] font-medium text-sd-accent-ink"
              >
                {word}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2.5 text-[14px] leading-5 text-sd-ink-muted">{theme.description}</p>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPreview("edit")}
            className="oak-tap flex h-11 items-center justify-center gap-1.5 rounded-full bg-sd-soft text-[14px] font-medium text-sd-ink oak-motion-control active:scale-[0.98]"
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onPreview("view")}
            className="oak-tap flex h-11 items-center justify-center rounded-full bg-sd-soft text-[14px] font-medium text-sd-ink oak-motion-control active:scale-[0.98]"
          >
            Preview
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onUse}
            disabled={isSelected}
            className={`oak-tap flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold oak-motion-control active:scale-[0.98] ${
              isSelected ? "border border-sd-ink/[0.22] text-sd-ink-muted" : "bg-sd-ink text-sd-bg"
            }`}
          >
            {isSelected ? "Selected" : "Use this theme"}
            {!isSelected && <ChevronRight size={16} />}
          </button>
          {sticky !== null && (
            <button
              type="button"
              role="switch"
              aria-checked={sticky}
              aria-label="Stick bottom sections to the page"
              onClick={() => onStickyChange(!sticky)}
              className="oak-tap flex h-11 shrink-0 items-center gap-2 rounded-full bg-sd-soft pl-3.5 pr-2 text-[13px] font-medium text-sd-ink"
            >
              Stick bottom
              <span
                aria-hidden="true"
                className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${
                  sticky ? "bg-sd-ink" : "bg-sd-ink/20"
                }`}
              >
                <span
                  className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-sd-surface shadow-sm transition-transform duration-200 ${
                    sticky ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </span>
            </button>
          )}
        </div>
      </div>
    </article>
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
  // Per theme: what decides the card's stick-to-page toggle. Kept apart from
  // customizedThemes on purpose, so a row the toggle creates doesn't count as
  // "customized" and skip the placeholder-copy warning in handleUseTheme.
  const [stickRows, setStickRows] = useState<
    Map<ThemeId, { layoutId: LayoutId; hiddenBlocks: string[]; sticky: boolean }>
  >(new Map());
  const [rowsVersion, setRowsVersion] = useState(0);
  const liveDrop = useStoreLiveDrop(storeId);
  const [confirmUse, setConfirmUse] = useState<ThemeId | null>(null);
  // Raw stores.theme_id, kept for the checklist flow below. This predates
  // useStoreTheme() exposing `pickedThemeId` and now carries the same
  // information, so the two could be collapsed — left alone here only to keep
  // this change to the selection bug.
  const [themeIdSet, setThemeIdSet] = useState(false);
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");

  // Search is the only way to narrow 50 themes. It replaced the colour-family
  // and light/dark chips: every theme carries hand-written colour words and
  // mood words, plus "dark"/"light" from its own background, so "dark pink" or
  // "something cosy" does what two taps on chips used to. See theme-search.ts
  // for the matching rules, and why typos are a fallback there.
  const results = useMemo(() => searchThemes(query, THEMES), [query]);

  // Pulled out of the grid entirely so it can sit apart with real separation
  // — not just marked in place. Only pulled when it's actually among the
  // current search results, so pinning never fights a search that excludes it.
  const picked = results.find((m) => m.theme.id === pickedThemeId) ?? null;
  const rest = picked ? results.filter((m) => m.theme.id !== pickedThemeId) : results;

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
      .select("theme_slug, layout_id, hidden_blocks, sticky_bottom")
      .eq("store_id", storeId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("StoreThemeSelector: failed to load customizations", error);
        setCustomizedThemes(new Set((data ?? []).map((r) => r.theme_slug as ThemeId)));
        setStickRows(
          new Map(
            (data ?? []).map((r) => [
              r.theme_slug as ThemeId,
              {
                layoutId: r.layout_id as LayoutId,
                hiddenBlocks: r.hidden_blocks,
                sticky: r.sticky_bottom,
              },
            ]),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
    // rowsVersion: re-read after the editor closes, since a save there can
    // change the layout (and so whether the toggle applies) or the setting.
  }, [storeId, rowsVersion]);

  // A theme's stick-to-page state for its card, or null when its layout has
  // nothing below the grid (no toggle then). A theme with no saved row reads
  // as the editor's starting state, which is also what the column defaults
  // give a row created by the toggle below.
  function stickyFor(themeId: ThemeId): boolean | null {
    const row = stickRows.get(themeId) ?? {
      layoutId: "editorial",
      hiddenBlocks: [],
      sticky: false,
    };
    return blocksBelowGrid(row.layoutId, row.hiddenBlocks, liveDrop !== null).length > 0
      ? row.sticky
      : null;
  }

  // Writes only sticky_bottom: on an existing row the upsert updates just
  // that column, and a theme never customized gets a row of defaults plus
  // the setting. Optimistic, rolled back if the write fails.
  async function setSticky(themeId: ThemeId, next: boolean) {
    if (!storeId) return;
    const prev = stickRows.get(themeId);
    const base = prev ?? { layoutId: "editorial" as LayoutId, hiddenBlocks: [], sticky: false };
    setStickRows((m) => new Map(m).set(themeId, { ...base, sticky: next }));
    const { error } = await supabase
      .from("store_theme_customizations")
      .upsert(
        { store_id: storeId, theme_slug: themeId, sticky_bottom: next },
        { onConflict: "store_id,theme_slug" },
      );
    if (error) {
      console.error("StoreThemeSelector: failed to save stick-to-page", error);
      setStickRows((m) => {
        const copy = new Map(m);
        if (prev) copy.set(themeId, prev);
        else copy.delete(themeId);
        return copy;
      });
    }
  }

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
    <main
      className={`min-h-[calc(100vh-3.5rem)] bg-sd-bg px-4 py-5 ${
        // Room for the fixed Next bar below so it never covers the last row
        // of cards — only reserved while that bar can actually show.
        checklist ? "pb-32" : "pb-24"
      }`}
    >
      <div className="mx-auto max-w-6xl">
        <h1 className="text-lg font-semibold text-sd-ink">Store theme</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-sd-ink-faint">
          How your storefront looks. You can switch any time.
        </p>

        <div className="mb-6 mt-4 flex h-11 items-center gap-2 rounded-full bg-sd-soft px-4">
          <Search size={17} className="shrink-0 text-sd-ink-faint" />
          <input
            // type="text" rather than "search" so iOS draws no clear button
            // of its own beside ours. Autocorrect is off because the search
            // already forgives typos, and iOS "fixing" a word first turns
            // "burgandy" into something no theme is called.
            type="text"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a colour, a mood, or a name"
            aria-label="Search themes"
            className="w-full min-w-0 bg-transparent text-base text-sd-ink outline-none placeholder:text-sd-ink-faint"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="oak-tap -mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full"
            >
              <X size={16} className="text-sd-ink-faint" />
            </button>
          )}
        </div>

        {/* Read out as the seller types, not shown: the visible count was
            removed on purpose, but a screen-reader user still needs to hear
            what a search left them with. */}
        <p className="sr-only" role="status" aria-live="polite">
          {query.trim()
            ? results.length === 0
              ? "No themes match"
              : `${results.length} ${results.length === 1 ? "theme" : "themes"}`
            : ""}
        </p>

        {results.length === 0 && (
          <p className="py-16 text-center text-[15px] text-sd-ink-faint">
            No theme matches that. Try a colour like “green”, or a mood like “calm”.
          </p>
        )}

        {picked && (
          <div className="mb-8 border-b border-sd-line pb-8">
            <p className="mb-3 text-[13px] font-medium text-sd-ink-muted">Your theme</p>
            <div className="grid gap-4 lg:grid-cols-3">
              <ThemeCard
                theme={picked.theme}
                matched={picked.matched}
                isSelected
                onUse={() => handleUseTheme(picked.theme.id)}
                onPreview={(mode) => openPreview(picked.theme.id, mode)}
                sticky={stickyFor(picked.theme.id)}
                onStickyChange={(next) => void setSticky(picked.theme.id, next)}
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          {rest.map(({ theme, matched }) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              matched={matched}
              isSelected={pickedThemeId === theme.id}
              onUse={() => handleUseTheme(theme.id)}
              onPreview={(mode) => openPreview(theme.id, mode)}
              sticky={stickyFor(theme.id)}
              onStickyChange={(next) => void setSticky(theme.id, next)}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-[13px] text-sd-ink-faint">
          Your storefront content stays yours — a theme only changes how it is presented.
        </p>
      </div>

      {checklist && themeIdSet && ownUsername && (
        // Fixed to the device, not the scroll container — the theme grid
        // above scrolls freely behind it instead of carrying the button away
        // with the last row of cards.
        <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-sd-bg via-sd-bg/95 to-transparent px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="mx-auto max-w-6xl">
            <button
              type="button"
              onClick={() =>
                navigate({ to: "/profile/$username", params: { username: ownUsername } })
              }
              className="oak-tap h-12 w-full rounded-full bg-sd-ink text-[15px] font-semibold text-sd-bg oak-motion-control active:scale-[0.98]"
            >
              Next — see your store front
            </button>
          </div>
        </div>
      )}

      {previewTheme && (
        <ThemePreviewSheet
          theme={previewTheme}
          isSelected={pickedThemeId === previewTheme.id}
          initialMode={previewMode}
          onClose={() => {
            setPreviewing(null);
            setRowsVersion((v) => v + 1);
          }}
          onSelect={() => {
            void selectTheme(previewTheme.id);
            setThemeIdSet(true);
            setPreviewing(null);
            setRowsVersion((v) => v + 1);
          }}
        />
      )}

      {confirmTheme && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-sd-scrim px-4 pb-8 animate-in fade-in duration-200 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-sd-surface p-5 shadow-[var(--sd-shadow-float)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[16px] font-semibold tracking-[-0.01em] text-sd-ink">
                Customize {confirmTheme.name} first?
              </p>
              <button
                type="button"
                onClick={() => setConfirmUse(null)}
                aria-label="Cancel"
                className="oak-tap -mr-2 -mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sd-ink-faint"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1.5 text-[14px] leading-5 text-sd-ink-muted">
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
                className="oak-tap flex h-11 items-center justify-center gap-1.5 rounded-full bg-sd-ink text-[14px] font-semibold text-sd-bg oak-motion-control active:scale-[0.98]"
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
                className="oak-tap h-11 rounded-full bg-sd-soft text-[14px] font-medium text-sd-ink oak-motion-control active:scale-[0.98]"
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
