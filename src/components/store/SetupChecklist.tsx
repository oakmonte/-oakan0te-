import { useNavigate } from "@tanstack/react-router";
import { Palette, Wallet, Package, MapPin, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useActiveStoreId } from "@/hooks/use-own-store";
import type { StoreSetupStatus } from "@/hooks/use-store-setup-status";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";
import { isInstallablePhone } from "@/lib/platform";
import { isStandalone } from "@/lib/standalone";
import { Skeleton } from "@/components/ui/skeleton";
import { payoutStepState, plainStepState, type StepState } from "@/lib/setup-step-state";

function StepNumber({ n }: { n: number }) {
  // Deliberately quiet. These are ordinals, not emphasis -- five solid black
  // circles down the left edge competed with the status marks, which are the
  // thing on this screen actually carrying information.
  return (
    <span className="w-5 h-5 rounded-full bg-sd-soft text-sd-ink-muted text-[11px] font-medium flex items-center justify-center shrink-0 mt-0.5">
      {n}
    </span>
  );
}

/** The dot on a step's icon.
 *
 *  All three states occupy the same 14px box, so a step changing state never
 *  shifts the row. `ring-sd-surface` rather than a white border: the halo has to
 *  be cut out of whatever the card behind it is, which is not white in dark
 *  mode. */
function StatusMark({ state }: { state: StepState }) {
  if (state === "todo") {
    return (
      <span
        aria-hidden
        // A border, not an inset box-shadow. `ring-2` also compiles to
        // box-shadow, so the two composed into Tailwind's shadow variable chain
        // and the hollow ring silently never painted -- the "not started" mark
        // was an invisible transparent circle. Caught by reading computed
        // styles; it looks identical to a missing element in a screenshot.
        // box-sizing is border-box here, so this stays exactly 14px.
        className="absolute -top-0.5 -right-0.5 h-[14px] w-[14px] rounded-full border-[1.5px] border-sd-ink-faint ring-2 ring-sd-surface"
      />
    );
  }
  const done = state === "done";
  return (
    <span
      aria-hidden
      className={`absolute -top-0.5 -right-0.5 grid h-[14px] w-[14px] place-items-center rounded-full ring-2 ring-sd-surface oak-motion-pop ${
        done ? "bg-sd-success-mark" : "bg-sd-attention-mark"
      }`}
    >
      {done && (
        <svg viewBox="0 0 10 10" className="h-[8px] w-[8px]" fill="none" aria-hidden>
          <path
            d="M2 5.2 4 7.2 8 3"
            stroke="var(--sd-surface)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

/** The word next to the dot.
 *
 *  A 10px dot is a hint, not a label -- on its own it asks the seller to
 *  remember a colour code, and it is invisible to anyone who cannot separate
 *  amber from green. The text is the actual status; the dot is the glanceable
 *  shorthand for it. */
function StatusLabel({ state }: { state: StepState }) {
  if (state === "todo") return null;
  const done = state === "done";
  return (
    <span
      className={`mt-1.5 inline-block text-[11px] font-bold uppercase tracking-[0.06em] ${
        done ? "text-sd-success-ink" : "text-sd-attention-ink"
      }`}
    >
      {done ? "Done" : "Pending verification"}
    </span>
  );
}

/** Takes the setup status from the route rather than fetching it itself. The
 *  route has to know it anyway to decide between this and the dashboard, and a
 *  second useStoreSetupStatus() here started a fresh instance at loading:true
 *  -- repeating all four requests and showing the seller a second skeleton
 *  after the first had already resolved. */
export function SetupChecklist({ status }: { status: StoreSetupStatus }) {
  const navigate = useNavigate();
  const { storeId } = useActiveStoreId();
  // Raw stores.theme_id (via themeIdSet below), not useStoreTheme()'s value —
  // that hook defaults an unset theme_id to "motion" client-side (see
  // store-profile page's own comment on this), so it's never null and can't
  // tell us whether the seller has actually picked one yet.
  const {
    loading: statusLoading,
    payoutSet,
    payoutStatus,
    locationCount,
    productCount,
    themeIdSet,
    installedApp,
    setLocationCount,
  } = status;
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

  // Escape closes the order warning. A dialog that can only be dismissed by
  // its X is a trap for anyone on a keyboard or switch control.
  useEffect(() => {
    if (!orderWarningKey) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOrderWarningKey(null);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [orderWarningKey]);

  const steps = [
    {
      key: "payout",
      label: "Get paid",
      // No longer repeats "pending verification" -- StatusLabel below now says
      // that, and saying it twice in one row read as an error rather than a
      // state.
      description: payoutSet
        ? "Bank account saved. Nothing else needed from you."
        : "Add your bank account details so you can get paid.",
      icon: Wallet,
      done: payoutSet,
      // done vs state are NOT the same question here, and this is the only
      // step where they diverge. `done` gates the checklist order and
      // `complete`; keying it on verification would block every seller
      // forever, because nothing writes "verified". `state` is display only.
      state: payoutStepState(payoutSet, payoutStatus),
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
      state: plainStepState(!!locationCount),
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
            state: plainStepState(installedApp),
            go: () => navigate({ to: "/store/get-the-webapp", search: { checklist: true } }),
          },
        ]
      : []),
    {
      key: "products",
      label: "List products",
      description: productCount
        ? `${productCount} product${productCount === 1 ? "" : "s"} listed.`
        : "Add items or import your existing catalogue.",
      icon: Package,
      done: !!productCount,
      state: plainStepState(!!productCount),
      go: () => navigate({ to: "/store/products", search: { checklist: true } }),
    },
    {
      key: "theme",
      label: "Customise your store front",
      description: "Choose how your store looks.",
      icon: Palette,
      done: themeIdSet,
      state: plainStepState(themeIdSet),
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
    <div className="px-4 py-6 font-normal">
      <h1 className="text-lg font-semibold mb-1">Your online store is starting to take shape</h1>
      <p className="text-sm text-sd-ink-muted mb-6">We recommend this order for simplicity.</p>
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
                className="flex items-start gap-3 border border-sd-line rounded-2xl p-4"
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
                className="flex items-start gap-3 border border-sd-line rounded-2xl p-4 hover:bg-sd-elevated active:scale-[0.99] active:bg-sd-elevated oak-motion-control text-left"
              >
                <StepNumber n={i + 1} />
                <div className="p-2 rounded-full bg-sd-soft relative">
                  <step.icon size={18} />
                  <StatusMark state={step.state} />
                </div>
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-sd-ink-muted mt-0.5">{step.description}</p>
                  <StatusLabel state={step.state} />
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-sd-scrim px-4 pb-8 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-order-title"
            className="w-full max-w-sm rounded-2xl bg-sd-surface p-5 shadow-[var(--sd-shadow-float)] oak-motion-enter"
          >
            <div className="flex items-start justify-between gap-3">
              <p
                id="setup-order-title"
                className="text-base font-semibold tracking-[-0.02em] text-sd-ink"
              >
                {blockedByInstall ? "Finish this from the app" : "Follow the order?"}
              </p>
              <button
                type="button"
                onClick={() => setOrderWarningKey(null)}
                aria-label="Cancel"
                className="-m-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-sd-ink-muted hover:bg-sd-elevated"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-5 text-sd-ink-muted">
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
                className="rounded-xl bg-sd-ink py-2.5 text-sm font-semibold text-sd-bg"
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
                className="rounded-xl border border-sd-line py-2.5 text-sm font-medium text-sd-ink hover:bg-sd-elevated"
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
