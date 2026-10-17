import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import { PostFeed, type ActivePost } from "@/components/feed/PostFeed";
import { ListedItemsPage } from "@/components/ExploreFeedOverlay";
import { ProductPage } from "./ProductPage";
import { SalesLockedNotice } from "./SalesLockedNotice";
import type { StorefrontLook } from "./storefront-look";

type Tab = "for-you" | "listed-items";

// The Listed items pane is black like the feed, so an embedded product page
// takes the same dark look rather than the storefront theme's.
const FEED_LOOK: StorefrontLook = {
  background: "#000",
  backgroundImage: "none",
  fontFamily: "inherit",
  textColor: "#fff",
  mutedColor: "rgba(255,255,255,0.6)",
  tileBg: "rgba(255,255,255,0.06)",
  accent: "#fff",
};
const TABS: Tab[] = ["for-you", "listed-items"];

// Same settle as the app's other pagers: quick, no bounce.
const SETTLE = { type: "spring", stiffness: 420, damping: 40 } as const;

// Laptop and tablet widths, the same 768px the rest of the desktop storefront
// switches at (StorefrontNav's top bar, ProductPage).
const WIDE_QUERY = "(min-width: 768px)";

function useIsWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return wide;
}

/** The storefront's Home tab: the store's own posts as a full-screen feed,
 *  with For you and Listed items at the top. Listed items is whatever's
 *  linked to the post you were just watching.
 *
 *  On a phone, a two-page pager: both pages sit side by side and the track
 *  follows the finger left/right, then settles on one. Up/down is the feed's
 *  own native scroll -- the track only claims horizontal drags
 *  (direction-locked), so a vertical swipe never nudges it sideways and a
 *  sideways one never scrolls.
 *
 *  On a laptop (md and up) there is nothing to swipe between: the video sits
 *  in a centred, phone-shaped player and the Listed items for the post you are
 *  watching stay open in a panel beside it, so the tab labels and the drag go
 *  away. Scrolling the player (wheel, trackpad, arrow keys) moves between
 *  posts. */
export function StorefrontFeed({
  ownerId,
  storePicture,
}: {
  ownerId: string;
  storePicture: string | null;
}) {
  const [tab, setTab] = useState<Tab>("for-you");
  // Held here so Listed items knows which post you were just on.
  const [activePost, setActivePost] = useState<ActivePost | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const index = TABS.indexOf(tab);
  const wide = useIsWide();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Settle on the current page whenever it (or the width) changes. The phone
  // pager only: a wide layout shows both panes and never moves the track.
  useEffect(() => {
    if (!width || wide) return;
    const controls = animate(x, -index * width, SETTLE);
    return () => controls.stop();
  }, [index, width, x, wide]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    // A flick counts as much as a long drag.
    const swipe = info.offset.x + info.velocity.x * 0.2;
    const next = swipe < -width * 0.25 ? index + 1 : swipe > width * 0.25 ? index - 1 : index;
    const clamped = Math.max(0, Math.min(TABS.length - 1, next));
    if (clamped === index) void animate(x, -index * width, SETTLE);
    else setTab(TABS[clamped]);
  }

  const items = activePost?.tags ?? [];
  const [salesLocked, setSalesLocked] = useState(false);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black text-white">
      <motion.div
        drag={wide ? false : "x"}
        dragDirectionLock
        dragConstraints={{ left: -(TABS.length - 1) * width, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        className={wide ? "flex h-full justify-center gap-10 px-8" : "flex h-full"}
        style={wide ? undefined : { x, width: `${TABS.length * 100}%`, touchAction: "pan-y" }}
      >
        {/* [&_.overflow-y-auto]:touch-pan-y on both panes: each holds a vertical
            scroller (the feed, the Listed items list, an embedded product
            page), and a touch's allowed gestures only inherit up to the nearest
            scroller -- so the track's own pan-y never reached the video, and the
            browser claimed a sideways drag as a pan and cancelled the pager's
            drag (drag="x" runs on pointer events, which stop at that point).
            pan-y on the scrollers themselves leaves horizontal drags to the
            pager; vertical scrolling is untouched, and a nested horizontal
            scroller (a post's photo carousel) is its own scroller, so it keeps
            its swipe. */}
        <div
          className="h-full [&_.overflow-y-auto]:touch-pan-y"
          // Wide: a phone-shaped player, 9:16 of the height it has (a 64px bar
          // above), never wider than 480px.
          style={
            wide
              ? { width: "min(calc((100dvh - 4rem) * 9 / 16), 480px)" }
              : { width: `${100 / TABS.length}%` }
          }
        >
          <PostFeed
            mode="embedded"
            scope={{ type: "author", userId: ownerId }}
            onActivePost={setActivePost}
            onSwipePastEnd={() => setTab("listed-items")}
            storePicture={storePicture}
          />
        </div>
        <div
          className={`h-full [&_.overflow-y-auto]:touch-pan-y ${
            wide ? "flex flex-col border-l border-white/10 pl-8" : ""
          }`}
          style={wide ? { width: "min(420px, 34vw)" } : { width: `${100 / TABS.length}%` }}
        >
          {wide && (
            <p className="shrink-0 pb-3 pt-6 text-[15px] font-semibold text-white/90">
              Listed items
            </p>
          )}
          <div className={wide ? "min-h-0 flex-1" : "h-full w-full"}>
            {items.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center px-10 text-center">
                <p className="text-[15px] font-semibold text-white/70">No linked products</p>
              </div>
            ) : items.length === 1 ? (
              // One linked piece: its product page, right here. The list is
              // for posts that link several.
              <div className={`h-full w-full ${wide ? "" : "pt-14"}`}>
                <ProductPage
                  key={items[0].id}
                  embedded
                  // Wide: the panel is always on screen, so "on screen" can't be
                  // what triggers the sales-locked notice -- it would pop up
                  // over every video that links one piece. Buy and Make Offer
                  // still show it when pressed.
                  visible={!wide && tab === "listed-items"}
                  tile={{
                    id: items[0].id,
                    title: items[0].title,
                    photos: items[0].image ? [{ url: items[0].image, variant: 0 }] : [],
                    variantCount: 1,
                    price: items[0].price,
                    compareAtPrice: null,
                  }}
                  look={FEED_LOOK}
                  onClose={() => setTab("for-you")}
                  onAction={() => setSalesLocked(true)}
                />
              </div>
            ) : (
              <div className={`h-full w-full ${wide ? "" : "pt-14"}`}>
                <ListedItemsPage items={items} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
      {!wide && (
        <div
          // The fade keeps the white labels readable over a pale video.
          className="absolute inset-x-0 top-0 z-30 flex justify-center gap-6 bg-gradient-to-b from-black/45 to-transparent pb-6 text-[14px] font-medium text-white/70"
          // After the track in the DOM and on its own compositing layer: iOS
          // Safari paints a playing <video> inside a transformed layer over
          // earlier siblings regardless of z-index, which hid these labels on
          // iPhones while they showed fine everywhere else.
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 14px)",
            transform: "translateZ(0)",
            WebkitTransform: "translateZ(0)",
          }}
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
              className={`whitespace-nowrap pb-1 drop-shadow transition-colors duration-200 ${
                tab === key ? "font-semibold text-white underline underline-offset-4" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {salesLocked && <SalesLockedNotice onClose={() => setSalesLocked(false)} />}
    </div>
  );
}
