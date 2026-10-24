import { useCallback, useEffect, useState } from "react";
import { useActiveStore, type OwnedStoreSummary } from "@/hooks/use-own-store";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";
import { toast } from "sonner";
import { fetchStoreLogo, type StoreLogo } from "@/lib/store-logo";
import { IdentityBlock } from "./IdentityBlock";
import { QuickActions } from "./QuickActions";
import { NextSteps, SalesAnalytics, StatTiles, WhatsNew } from "./sections";
import { DesktopPanel } from "@/components/store/DesktopPanel";

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

  // Opens the phone's share sheet with the storefront link, or copies it where
  // there is no share sheet.
  function share() {
    const url = `${window.location.origin}/shop/${store.store_username}`;
    if (navigator.share) {
      void navigator.share({ title: store.store_username, url }).catch(() => {});
    } else {
      void navigator.clipboard?.writeText(url).then(() => toast("Store link copied"));
    }
  }

  return (
    // font-normal: body copy is weight 300 app-wide, and 13-14px grey Inter at
    // 300 is the least legible text on a phone -- which on this page is exactly
    // the explanatory text. Section rhythm is gap-8 between groups; the sales
    // hero, its chart and the tiles are one subject and sit closer together.
    <DesktopPanel>
      <div className="flex flex-col gap-8 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal md:px-0 md:pt-0">
        <IdentityBlock store={store} logo={logo} onLogoChange={onLogoChange} onShare={share} />
        <WhatsNew />
        <NextSteps />
        <div className="flex flex-col gap-6">
          {/* Re-enable <TotalSales onShare={share} /> (and its import) once sellers can take orders. */}
          <SalesAnalytics />
          <StatTiles productCount={productCount} payoutVerified={payoutStatus === "verified"} />
        </div>
        <QuickActions onOpenLocations={() => setLocationsOpen(true)} />

        {locationsOpen && (
          <LocationsListSheet storeId={store.id} onClose={() => setLocationsOpen(false)} />
        )}
      </div>
    </DesktopPanel>
  );
}

// Default export so the route can React.lazy() this module directly.
export default StoreDashboard;
