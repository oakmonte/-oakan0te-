import { useState } from "react";
import { PostFeed, type ActivePost } from "@/components/feed/PostFeed";
import { ListedItemsPage } from "@/components/ExploreFeedOverlay";

type Tab = "for-you" | "listed-items";

/** The storefront's Home tab: the store's own posts as a full-screen feed,
 *  with For you and Listed items at the top -- the same pair the old Explore
 *  screen had, scoped to this store. Listed items is whatever's linked to the
 *  post you were just watching. */
export function StorefrontFeed({ ownerId }: { ownerId: string }) {
  const [tab, setTab] = useState<Tab>("for-you");
  // Held here, not in the feed: the feed unmounts on Listed items, and that
  // tab is about the post you just left.
  const [activePost, setActivePost] = useState<ActivePost | null>(null);

  return (
    <div className="relative h-full w-full bg-black text-white">
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
      {tab === "for-you" ? (
        <PostFeed
          mode="embedded"
          scope={{ type: "author", userId: ownerId }}
          onActivePost={setActivePost}
          onSwipePastEnd={() => setTab("listed-items")}
        />
      ) : (
        <div className="h-full w-full pt-14">
          <ListedItemsPage items={activePost?.tags ?? []} />
        </div>
      )}
    </div>
  );
}
