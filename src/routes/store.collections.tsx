import { createFileRoute } from "@tanstack/react-router";
import { CollectionsPanel } from "@/components/store/products/CollectionsPanel";

// Collections moved into a tab on /store/products (see store.products.tsx).
// This route stays alive -- deep links and QuickActions' "Collections" tile
// still point here -- but it's now a thin wrapper around the same panel, so
// the two never drift.
export const Route = createFileRoute("/store/collections")({
  component: StoreCollections,
});

function StoreCollections() {
  return (
    <div className="px-4 py-5 pb-24">
      {/* CollectionsPanel itself has no heading -- when it's embedded as a
          tab on /store/products, the tab label already says "Collections".
          A direct visit here (QuickActions, an old bookmark) has no tab bar
          to say that, so this standalone route supplies its own. */}
      <h1 className="text-lg font-semibold text-sd-ink mb-4">Collections</h1>
      <CollectionsPanel />
    </div>
  );
}
