import type { ReactElement } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { TABS, type TabKey } from "@/components/profile/profile-tabs";

/** The profile tab strip, shared by /profile/$username and
 *  /store-profile/$storeUsername so the two can't drift apart.
 *
 *  Five tabs on screen, the rest off to the right. Briefly every tab was on
 *  screen at once, which fixed a real problem badly: the old five-wide strip
 *  scrolled itself with scrollIntoView, and that yanked the whole document
 *  back to the top on every tab change.
 *
 *  The fix was never "show everything" -- it was to stop scrolling the strip
 *  as a scroll container at all. The track is translated by the pager's own
 *  motion value, keeping the active tab centred, so the later tabs slide into
 *  view under the finger and nothing anchors the page. The clamp is what makes
 *  the ends behave: tab 0 cannot be centred without dead space beside it, so
 *  at both extremes the track pins to the edge and only the middle actually
 *  centres.
 *
 *  The indicator and the icon brightness are both driven by the pager's own
 *  motion value, so they track the finger through the gesture instead of
 *  snapping after release — that lag was the biggest remaining tell that this
 *  wasn't a real pager. */
/** How many fit on screen. The rest are reachable by swiping or tapping. */
const VISIBLE_TABS = 5;

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
  const slotWidth = pageWidth ? pageWidth / VISIBLE_TABS : 0;
  const trackWidth = slotWidth * tabs.length;

  // Widths are percentages so the strip lays out correctly on the very first
  // paint, before the pager has measured itself. Only the transforms below
  // need a real pageWidth, and they sit at 0 until one arrives.
  const trackPercent = (tabs.length / VISIBLE_TABS) * 100;

  const trackX = useTransform(pagerX, (v) => {
    if (!pageWidth) return 0;
    const page = -v / pageWidth;
    // Put the middle of the active slot in the middle of the screen...
    const centred = pageWidth / 2 - slotWidth * (page + 0.5);
    // ...unless that would drag empty space in from either end.
    return Math.min(0, Math.max(pageWidth - trackWidth, centred));
  });

  const indicatorX = useTransform(pagerX, (v) => (pageWidth ? (-v / pageWidth) * slotWidth : 0));

  return (
    <div className="relative overflow-hidden">
      <motion.div className="relative flex" style={{ width: `${trackPercent}%`, x: trackX }}>
        {tabs.map(({ key, label, Icon, size }, i) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            aria-label={label}
            aria-current={activeTab === key ? "page" : undefined}
            className="flex flex-none items-center justify-center pt-3 pb-3.5 transition-transform duration-150 active:scale-90"
            style={{ width: `${100 / tabs.length}%` }}
          >
            <TabIcon pagerX={pagerX} pageWidth={pageWidth} index={i} Icon={Icon} size={size} />
          </button>
        ))}
        {slotWidth > 0 && (
          <motion.span
            aria-hidden
            className="absolute bottom-0 h-[2px] rounded-full bg-white"
            // Inside the track, so it rides along with it and only has to
            // account for its own slot.
            style={{ width: slotWidth - 22, left: 11, x: indicatorX }}
          />
        )}
      </motion.div>
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
