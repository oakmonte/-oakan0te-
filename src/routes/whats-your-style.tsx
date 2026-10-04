import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Plus, Search, X } from "lucide-react";
import { readIntent, type Intent } from "@/lib/onboarding-state";
import { nextRoute, previousStep, stepPosition } from "@/lib/onboarding-flow";
import { STYLE_CATEGORIES, validateCustomStyle, type StyleCategory } from "@/lib/style-options";
import {
  FormError,
  OnboardingChecking,
  OnboardingShell,
} from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { usePrefetchNextStep } from "@/hooks/use-prefetch-next-step";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/whats-your-style")({
  head: () => ({
    // White page, so the iOS status strip must be white too — the root
    // default is #000000 and would otherwise paint a black band above it.
    meta: [{ title: "What's your style — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: WhatsYourStylePage,
});

type Filter = "All" | StyleCategory;
// Order the person asked for: All, Fashion, Art, Cosmetics.
const FILTERS: readonly Filter[] = ["All", "Fashion", "Art", "Cosmetics"];

type StyleItem = {
  label: string;
  /** Null for something typed in while "All" was showing: it belongs to no
   *  category, so it appears under All only. */
  category: StyleCategory | null;
};

const SEED_ITEMS: StyleItem[] = (Object.keys(STYLE_CATEGORIES) as StyleCategory[]).flatMap(
  (category) => STYLE_CATEGORIES[category].map((label) => ({ label, category })),
);

function WhatsYourStylePage() {
  const navigate = useNavigate();
  const { userId, checking } = useRequireSession();
  // Read after mount, same reasoning as the rest of onboarding: reading
  // storage during render served a stale value from the server on hydration.
  const [intent, setIntentState] = useState<Intent | null>(null);
  usePrefetchNextStep(intent, "/whats-your-style");

  useEffect(() => {
    setIntentState(readIntent() ?? "creator");
  }, []);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Typed-in entries sit in the same list as the seeded ones, after them, so
  // adding one never reshuffles the chips the person is already looking at.
  const [custom, setCustom] = useState<StyleItem[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const allItems = useMemo(() => [...SEED_ITEMS, ...custom], [custom]);
  const allLabels = useMemo(() => allItems.map((item) => item.label), [allItems]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allItems.filter(
      (item) =>
        (filter === "All" || item.category === filter) &&
        (needle === "" || item.label.toLowerCase().includes(needle)),
    );
  }, [allItems, filter, query]);

  const toggle = (option: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  };

  // The + turns whatever is in the search box into a new style, filed under
  // the active filter (or under All only, when no filter is picked).
  const addCustom = () => {
    if (!query.trim()) {
      setAddError("Type your style in the box first, then tap +.");
      return;
    }
    const result = validateCustomStyle(query, allLabels);
    if (!result.ok) {
      setAddError(result.reason);
      return;
    }
    setCustom((prev) => [
      ...prev,
      { label: result.value, category: filter === "All" ? null : filter },
    ]);
    setSelected((prev) => new Set(prev).add(result.value));
    setQuery("");
    setAddError(null);
  };

  const handleQueryKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter never submits the form from here; it adds, like the + does.
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  };

  const finish = () => {
    navigate({ to: nextRoute(intent, "/whats-your-style"), replace: true });
  };

  // Upsert, not update: find-your-fit's Submit already created a fit_profiles
  // row with the body data, but Skip doesn't (there's nothing to write yet),
  // so this can't assume one exists. fit_profiles is shared across roles —
  // not per creator/curator table — so someone who already answered these
  // via the other role never reaches this page at all (resolvePostAuthRedirect
  // reuses their existing data instead).
  const save = async (styles: string[]) => {
    if (!userId || saving) return;
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from("fit_profiles")
      .upsert({ owner_id: userId, styles }, { onConflict: "owner_id" });
    setSaving(false);
    if (error) {
      console.error("whats-your-style: failed to save", error);
      setSaveError("Couldn't save that — please try again.");
      return;
    }
    finish();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save(Array.from(selected));
  };

  // Skip still has to write an (empty) array — resolvePostAuthRedirect reads
  // a null `styles` as "abandoned here", so leaving it null on skip would ask
  // again on every future sign-in, same trap find-your-fit's own skip avoids.
  const handleSkip = () => void save([]);

  if (checking || !intent) return <OnboardingChecking />;

  const trimmedQuery = query.trim();

  return (
    <OnboardingShell
      title="What's your style?"
      subtitle="Pick everything that fits — this helps us show you (and recommend you to) the right people."
      backTo={previousStep(intent, "/whats-your-style")}
      step={stepPosition(intent, "/whats-your-style")}
      onSkip={handleSkip}
      topAligned
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-brand-text/25 px-4 focus-within:border-brand-accent transition-colors">
              <Search size={16} className="shrink-0 text-brand-text/40" />
              <input
                type="text"
                enterKeyHint="done"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                maxLength={30}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (addError) setAddError(null);
                }}
                onKeyDown={handleQueryKeyDown}
                placeholder="Search or add your own"
                aria-label="Search styles, or type your own to add"
                className="w-full min-w-0 bg-transparent text-base placeholder:text-brand-text/40 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setAddError(null);
                  }}
                  aria-label="Clear search"
                  className="-mr-2 grid h-8 w-8 shrink-0 place-items-center"
                >
                  <X size={15} className="text-brand-text/40" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={addCustom}
              aria-label="Add your own style"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-brand-text/25 transition-colors hover:border-brand-text/50 hover:bg-brand-text/5 active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>
          {addError && (
            <p role="alert" className="mt-1.5 px-1 text-xs text-red-600">
              {addError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter styles">
          {FILTERS.map((name) => {
            const active = filter === name;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(name)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-brand-accent text-brand-bg"
                    : "bg-brand-text/[0.06] text-brand-text/70 hover:bg-brand-text/10"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2" aria-live="polite">
          {visible.map(({ label }) => {
            const isSelected = selected.has(label);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(label)}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
                  isSelected
                    ? "bg-brand-text text-brand-bg border-brand-text"
                    : "border-brand-text/25 hover:border-brand-text/50 hover:bg-brand-text/5"
                }`}
              >
                {label}
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="px-1 py-2 text-sm text-brand-text/50">
              {trimmedQuery
                ? `Nothing matches “${trimmedQuery}”. Tap + to add it as your own.`
                : "Nothing here yet."}
            </p>
          )}
        </div>

        <FormError>{saveError}</FormError>

        <button
          type="submit"
          disabled={saving || selected.size === 0}
          className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </OnboardingShell>
  );
}
