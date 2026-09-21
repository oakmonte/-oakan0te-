import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Palette, Wallet, Package, MapPin, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useStoreSetupStatus } from "@/hooks/use-store-setup-status";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";
import { isInstallablePhone } from "@/lib/platform";
import { isStandalone } from "@/lib/standalone";
import { Skeleton } from "@/components/ui/skeleton";

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
  const {
    loading: statusLoading,
    payoutSet,
    locationCount,
    productCount,
    themeIdSet,
    installedApp,
    setLocationCount,
  } = useStoreSetupStatus(storeId ?? null);
  const [locationsSheetOpen, setLocationsSheetOpen] = useState(false);
  // Both read `navigator` / a media query, so both are set from an effect and
  // never a useState initialiser -- the hydration rule in platform.ts. Until
  // the effect runs this renders the desktop checklist, which is the safe
  // default: a card that appears a frame late beats one that vanishes.
  const [canInstallHere, setCanInstallHere] = useState(false);
  const [inApp, setInApp] = useState(false);
  // Whether the two reads above have actually run. Needed as its own flag
  // because `false` is both their initial value and a real answer, and the
  // checklist below must not paint until it knows which it is holding.
  const [platformReady, setPlatformReady] = useState(false);

  useEffect(() => {
    setCanInstallHere(isInstallablePhone());
    setInApp(isStandalone());
    setPlatformReady(true);
  }, []);
  // Set when a step is tapped before every step before it is done — holds
  // which step to actually run if the seller taps through anyway.
  //
  // Keyed rather than indexed, because the array below is conditionally sized:
  // the install card is only present on a phone. An index captured against one
  // length and read back against another points at the wrong step, or past the
  // end. That cannot happen today — `canInstallHere` settles in the mount
  // effect, before any tap — but it is true by accident, and the obvious next
  // edit (dropping the card once installed) would make the array shrink while
  // a warning is open.
  const [orderWarningKey, setOrderWarningKey] = useState<string | null>(null);

  const steps = [
    {
      key: "payout",
      label: "Get paid",
      description: payoutSet
        ? "Payout account added — pending verification."
        : "Add your bank account details so you can get paid.",
      icon: Wallet,
      done: payoutSet,
      go: () => navigate({ to: "/store/finance", search: { checklist: true } }),
    },
    {
      key: "locations",
      label: "Pickup locations",
      description: locationCount
        ? `${locationCount} location${locationCount === 1 ? "" : "s"} saved — tap to manage.`
        : "Add every store or warehouse riders can collect orders from.",
      icon: MapPin,
      done: !!locationCount,
      go: () => setLocationsSheetOpen(true),
    },
    // Hidden entirely on desktop rather than shown as an impossible step: a
    // laptop cannot put anything on a home screen, so the card would be a
    // permanent blocker with no way through. Sellers on a laptop get four
    // steps; sellers on a phone get five.
    ...(canInstallHere
      ? [
          {
            key: "webapp",
            label: "Get the webapp",
            description: installedApp
              ? "Installed — carry on from the app."
              : "Put Oakmonte on your home screen. The rest of setup lives there.",
            icon: Smartphone,
            done: installedApp,
            go: () => navigate({ to: "/store/get-the-webapp", search: { checklist: true } }),
          },
        ]
      : []),
    {
      key: "products",
      label: "List products",
      description: productCount
        ? `${productCount} product${productCount === 1 ? "" : "s"} listed.`
        : "Add items or import your existing catalog.",
      icon: Package,
      done: !!productCount,
      go: () => navigate({ to: "/store/products", search: { checklist: true } }),
    },
    {
      key: "theme",
      label: "Customise your store front",
      description: "Choose how your store should look like.",
      icon: Palette,
      done: themeIdSet,
      go: () => navigate({ to: "/store/theme", search: { checklist: true } }),
    },
  ];

  // Whether the step being warned about sits past the install step, and the
  // install still hasn't happened, and we're reading this in a browser tab
  // rather than the app. That combination gets its own copy: "you're about to
  // do the rest of this in the wrong place" is a different message from "these
  // steps have a recommended order", and the generic one doesn't explain why
  // it matters. Still only a nudge -- the skip-ahead button below works either
  // way, because a seller who insists is better served than blocked.
  const webappIndex = steps.findIndex((s) => s.key === "webapp");
  // -1 when no warning is open, and also when the warned-about step has since
  // disappeared from the list — both mean "render nothing", which is why every
  // read below goes through this rather than through the key.
  const warnIndex = orderWarningKey ? steps.findIndex((s) => s.key === orderWarningKey) : -1;
  const blockedByInstall =
    warnIndex !== -1 &&
    webappIndex !== -1 &&
    warnIndex > webappIndex &&
    // Never accuse someone of not having the app while we are still finding
    // out. `installedApp` is false both for "hasn't installed" and for "the
    // session hasn't resolved yet", and only `statusLoading` tells them apart.
    !statusLoading &&
    !installedApp &&
    !inApp;
  const firstIncomplete = steps.findIndex((s) => !s.done);

  // The checklist waits for BOTH of these before it paints anything real.
  // Rendering early meant the cards arrived first, every step looking
  // undone, and the amber done-dots then popped in one network round-trip
  // later — so a seller watched their finished work appear to be unfinished.
  // The install card has the same problem a frame earlier: it is absent until
  // the platform check runs, so the list grew from four rows to five.
  const checklistLoading = statusLoading || !platformReady;

  function handleStepTap(index: number) {
    const priorIncomplete = steps.slice(0, index).some((s) => !s.done);
    if (priorIncomplete) {
      setOrderWarningKey(steps[index].key);
      return;
    }
    steps[index].go();
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Your online store is starting to take shape</h1>
      <p className="text-sm text-gray-500 mb-6">We recommend this order for simplicity.</p>
      {checklistLoading && (
        <span className="sr-only" role="status">
          Loading your setup checklist
        </span>
      )}

      <div className="flex flex-col gap-3">
        {checklistLoading
          ? // Same box as a real row, so nothing moves when the real ones
            // replace it — only the contents resolve.
            Array.from({ length: steps.length }).map((_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4"
              >
                <Skeleton className="w-5 h-5 rounded-full shrink-0 mt-0.5" />
                <Skeleton className="w-[34px] h-[34px] rounded-full shrink-0" />
                <div className="flex-1 pt-1">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="mt-2 h-2.5 w-44 rounded" />
                </div>
              </div>
            ))
          : steps.map((step, i) => (
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
          fromChecklist
        />
      )}

      {warnIndex !== -1 && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <p className="text-base font-semibold tracking-[-0.02em] text-gray-900">
                {blockedByInstall ? "Finish this from the app" : "Follow the order?"}
              </p>
              <button
                type="button"
                onClick={() => setOrderWarningKey(null)}
                aria-label="Cancel"
                className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-50"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-5 text-gray-500">
              {blockedByInstall
                ? "Add Oakmonte to your home screen first, then do the rest from there. It keeps your camera permission and stops you signing in over and over."
                : "We recommend completing these steps in order to avoid confusion. You can still skip ahead if you'd rather."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  // The primary button has to actually take them somewhere.
                  // Dismissing back to the same list they just tapped from is
                  // what makes a dialog feel broken — it agreed with them and
                  // then did nothing. "Go in order" means: go to the first
                  // thing that isn't done.
                  const target = blockedByInstall ? webappIndex : firstIncomplete;
                  setOrderWarningKey(null);
                  if (target !== -1) steps[target].go();
                }}
                className="rounded-xl bg-black py-2.5 text-sm font-semibold text-white"
              >
                {blockedByInstall ? "Get the webapp" : "Go in order"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const index = warnIndex;
                  setOrderWarningKey(null);
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
