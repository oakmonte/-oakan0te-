import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { TabPager } from "@/components/profile/TabPager";
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
  // mounted, which tab is active is purely local state, driven by either a
  // tap on the strip or a swipe through TabPager.
  const [topTab, setTopTab] = useState<TopTab>(tab ?? "Products");
  const activeIndex = TOP_TABS.indexOf(topTab);

  // Shared with TabPager, same wiring as ProfileTabStrip/TabPager on
  // /profile/$username -- the indicator below reads the pager's own motion
  // value, so it tracks the finger through a swipe instead of only snapping
  // into place after release.
  const pagerX = useMotionValue(0);
  const [pageWidth, setPageWidth] = useState(0);
  const slotWidth = pageWidth / TOP_TABS.length;
  const indicatorX = useTransform(pagerX, (v) => (pageWidth ? (-v / pageWidth) * slotWidth : 0));

  return (
    <div className="pt-5 pb-24">
      <div className="relative flex border-b border-sd-line px-4">
        <motion.span
          aria-hidden
          className="absolute bottom-0 h-[2.5px] rounded-full bg-sd-ink"
          style={{ width: slotWidth ? slotWidth - 8 : 0, left: 4, x: indicatorX }}
        />
        {TOP_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopTab(t)}
            aria-current={topTab === t ? "page" : undefined}
            className={`oak-tap flex-1 py-3 text-center text-[15px] transition-colors duration-200 ${
              topTab === t ? "font-semibold text-sd-ink" : "font-medium text-sd-ink-faint"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <TabPager
        index={activeIndex}
        count={TOP_TABS.length}
        onIndexChange={(next) => setTopTab(TOP_TABS[next])}
        x={pagerX}
        onPageWidth={setPageWidth}
      >
        {[
          <div key="Products" className="px-4 pt-5">
            <ProductsPanel checklist={checklist} />
          </div>,
          <div key="Collections" className="px-4 pt-5">
            <CollectionsPanel />
          </div>,
          <div key="Drops" className="px-4 pt-5">
            <DropsPanel />
          </div>,
        ]}
      </TabPager>
    </div>
  );
}
