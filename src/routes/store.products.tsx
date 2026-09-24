import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProductsPanel } from "@/components/store/products/ProductsPanel";
import { CollectionsPanel } from "@/components/store/products/CollectionsPanel";
import { DropsPanel } from "@/components/store/products/DropsPanel";

const TOP_TABS = ["Products", "Collections", "Drops"] as const;
type TopTab = (typeof TOP_TABS)[number];

export const Route = createFileRoute("/store/products")({
  validateSearch: (search: Record<string, unknown>): { checklist?: boolean; tab?: TopTab } => ({
    checklist: search.checklist === true || search.checklist === "true" ? true : undefined,
    tab: TOP_TABS.includes(search.tab as TopTab) ? (search.tab as TopTab) : undefined,
  }),
  component: StoreProducts,
});

function StoreProducts() {
  const { checklist, tab } = Route.useSearch();
  // Only read as the *initial* tab -- the New/Edit Drop and New Collection
  // forms land back here via ?tab=Drops/Collections so the seller doesn't
  // reappear on Products after finishing something in another tab. Once
  // mounted, tapping between tabs is purely local state, same as the status
  // sub-tabs inside ProductsPanel.
  const [topTab, setTopTab] = useState<TopTab>(tab ?? "Products");
  const activeIndex = TOP_TABS.indexOf(topTab);

  return (
    <div className="px-4 py-5 pb-24">
      <div className="relative grid grid-cols-3 border-b border-sd-line mb-5">
        <div
          className="absolute bottom-0 left-0 h-0.5 w-1/3 bg-sd-ink transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
        {TOP_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTopTab(tab)}
            className={`relative z-10 py-3 text-sm text-center transition-colors duration-200 ${
              topTab === tab ? "font-medium text-sd-ink" : "text-sd-ink-faint"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* key remounts the panel on switch -- each fetches its own store-scoped
          list on mount, so a plain cross-fade (no shared state to preserve
          between tabs) is simpler and cheaper than keeping all three mounted. */}
      <div key={topTab} className="animate-in fade-in duration-200">
        {topTab === "Products" && <ProductsPanel checklist={checklist} />}
        {topTab === "Collections" && <CollectionsPanel />}
        {topTab === "Drops" && <DropsPanel />}
      </div>
    </div>
  );
}
