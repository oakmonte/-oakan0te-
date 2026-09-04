import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Palette, Wallet, Package, MapPin, X } from "lucide-react";
import { useState } from "react";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useStoreSetupStatus } from "@/hooks/use-store-setup-status";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

function StepNumber({ n }: { n: number }) {
  return (
    <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-medium flex items-center justify-center shrink-0 mt-0.5">
      {n}
    </span>
  );
}

function StoreHome() {
  const navigate = useNavigate();
  const { storeId } = useActiveStoreId();
  // Raw stores.theme_id (via themeIdSet below), not useStoreTheme()'s value —
  // that hook defaults an unset theme_id to "motion" client-side (see
  // store-profile page's own comment on this), so it's never null and can't
  // tell us whether the seller has actually picked one yet.
  const { payoutSet, locationCount, productCount, themeIdSet, setLocationCount } =
    useStoreSetupStatus(storeId ?? null);
  const [locationsSheetOpen, setLocationsSheetOpen] = useState(false);
  // Set when a step is tapped before every step before it is done — holds
  // which step to actually run if the seller taps through anyway.
  const [orderWarningIndex, setOrderWarningIndex] = useState<number | null>(null);

  const steps = [
    {
      label: "Get paid",
      description: payoutSet
        ? "Payout account added — pending verification."
        : "Add your bank account details so you can get paid.",
      icon: Wallet,
      done: payoutSet,
      go: () => navigate({ to: "/store/finance", search: { checklist: true } }),
    },
    {
      label: "Pickup locations",
      description: locationCount
        ? `${locationCount} location${locationCount === 1 ? "" : "s"} saved — tap to manage.`
        : "Add every store or warehouse riders can collect orders from.",
      icon: MapPin,
      done: !!locationCount,
      go: () => setLocationsSheetOpen(true),
    },
    {
      label: "List products",
      description: productCount
        ? `${productCount} product${productCount === 1 ? "" : "s"} listed.`
        : "Add items or import your existing catalog.",
      icon: Package,
      done: !!productCount,
      go: () => navigate({ to: "/store/products", search: { checklist: true } }),
    },
    {
      label: "Customise your store front",
      description: "Choose how your store should look like.",
      icon: Palette,
      done: themeIdSet,
      go: () => navigate({ to: "/store/theme", search: { checklist: true } }),
    },
  ];

  function handleStepTap(index: number) {
    const priorIncomplete = steps.slice(0, index).some((s) => !s.done);
    if (priorIncomplete) {
      setOrderWarningIndex(index);
      return;
    }
    steps[index].go();
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Your online store is starting to take shape</h1>
      <p className="text-sm text-gray-500 mb-6">We recommend this order for simplicity.</p>

      <div className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <button
            key={step.label}
            type="button"
            onClick={() => handleStepTap(i)}
            className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 oak-motion-control text-left"
          >
            <StepNumber n={i + 1} />
            <div className="p-2 rounded-full bg-gray-100 relative">
              <step.icon size={18} />
              {step.done && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white oak-motion-pop" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
            </div>
          </button>
        ))}
      </div>

      {locationsSheetOpen && storeId && (
        <LocationsListSheet
          storeId={storeId}
          onClose={() => setLocationsSheetOpen(false)}
          onCountChange={setLocationCount}
        />
      )}

      {orderWarningIndex !== null && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold tracking-[-0.02em] text-gray-900">
                Follow the order?
              </p>
              <button
                type="button"
                onClick={() => setOrderWarningIndex(null)}
                aria-label="Cancel"
                className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-50"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-5 text-gray-500">
              We recommend completing these steps in order to avoid confusion. You can still skip
              ahead if you'd rather.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOrderWarningIndex(null)}
                className="rounded-xl bg-black py-2.5 text-sm font-semibold text-white"
              >
                Go in order
              </button>
              <button
                type="button"
                onClick={() => {
                  const index = orderWarningIndex;
                  setOrderWarningIndex(null);
                  steps[index].go();
                }}
                className="rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Skip ahead anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
