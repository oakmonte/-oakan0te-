import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { readIntent, type Intent } from "@/lib/onboarding-state";
import { nextStep, previousStep, stepPosition } from "@/lib/onboarding-flow";
import {
  FormError,
  OnboardingChecking,
  OnboardingShell,
} from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";

export const Route = createFileRoute("/where-did-you-hear-about-us")({
  head: () => ({ meta: [{ title: "Where did you hear about us — Oakmonte" }] }),
  component: WhereDidYouHearPage,
});

const SELLER_OPTIONS = [
  "Instagram",
  "TikTok",
  "Youtube",
  "Online Articles",
  "A friend",
  "Google search",
  "Twitter",
  "Other",
];
const CREATOR_OPTIONS = [
  "Instagram",
  "TikTok",
  "Youtube",
  "A friend",
  "Another creator",
  "Twitter",
  "Other",
];
const CURATOR_OPTIONS = [
  "Instagram",
  "TikTok",
  "A friend",
  "Google search",
  "Online Articles",
  "Twitter",
  "Other",
];

const OPTIONS: Record<Intent, string[]> = {
  seller: SELLER_OPTIONS,
  creator: CREATOR_OPTIONS,
  curator: CURATOR_OPTIONS,
};

function WhereDidYouHearPage() {
  const navigate = useNavigate();
  const { userId, checking } = useRequireSession();
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read after mount: reading storage during render served the seller list
  // from the server and swapped it on hydration.
  const [intent, setIntentState] = useState<Intent | null>(null);

  useEffect(() => {
    setIntentState(readIntent() ?? "seller");
  }, []);

  // profiles.account_type is the durable record — prefer it over local state.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("account_type")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.account_type) setIntentState(data.account_type as Intent);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const options = OPTIONS[intent ?? "seller"];

  const choose = (option: string) => {
    if (option === "Other") {
      setShowOther(true);
      return;
    }
    void save(option);
  };

  const save = async (value: string) => {
    if (!userId || !value.trim()) return;
    setError(null);
    setPending(value);

    // This used to discard the update result entirely, so a failed write looked
    // identical to a successful one and the answer silently vanished.
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ referral_source: value.trim() })
      .eq("id", userId);

    if (updateError) {
      setPending(null);
      setError("Couldn't save that — please try again.");
      console.error(updateError);
      return;
    }

    const resolved = intent ?? readIntent() ?? "seller";
    const next = nextStep(resolved, "/where-did-you-hear-about-us");
    navigate(next ? { to: next } : { to: "/" });
  };

  if (checking || !intent) return <OnboardingChecking />;

  return (
    <OnboardingShell
      title="Where did you hear about us?"
      subtitle="So we know who to appreciate."
      backTo={previousStep(intent, "/where-did-you-hear-about-us")}
      step={stepPosition(intent, "/where-did-you-hear-about-us")}
    >
      {!showOther ? (
        <div className="space-y-3">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              disabled={pending !== null}
              className="w-full rounded-full border border-brand-text/25 py-3.5 text-sm font-medium hover:border-brand-text/50 hover:bg-brand-text/5 transition-all duration-200 disabled:opacity-50"
            >
              {pending === option ? "Saving…" : option}
            </button>
          ))}
          <FormError>{error}</FormError>
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="referral-other" className="sr-only">
            Where did you hear about us?
          </label>
          <input
            id="referral-other"
            type="text"
            autoFocus
            value={other}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save(other);
              }
            }}
            placeholder="Tell us where"
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
          />
          <button
            type="button"
            onClick={() => void save(other)}
            // Continuing with an empty box used to save the literal string
            // "Other", which is indistinguishable from not answering.
            disabled={pending !== null || !other.trim()}
            className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 transition-all duration-300 disabled:opacity-40"
          >
            {pending ? "Saving…" : "Continue"}
          </button>
          <FormError>{error}</FormError>
          <button
            type="button"
            onClick={() => {
              setShowOther(false);
              setOther("");
              setError(null);
            }}
            className="w-full text-[11px] uppercase tracking-widest text-brand-text/60 hover:text-brand-text transition-colors pt-1"
          >
            ← Back to the list
          </button>
        </div>
      )}
    </OnboardingShell>
  );
}
