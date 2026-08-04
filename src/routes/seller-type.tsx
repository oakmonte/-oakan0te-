import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/seller-type")({
  head: () => ({ meta: [{ title: "What kind of seller are you — Oakmonte" }] }),
  component: SellerTypePage,
});

const OPTIONS = ["Brand", "Boutique"];

function SellerTypePage() {
  const navigate = useNavigate();
  const [sellerType, setSellerType] = useState<string | null>(null);
  const [customOrders, setCustomOrders] = useState(false);

  const handleContinue = () => {
    if (!sellerType) return;
    sessionStorage.setItem("oakmonte_store_type", sellerType);
    sessionStorage.setItem("oakmonte_custom_orders", String(customOrders));
    navigate({ to: "/where-did-you-hear-about-us" });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">
          What kind of seller are you?
        </h1>
        <p className="text-sm text-brand-text/70 mb-8">
          This just helps us tailor the next few steps.
        </p>

        <div className="space-y-3 mb-6">
          {OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSellerType(option)}
              className={`w-full rounded-full border py-3.5 text-sm font-medium transition-all duration-200 ${
                sellerType === option
                  ? "bg-brand-text text-brand-bg border-brand-text"
                  : "border-brand-text/25 hover:border-brand-text/50 hover:bg-brand-text/5"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between gap-3 px-2 py-3 mb-6 cursor-pointer">
          <span className="text-sm text-left">I offer custom orders</span>
          <button
            type="button"
            role="switch"
            aria-checked={customOrders}
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
      </div>
    </div>
  );
}
