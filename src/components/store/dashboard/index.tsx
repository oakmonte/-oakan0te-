import { useState } from "react";
import { useActiveStore } from "@/hooks/use-own-store";
import { LocationsListSheet } from "@/components/store/LocationsListSheet";
import { ShareProfileOverlay } from "@/components/profile/ShareProfileOverlay";
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
 *  this entire screen to every seller who is still on the checklist.
 *
 *  Section order is fixed and the rhythm is a single gap-7 (28px) -- one spacing
 *  decision rather than a different margin per section, which is how a page ends
 *  up looking assembled rather than designed. */
export function StoreDashboard({ productCount }: { productCount: number | null }) {
  const { store } = useActiveStore();
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Empty for now, and rendering an explicit "all clear" rather than nothing.
  // The parameters that fill this are Diadem's to define; the shape is here so
  // adding one is a data change rather than a layout change.
  const attention: AttentionItem[] = [];

  const shareUrl =
    typeof window !== "undefined" && store
      ? `${window.location.origin}/store-profile/${store.store_username}`
      : "";

  return (
    <div className="flex flex-col gap-7 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5">
      <IdentityBlock />
      <WhatsNew />
      <NeedsAttention items={attention} />
      <TotalSales onShare={() => setShareOpen(true)} />
      <SalesAnalytics />
      <StatTiles productCount={productCount} />
      <QuickActions
        onOpenLocations={() => setLocationsOpen(true)}
        onShare={() => setShareOpen(true)}
      />

      {locationsOpen && store && (
        <LocationsListSheet storeId={store.id} onClose={() => setLocationsOpen(false)} />
      )}

      <ShareProfileOverlay
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        avatarUrl={null}
        shareUrl={shareUrl}
      />
    </div>
  );
}

// Default export so the route can React.lazy() this module directly.
export default StoreDashboard;
