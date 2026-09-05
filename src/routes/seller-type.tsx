import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { readStoreDraft, setStoreDraft } from "@/lib/onboarding-state";
import { nextRoute, previousStep, stepPosition } from "@/lib/onboarding-flow";
import { OnboardingChecking, OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { usePrefetchNextStep } from "@/hooks/use-prefetch-next-step";

export const Route = createFileRoute("/seller-type")({
  head: () => ({ meta: [{ title: "What kind of seller are you — Oakmonte" }] }),
  component: SellerTypePage,
});

// Tailor is the one option where "seller" only fits if they made the thing
// themselves — worth saying explicitly, since Brand/Vendor don't carry that
// same implication. Artist gets its own hint spelling out the range covered.
const OPTIONS: { label: string; hint?: string }[] = [
  { label: "Brand" },
  { label: "Vendor" },
  { label: "Tailor", hint: "From sewing to leather works, As long as you personally make it" },
  { label: "Artist", hint: "From painting to sculpting" },
];

function SellerTypePage() {
  const navigate = useNavigate();
  const { checking } = useRequireSession();
  usePrefetchNextStep("seller", "/seller-type");
  const [sellerType, setSellerType] = useState<string | null>(null);
  const [customOrders, setCustomOrders] = useState(false);

  // Restore a previous answer so the Back link isn't destructive.
  useEffect(() => {
    const draft = readStoreDraft();
    if (draft.storeType) setSellerType(draft.storeType);
    setCustomOrders(draft.customOrders);
  }, []);

  const handleContinue = () => {
    if (!sellerType) return;
    setStoreDraft({ storeType: sellerType, customOrders });
    navigate({ to: nextRoute("seller", "/seller-type") });
  };

  if (checking) return <OnboardingChecking />;

  return (
    <OnboardingShell
      title="What kind of seller are you?"
      subtitle="This just helps us tailor the next few steps."
      backTo={previousStep("seller", "/seller-type")}
      step={stepPosition("seller", "/seller-type")}
    >
      <div className="space-y-3 mb-6" role="radiogroup" aria-label="Seller type">
        {OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={sellerType === option.label}
            onClick={() => setSellerType(option.label)}
            className={`w-full rounded-2xl border py-3.5 text-sm font-medium transition-all duration-200 ${
              sellerType === option.label
                ? "bg-brand-text text-brand-bg border-brand-text"
                : "border-brand-text/25 hover:border-brand-text/50 hover:bg-brand-text/5"
            }`}
          >
            {option.label}
            {option.hint && (
              <span
                className={`block text-[11px] font-normal mt-0.5 ${
                  sellerType === option.label ? "text-brand-bg/70" : "text-brand-text/50"
                }`}
              >
                {option.hint}
              </span>
            )}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between gap-3 px-2 py-3 mb-6 cursor-pointer">
        <span className="text-sm text-left">I offer custom orders</span>
        <button
          type="button"
          role="switch"
          aria-checked={customOrders}
          aria-label="I offer custom orders"
          onClick={() => setCustomOrders((v) => !v)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
            customOrders ? "bg-brand-accent" : "bg-brand-text/20"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-brand-bg transition-transform duration-200 ${
              customOrders ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </label>

      <button
        type="button"
        onClick={handleContinue}
        disabled={!sellerType}
        className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-40"
      >
        Continue
      </button>
    </OnboardingShell>
  );
}
