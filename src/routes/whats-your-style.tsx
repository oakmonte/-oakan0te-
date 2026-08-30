import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
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
  head: () => ({ meta: [{ title: "What's your style — Oakmonte" }] }),
  component: WhatsYourStylePage,
});

const CATEGORIES = Object.keys(STYLE_CATEGORIES) as StyleCategory[];

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
  // Custom entries the user has typed in, kept separate from the seed list so
  // they render at the end of their category instead of reshuffling the chips
  // the user is already looking at.
  const [customByCategory, setCustomByCategory] = useState<Record<StyleCategory, string[]>>({
    Fashion: [],
    Cosmetics: [],
    Art: [],
  });
  const [draftByCategory, setDraftByCategory] = useState<Record<StyleCategory, string>>({
    Fashion: "",
    Cosmetics: "",
    Art: "",
  });
  const [addErrorByCategory, setAddErrorByCategory] = useState<
    Record<StyleCategory, string | null>
  >({
    Fashion: null,
    Cosmetics: null,
    Art: null,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const allOptionsFlat = useMemo(
    () => [
      ...CATEGORIES.flatMap((c) => STYLE_CATEGORIES[c]),
      ...CATEGORIES.flatMap((c) => customByCategory[c]),
    ],
    [customByCategory],
  );

  const toggle = (option: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  };

  const addCustom = (category: StyleCategory) => {
    const raw = draftByCategory[category];
    if (!raw.trim()) return;
    const result = validateCustomStyle(raw, allOptionsFlat);
    if (!result.ok) {
      setAddErrorByCategory((prev) => ({ ...prev, [category]: result.reason }));
      return;
    }
    setCustomByCategory((prev) => ({ ...prev, [category]: [...prev[category], result.value] }));
    setSelected((prev) => new Set(prev).add(result.value));
    setDraftByCategory((prev) => ({ ...prev, [category]: "" }));
    setAddErrorByCategory((prev) => ({ ...prev, [category]: null }));
  };

  const handleDraftKeyDown = (category: StyleCategory) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom(category);
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

  return (
    <OnboardingShell
      title="What's your style?"
      subtitle="Pick everything that fits — this helps us show you (and recommend you to) the right people."
      backTo={previousStep(intent, "/whats-your-style")}
      step={stepPosition(intent, "/whats-your-style")}
      onSkip={handleSkip}
    >
      <form onSubmit={handleSubmit} className="space-y-7 text-left">
        {CATEGORIES.map((category) => (
          <div key={category}>
            <h2 className="text-[11px] uppercase tracking-widest text-brand-text/50 mb-3">
              {category}
            </h2>
            <div className="flex flex-wrap gap-2">
              {[...STYLE_CATEGORIES[category], ...customByCategory[category]].map((option) => {
                const isSelected = selected.has(option);
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(option)}
                    className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-all duration-200 ${
                      isSelected
                        ? "bg-brand-text text-brand-bg border-brand-text"
                        : "border-brand-text/25 hover:border-brand-text/50 hover:bg-brand-text/5"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={draftByCategory[category]}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraftByCategory((prev) => ({ ...prev, [category]: value }));
                  if (addErrorByCategory[category]) {
                    setAddErrorByCategory((prev) => ({ ...prev, [category]: null }));
                  }
                }}
                onKeyDown={handleDraftKeyDown(category)}
                placeholder={`Add your own ${category.toLowerCase()} style`}
                maxLength={30}
                className="flex-1 min-w-0 rounded-full border border-brand-text/15 bg-transparent px-4 py-2 text-[13px] placeholder:text-brand-text/35 focus:outline-none focus:border-brand-accent transition-colors"
              />
              <button
                type="button"
                onClick={() => addCustom(category)}
                aria-label={`Add custom ${category.toLowerCase()} style`}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full border border-brand-text/25 hover:border-brand-text/50 hover:bg-brand-text/5 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {addErrorByCategory[category] && (
              <p role="alert" className="text-xs text-red-600 mt-1.5">
                {addErrorByCategory[category]}
              </p>
            )}
          </div>
        ))}

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
