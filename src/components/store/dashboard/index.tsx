import { useCallback, useEffect, useState } from "react";
import { useActiveStore, type OwnedStoreSummary } from "@/hooks/use-own-store";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";
import { ComingSoonBanner } from "@/components/ComingSoonBanner";
import { fetchStoreLogo, type StoreLogo } from "@/lib/store-logo";
import { IdentityBlock } from "./IdentityBlock";
import { QuickActions } from "./QuickActions";
import { useStoreInsights } from "@/hooks/use-store-insights";
import type { Period, SalesResponse } from "@/lib/insights";
import { NextSteps, StatTiles, WhatsNew } from "./sections";
import { SalesAnalytics } from "./SalesAnalytics";

/** The seller dashboard: what /store shows once setup is finished.
 *
 *  Lazy-loaded from the route on purpose. Both this and the setup checklist live
 *  behind one route, and TanStack splits by route, so a plain import would ship
 *  this entire screen to every seller who is still on the checklist. */
export function StoreDashboard({
  productCount,
  payoutStatus,
}: {
  productCount: number | null;
  payoutStatus: string | null;
}) {
  const { store } = useActiveStore();
  if (!store) return null;
  // Keyed by store so switching stores starts from a clean slate. Without it the
  // previous store's logo stayed on screen until the new fetch returned, and an
  // upload still in flight for store A would have been saved onto store B.
  return (
    <DashboardForStore
      key={store.id}
      store={store}
      productCount={productCount}
      payoutStatus={payoutStatus}
    />
  );
}

function DashboardForStore({
  store,
  productCount,
  payoutStatus,
}: {
  store: OwnedStoreSummary;
  productCount: number | null;
  payoutStatus: string | null;
}) {
  const [logo, setLogo] = useState<StoreLogo | undefined>(undefined);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [shareComingSoonOpen, setShareComingSoonOpen] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  // One request feeds both the chart and the tiles below it; see SalesAnalytics.
  const sales = useStoreInsights<SalesResponse>(store.id, "sales", { period });

  useEffect(() => {
    let cancelled = false;
    void fetchStoreLogo(store.id).then((l) => {
      if (!cancelled) setLogo(l);
    });
    return () => {
      cancelled = true;
    };
  }, [store.id]);

  const onLogoChange = useCallback((url: string | null) => {
    setLogo((prev) => ({ canSaveOwnLogo: prev?.canSaveOwnLogo ?? true, url }));
  }, []);

  // Sharing a store link is held back until official launch -- both share
  // buttons on this page point here rather than actually invoking the share
  // sheet, until that's turned back on.
  function share() {
    setShareComingSoonOpen(true);
  }

  return (
    // font-normal: body copy is weight 300 app-wide, and 13-14px grey Inter at
    // 300 is the least legible text on a phone -- which on this page is exactly
    // the explanatory text. Section rhythm is gap-8 between groups; the sales
    // hero, its chart and the tiles are one subject and sit closer together.
    <div className="flex flex-col gap-8 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      <IdentityBlock store={store} logo={logo} onLogoChange={onLogoChange} onShare={share} />
      <WhatsNew />
      <NextSteps />
      <div className="flex flex-col gap-6">
        {/* Re-enable <TotalSales onShare={share} /> (and its import) once sellers can take orders. */}
        <SalesAnalytics period={period} onPeriodChange={setPeriod} query={sales} />
        <StatTiles
          productCount={productCount}
          payoutVerified={payoutStatus === "verified"}
          allTime={sales.data?.allTime ?? null}
        />
      </div>
      <QuickActions onOpenLocations={() => setLocationsOpen(true)} />

      {locationsOpen && (
        <LocationsListSheet storeId={store.id} onClose={() => setLocationsOpen(false)} />
      )}

      <ComingSoonBanner
        open={shareComingSoonOpen}
        onClose={() => setShareComingSoonOpen(false)}
        message={`Sharing your store link will be available after official launch. You'll get a free storefront link — ${store.store_username}.oakmonte.store.`}
      />
    </div>
  );
}

// Default export so the route can React.lazy() this module directly.
export default StoreDashboard;
