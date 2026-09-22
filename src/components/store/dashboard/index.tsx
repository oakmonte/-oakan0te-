import { useCallback, useEffect, useState } from "react";
import { useActiveStore, type OwnedStoreSummary } from "@/hooks/use-own-store";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";
import { ShareProfileOverlay } from "@/components/profile/ShareProfileOverlay";
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
  const [shareOpen, setShareOpen] = useState(false);

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

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/store-profile/${store.store_username}`
      : "";

  /** One way to share, used by every share button on the page.
   *
   *  The phone's own share sheet first, because that is where WhatsApp and a
   *  seller's real contacts are -- and for a Nigerian seller WhatsApp is where
   *  the first order comes from. The in-app overlay is only the fallback for
   *  browsers with no Web Share API (most desktops). It used to be the only
   *  option, and two different copies of it were mounted depending on which
   *  button you tapped, one of them without the store's picture. */
  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: store.brand_name, url: shareUrl });
        return;
      } catch (err) {
        // Dismissing the sheet is a choice, not a failure: do nothing.
        if ((err as DOMException)?.name === "AbortError") return;
        // Anything else (a permissions policy, an in-app browser that exposes
        // the API but refuses it) falls through to the overlay.
      }
    }
    setShareOpen(true);
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

      <ShareProfileOverlay
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        avatarUrl={logo?.url ?? null}
        shareUrl={shareUrl}
        title="Share your store"
      />
    </div>
  );
}

// Default export so the route can React.lazy() this module directly.
export default StoreDashboard;
