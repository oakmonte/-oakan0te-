import { useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useLockedBanner } from "@/components/LockedBanner";
import { GLASS_RIM, glassClear } from "@/lib/liquid-glass";
import { ChevronLeft, Bookmark, Search, ShoppingBag } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { PostFeed, type ActivePost, type TaggedProduct } from "@/components/feed/PostFeed";
import { useDarkOverlay } from "@/lib/dark-overlay";
import { ProfileView } from "@/routes/profile.$username";
import { useSession } from "@/hooks/use-session";

// "listed-left" is the same Listed items page, parked to the LEFT of Following so
// both feeds have it one swipe away (Following swipes right into it, For you
// swipes left into the other one). It has no header label of its own.
type FeedTab = "listed-left" | "following" | "for-you" | "listed-items" | "profile";

// One order, and it is the order you can see. Swiping left moves the content
// left, which brings in the tab to the RIGHT of the current one — the same
// convention as the profile and store-profile pagers, and the one every social
// feed uses. This used to be a second, reversed array whose comment claimed to
// match the profile pager but did the opposite of it, so every swipe here ran
// backwards: dragging left walked toward Following.
const TABS: { key: FeedTab; label: string }[] = [
  { key: "listed-left", label: "Listed items" },
  { key: "following", label: "Following" },
  { key: "for-you", label: "For you" },
  { key: "listed-items", label: "Listed items" },
  { key: "profile", label: "Profile" },
];

export function ExploreFeedOverlay({
  ownUsername,
  onClose,
  initialPostId,
}: {
  ownUsername?: string;
  onClose: () => void;
  /** Scroll the For you feed to this post on open (a tapped grid tile). */
  initialPostId?: string;
}) {
  const [active, setActive] = useState<FeedTab>("for-you");
  // Held HERE, not in the feed, because the feed unmounts the moment you swipe
  // to Listed items — the whole point is that the tab remembers the post you
  // just left.
  const [activePost, setActivePost] = useState<ActivePost | null>(null);
  const { user } = useSession();
  const index = TABS.findIndex((t) => t.key === active);
  // /home is light when the phone is; this feed is always black, so the
  // status strip goes black with it while it's up.
  useDarkOverlay(true);

  // One swipe moves one tab: a carousel's past-the-end hand-off and the
  // track's own drag can both see the same gesture.
  const lastGoAt = useRef(0);
  function go(delta: number) {
    const now = Date.now();
    if (now - lastGoAt.current < 400) return;
    lastGoAt.current = now;
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
          {TABS.filter((t) => t.key !== "listed-left").map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`whitespace-nowrap pb-1 ${
                active === t.key || (t.key === "listed-items" && active === "listed-left")
                  ? "text-white font-semibold underline underline-offset-4"
                  : ""
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
            {active === "listed-items" || active === "listed-left" ? (
              <ListedItemsPage items={activePost?.tags ?? []} />
            ) : active === "profile" ? (
              activePost?.authorUsername ? (
                <div data-embedded-profile className="h-full w-full overflow-y-auto">
                  <ProfileView username={activePost.authorUsername} embedded />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center px-10 text-center text-[14px] text-white/50">
                  Swipe through a post first, and its creator shows up here.
                </div>
              )
            ) : (
              <PostFeed
                mode="embedded"
                initialPostId={active === "for-you" ? initialPostId : undefined}
                onActivePost={setActivePost}
                onSwipePastEnd={() => go(1)}
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
  const navigate = useNavigate();
  const { user } = useSession();
  const reduceMotion = useReducedMotion();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const { banner, showLocked } = useLockedBanner();

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
    <div className="w-full h-full overflow-y-auto pb-28">
      {/* One row per linked piece: photo left, the buying controls right, a
          hairline between rows -- a shelf you can act on without opening each
          product. Rows cascade in (40ms apart) so a long list reads as one
          motion instead of popping in as a block; reduced motion just fades. */}
      <ul className="divide-y divide-white/10 border-y border-white/10">
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px)" }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" }}
            transition={{
              duration: 0.32,
              ease: [0.23, 1, 0.32, 1],
              delay: Math.min(i, 8) * 0.04,
            }}
            className="flex gap-3 px-3 py-3"
          >
            <div className="relative h-[124px] w-[124px] shrink-0 overflow-hidden rounded-[10px] bg-white">
              {item.image ? (
                <img
                  src={item.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5">
                  <ShoppingBag size={24} className="text-black/25" />
                </div>
              )}
              <button
                type="button"
                aria-label={saved[item.id] ? "Remove from wishlist" : "Save to wishlist"}
                aria-pressed={!!saved[item.id]}
                onClick={() => setSaved((s) => ({ ...s, [item.id]: !s[item.id] }))}
                className={`absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform duration-150 ease-out active:scale-90 ${GLASS_RIM}`}
                style={glassClear}
              >
                <motion.span
                  key={saved[item.id] ? "on" : "off"}
                  initial={{ scale: saved[item.id] && !reduceMotion ? 0.6 : 1 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.35, bounce: 0.4 }}
                  className="block"
                >
                  <Bookmark
                    size={15}
                    strokeWidth={2.25}
                    fill={saved[item.id] ? "#f5c518" : "none"}
                    className={saved[item.id] ? "text-[#f5c518]" : "text-white"}
                  />
                </motion.span>
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between py-1">
              <div className="min-w-0">
                <p className="text-[15px] font-bold tracking-[-0.01em] text-white">
                  {item.price != null ? `₦${item.price.toLocaleString()}` : "Price on request"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/60">
                  {item.title}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    void navigate({
                      to: "/checkout/$productId",
                      params: { productId: item.id },
                    })
                  }
                  className="h-9 rounded-full bg-white px-3.5 text-[12px] font-semibold text-black transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  Buy Now
                </button>
                <button
                  type="button"
                  // Offers are a signed-in conversation with the seller; the
                  // offer flow itself isn't built yet, so this goes to sign-in
                  // for guests and says so honestly for everyone else.
                  onClick={() =>
                    user
                      ? showLocked("Offers open soon. Message the seller meanwhile.")
                      : void navigate({ to: "/sign-in" })
                  }
                  className="h-9 rounded-full bg-white/12 px-3.5 text-[12px] font-semibold text-white ring-1 ring-white/15 transition-transform duration-150 ease-out active:scale-[0.96]"
                >
                  Make Offer
                </button>
                <button
                  type="button"
                  aria-label="Add to bag"
                  onClick={() => showLocked("The bag opens with the cart update")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform duration-150 ease-out active:scale-[0.92]"
                >
                  <ShoppingBag size={15} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
      {banner}
    </div>
  );
}
