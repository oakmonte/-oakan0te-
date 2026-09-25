import { useCallback, useEffect, useState } from "react";
import { useActiveStore, type OwnedStoreSummary } from "@/hooks/use-own-store";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";
import { ComingSoonBanner } from "@/components/ComingSoonBanner";
import { fetchStoreLogo, type StoreLogo } from "@/lib/store-logo";
import { IdentityBlock } from "./IdentityBlock";
import { QuickActions } from "./QuickActions";
import {
  NeedsAttention,
  SalesAnalytics,
  StatTiles,
  TotalSales,
  WhatsNew,
  type AttentionItem,
} from "./sections";

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

  // Empty until Diadem defines what feeds this section. The shape is here so
  // adding a signal is a data change rather than a layout change.
  const attention: AttentionItem[] = [];

  return (
    // font-normal: body copy is weight 300 app-wide, and 13-14px grey Inter at
    // 300 is the least legible text on a phone -- which on this page is exactly
    // the explanatory text. Section rhythm is gap-8 between groups; the sales
    // hero, its chart and the tiles are one subject and sit closer together.
    <div className="flex flex-col gap-8 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      <IdentityBlock store={store} logo={logo} onLogoChange={onLogoChange} onShare={share} />
      <WhatsNew />
      <NeedsAttention items={attention} />
      <div className="flex flex-col gap-6">
        <TotalSales onShare={share} />
        <SalesAnalytics />
        <StatTiles productCount={productCount} payoutVerified={payoutStatus === "verified"} />
      </div>
      <QuickActions onOpenLocations={() => setLocationsOpen(true)} />

      {locationsOpen && (
        <LocationsListSheet storeId={store.id} onClose={() => setLocationsOpen(false)} />
      )}

      <ComingSoonBanner
        open={shareComingSoonOpen}
        onClose={() => setShareComingSoonOpen(false)}
        message="Sharing your store link will be available after official launch."
      />
    </div>
  );
}

// Default export so the route can React.lazy() this module directly.
export default StoreDashboard;
