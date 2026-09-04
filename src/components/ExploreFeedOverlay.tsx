import { useState } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { ChevronLeft, Bookmark, Lock, Search, ShoppingBag, User, UserPlus } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { PostFeed, type ActivePost, type TaggedProduct } from "@/components/feed/PostFeed";
import { useSession } from "@/hooks/use-session";

type FeedTab = "following" | "for-you" | "listed-items" | "profile";

// One order, and it is the order you can see. Swiping left moves the content
// left, which brings in the tab to the RIGHT of the current one — the same
// convention as the profile and store-profile pagers, and the one every social
// feed uses. This used to be a second, reversed array whose comment claimed to
// match the profile pager but did the opposite of it, so every swipe here ran
// backwards: dragging left walked toward Following.
const TABS: { key: FeedTab; label: string }[] = [
  { key: "following", label: "Following" },
  { key: "for-you", label: "For you" },
  { key: "listed-items", label: "Listed items" },
  { key: "profile", label: "Profile" },
];

export function ExploreFeedOverlay({
  ownUsername,
  onClose,
}: {
  ownUsername?: string;
  onClose: () => void;
}) {
  const [active, setActive] = useState<FeedTab>("for-you");
  // Held HERE, not in the feed, because the feed unmounts the moment you swipe
  // to Listed items — the whole point is that the tab remembers the post you
  // just left.
  const [activePost, setActivePost] = useState<ActivePost | null>(null);
  const { user } = useSession();
  const index = TABS.findIndex((t) => t.key === active);

  function go(delta: number) {
    const next = index + delta;
    if (next >= 0 && next < TABS.length) setActive(TABS[next].key);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60) go(1);
    else if (info.offset.x > 60) go(-1);
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed inset-0 z-[70] bg-black text-white overflow-hidden"
    >
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1 -ml-1 text-white shrink-0"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-4 text-[13px] font-medium text-white/50 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`whitespace-nowrap pb-1 ${
                active === t.key ? "text-white font-semibold underline underline-offset-4" : ""
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button aria-label="Search" className="p-1 -mr-1 text-white shrink-0">
          <Search size={18} />
        </button>
      </div>

      {/* Drag lives on this OUTER, never-remounted node. It used to sit on
          the AnimatePresence-keyed child below, which gets torn down and
          rebuilt on every tab change — that remount was dropping the
          in-progress touch/pointer capture mid-gesture, which is why the
          swipe silently did nothing. The inner child now only crossfades.
          dragElastic must stay high (not ~0) — a near-zero value clamps the
          visible travel to a few px even on a full-width drag, so the swipe
          reads as unresponsive even though onDragEnd does fire. */}
      <motion.div
        drag="x"
        dragElastic={0.7}
        dragSnapToOrigin
        onDragEnd={handleDragEnd}
        className="w-full h-full pt-14"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full h-full"
          >
            {active === "listed-items" ? (
              <ListedItemsPage items={activePost?.tags ?? []} />
            ) : active === "profile" ? (
              <ProfileTeaserPage />
            ) : (
              <PostFeed
                mode="embedded"
                onActivePost={setActivePost}
                scope={
                  active === "following"
                    ? { type: "following", viewerId: user?.id ?? "" }
                    : { type: "for-you" }
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <BottomNav active="home" ownUsername={ownUsername} />
    </motion.div>
  );
}

/** The products linked to whatever post you were just looking at — the other
 *  half of the post viewer's link-products rail. Swiping here from For you is
 *  how a post becomes shoppable, so this list is only ever about ONE post: the
 *  one that was filling the screen when you swiped away from it. */
function ListedItemsPage({ items }: { items: TaggedProduct[] }) {
  if (items.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center px-10 text-center gap-1.5">
        <p className="text-[15px] font-semibold text-white/80">Nothing listed on this post</p>
        <p className="max-w-[240px] text-[12px] text-white/40">
          When a seller links products to a post, they show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto px-4 pb-28">
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 border border-white/10 rounded-xl p-2.5"
          >
            {item.image ? (
              <img
                src={item.image}
                alt=""
                className="w-14 h-14 rounded-lg object-cover bg-white/5 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <ShoppingBag size={20} className="text-white/30" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">
                {item.price != null ? `₦${item.price.toLocaleString()}` : "—"}
              </p>
              <p className="text-[11px] text-white/50 truncate">{item.title}</p>
            </div>
            <button
              type="button"
              aria-label="Save"
              className="p-2 rounded-full bg-white/5 text-white/60 shrink-0"
            >
              <Bookmark size={15} />
            </button>
            <button
              type="button"
              className="text-[11px] font-semibold bg-white text-black rounded-full px-3 py-2 shrink-0 whitespace-nowrap"
            >
              Buy Now
            </button>
            <button
              type="button"
              className="text-[11px] font-medium border border-white/20 text-white rounded-full px-3 py-2 shrink-0 whitespace-nowrap"
            >
              Make Offer
            </button>
            <button
              type="button"
              aria-label="Locked"
              className="p-2 rounded-full bg-white/5 text-white/30 shrink-0"
            >
              <Lock size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileTeaserPage() {
  return (
    <div className="w-full h-full flex flex-col items-center pt-10 px-8 text-center">
      <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <User size={36} className="text-white/30" />
      </div>
      <p className="mt-4 text-[16px] font-bold">@seller_handle</p>
      <p className="mt-1 text-[13px] text-white/50">142 posts · 3.2k followers</p>
      <button
        type="button"
        className="mt-5 flex items-center gap-1.5 bg-white text-black text-[13px] font-semibold rounded-full px-5 py-2.5"
      >
        <UserPlus size={14} />
        Follow
      </button>
    </div>
  );
}
