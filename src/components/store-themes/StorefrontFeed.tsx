import { useRef, useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import { PostFeed, type ActivePost } from "@/components/feed/PostFeed";
import { ListedItemsPage } from "@/components/ExploreFeedOverlay";

type Tab = "for-you" | "listed-items";

/** The storefront's Home tab: the store's own posts as a full-screen feed,
 *  with For you and Listed items at the top -- the same pair the old Explore
 *  screen had, scoped to this store. Listed items is whatever's linked to the
 *  post you were just watching. Swipe left/right moves between the two. */
export function StorefrontFeed({ ownerId }: { ownerId: string }) {
  const [tab, setTab] = useState<Tab>("for-you");
  // Held here, not in the feed: the feed unmounts on Listed items, and that
  // tab is about the post you just left.
  const [activePost, setActivePost] = useState<ActivePost | null>(null);

  // One swipe moves one tab: a carousel's past-the-end hand-off and this
  // drag can both see the same gesture (same guard as ExploreFeedOverlay).
  const lastSwitch = useRef(0);
  function go(next: Tab) {
    const now = Date.now();
    if (now - lastSwitch.current < 400) return;
    lastSwitch.current = now;
    setTab(next);
  }
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60 && tab === "for-you") go("listed-items");
    else if (info.offset.x > 60 && tab === "listed-items") go("for-you");
  }

  const items = activePost?.tags ?? [];

  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      <div
        className="absolute inset-x-0 top-0 z-20 flex justify-center gap-6 pb-2 text-[14px] font-medium text-white/55"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}
      >
        {(
          [
            ["for-you", "For you"],
            ["listed-items", "Listed items"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`whitespace-nowrap pb-1 drop-shadow ${
              tab === key ? "font-semibold text-white underline underline-offset-4" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Drag on this never-remounted node, not on the tab content: a
          remount mid-gesture drops the pointer capture (see
          ExploreFeedOverlay). Direction-locked so vertical feed scrolling
          isn't read as a tab swipe. */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragElastic={0.7}
        dragSnapToOrigin
        onDragEnd={handleDragEnd}
        className="h-full w-full"
      >
        {tab === "for-you" ? (
          <PostFeed
            mode="embedded"
            scope={{ type: "author", userId: ownerId }}
            onActivePost={setActivePost}
            onSwipePastEnd={() => go("listed-items")}
          />
        ) : items.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center px-10 text-center">
            <p className="text-[15px] font-semibold text-white/70">No linked products</p>
          </div>
        ) : (
          <div className="h-full w-full pt-14">
            <ListedItemsPage items={items} />
          </div>
        )}
      </motion.div>
    </div>
  );
}
