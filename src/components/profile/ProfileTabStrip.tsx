import type { ReactElement } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { TABS, type TabKey } from "@/components/profile/profile-tabs";

/** The profile tab strip, shared by /profile/$username and
 *  /store-profile/$storeUsername so the two can't drift apart.
 *
 *  Every tab is on screen at once, whichever set the caller passes. The old
 *  strip showed five
 *  (`auto-cols-[20%]`, horizontally scrollable) which paired badly with swipe
 *  paging: from Posts you couldn't see Liked videos or Drafts at all and the
 *  swipe gave no hint they existed, and the scroll-into-view that compensated
 *  yanked the whole document back to the top on every tab change.
 *
 *  The indicator and the icon brightness are both driven by the pager's own
 *  motion value, so they track the finger through the gesture instead of
 *  snapping after release — that lag was the biggest remaining tell that this
 *  wasn't a real pager. */
export function ProfileTabStrip({
  activeTab,
  onSelect,
  pagerX,
  pageWidth,
  tabs = TABS,
}: {
  activeTab: TabKey;
  onSelect: (key: TabKey) => void;
  pagerX: MotionValue<number>;
  pageWidth: number;
  /** Which tabs to show. Defaults to the full personal-profile set; the store
   *  profile passes STORE_TABS, which drops Wardrobe. Must be the same list
   *  the caller's TabPager is paging over or the indicator won't line up. */
  tabs?: typeof TABS;
}) {
  const slotWidth = pageWidth ? (pageWidth - 16) / tabs.length : 0;
  const indicatorX = useTransform(pagerX, (v) => (pageWidth ? (-v / pageWidth) * slotWidth : 0));

  return (
    <div
      className="relative grid grid-flow-col px-2"
      // Every tab on screen at once, however many there are — the strip must
      // never scroll (see above), so the column width is a function of the
      // count rather than a hardcoded 1/7.
      style={{ gridAutoColumns: `${100 / tabs.length}%` }}
    >
      {tabs.map(({ key, label, Icon, size }, i) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          aria-label={label}
          aria-current={activeTab === key ? "page" : undefined}
          className="flex items-center justify-center pt-3 pb-3.5 transition-transform duration-150 active:scale-90"
        >
          <TabIcon pagerX={pagerX} pageWidth={pageWidth} index={i} Icon={Icon} size={size} />
        </button>
      ))}
      {slotWidth > 0 && (
        <motion.span
          aria-hidden
          className="absolute bottom-0 h-[2px] rounded-full bg-white"
          style={{ width: slotWidth - 22, left: 19, x: indicatorX }}
        />
      )}
    </div>
  );
}

/** One icon, brightening as the pager slides under it. Its own component so
 *  the motion hook isn't called inside a .map(). */
function TabIcon({
  pagerX,
  pageWidth,
  index,
  Icon,
  size,
}: {
  pagerX: MotionValue<number>;
  pageWidth: number;
  index: number;
  Icon: (p: { className?: string }) => ReactElement;
  size?: string;
}) {
  const opacity = useTransform(pagerX, (v) => {
    const page = pageWidth ? -v / pageWidth : 0;
    return 0.4 + 0.6 * (1 - Math.min(1, Math.abs(page - index)));
  });
  return (
    <motion.span style={{ opacity }} className="block text-white">
      <Icon className={size ?? "w-[21px] h-[21px]"} />
    </motion.span>
  );
}
