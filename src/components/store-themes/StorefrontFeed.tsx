import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import { PostFeed, RAIL_OUTSIDE_W, type ActivePost } from "@/components/feed/PostFeed";
import { ListedItemsPage } from "@/components/ExploreFeedOverlay";
import { ProductPage } from "./ProductPage";
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

// The side-by-side layout: from this container width, a products panel this
// wide beside the post, with a slim column of arrows between them.
const SIDE_BY_SIDE_MIN = 900;
// At or under this width the feed fills the whole box instead of taking the post's shape.
const PHONE_MAX_W = 640;
const PANEL_W = 460;
const ARROWS_W = 96;
const GAP = 16;
// The side-by-side cards run to the bottom of the screen, behind the floating nav.
const PAD_TOP = 14;
const PAD_BOTTOM = 0;
const PANEL_TITLE_H = 40;
const FRAME_ASPECT = 9 / 16;

// Same settle as the app's other pagers: quick, no bounce.
const SETTLE = { type: "spring", stiffness: 420, damping: 40 } as const;

/** The storefront's Home tab: the store's own posts as a feed, with For you
 *  and Listed items at the top. Listed items is whatever's linked to the post
 *  you were just watching.
 *
 *  One page at a time at every width: a two-page pager whose track follows
 *  the finger (or a trackpad's two-finger swipe) left/right, then settles on
 *  one. Up/down is the feed's own native scroll -- the track only claims
 *  horizontal drags (direction-locked), so a vertical swipe never nudges it
 *  sideways and a sideways one never scrolls.
 *
 *  The pager lives in a column shaped like the post on screen (full height).
 *  On a phone that's the whole screen; on a laptop it's a phone-shaped column
 *  in the middle, on a blurred wash of the post you're watching rather than a
 *  page of black.
 *
 *  On a wide screen (a laptop) it's TikTok's layout instead: the post on the
 *  left, its linked products beside it, and up/down arrows between. The panel
 *  follows the post on screen, so scrolling the feed changes the products. */
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
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  const x = useMotionValue(0);
  const index = TABS.indexOf(tab);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setScreen({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The frame is always the same phone shape (9:16), full height; a post of any
  // other shape sits whole inside it, on its own blurred backdrop, rather than
  // the frame stretching to fit the post.
  const aspect = FRAME_ASPECT;
  // Wide enough for the post and its products side by side.
  const wide = screen.w >= SIDE_BY_SIDE_MIN;
  const sideW = wide ? PANEL_W + ARROWS_W + GAP * 2 : 0;
  const room = screen.w - sideW;
  const availH = wide ? screen.h - PAD_TOP - PAD_BOTTOM : screen.h;
  // Wide: the post plus the strip of buttons beside it.
  const railW = wide ? RAIL_OUTSIDE_W : 0;
  // The post's card sits under its title, level with the products card.
  const cardH = wide ? availH - PANEL_TITLE_H : availH;
  // A phone-sized box (a phone, or the editor's phone frame) is filled edge to
  // edge: the post sits whole inside it, on its own blurred backdrop. A wider
  // one is shaped to the post.
  const phoneSized = !wide && screen.w <= PHONE_MAX_W;
  const width = phoneSized
    ? screen.w
    : screen.h
      ? Math.min(room - railW, Math.round(cardH * aspect)) + railW
      : room;
  const framed = width > 0 && width < screen.w;
  const feedRef = useRef<HTMLDivElement>(null);
  // The arrows between the two: one post up or down, as the feed's own swipe.
  function pageFeed(dir: 1 | -1) {
    const scroller = Array.from(feedRef.current?.querySelectorAll<HTMLElement>("div") ?? []).find(
      (el) => el.style.scrollSnapType === "y mandatory",
    );
    if (!scroller) return;
    // Endless both ways: up from the first post jumps (invisibly) to its copy
    // further down, so the arrow carries on to the last post.
    if (dir === -1 && scroller.scrollTop < 2) scroller.scrollTop = scroller.scrollHeight / 2;
    scroller.scrollBy({ top: dir * scroller.clientHeight, behavior: "smooth" });
  }

  // Settle on the current page whenever it (or the width) changes.
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

  // A two-finger sideways swipe on a trackpad arrives as wheel events, not a
  // pointer drag, so the pager never saw it. Sum the sideways scroll and turn
  // the page once it's clearly a swipe; then ignore the rest of that gesture's
  // momentum.
  const wheelRef = useRef({ sum: 0, lockedUntil: 0 });
  function handleWheel(e: React.WheelEvent) {
    if (wide || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    const w = wheelRef.current;
    const now = performance.now();
    if (now < w.lockedUntil) return;
    w.sum += e.deltaX;
    if (Math.abs(w.sum) < 60) return;
    const next = Math.max(0, Math.min(TABS.length - 1, index + (w.sum > 0 ? 1 : -1)));
    w.sum = 0;
    w.lockedUntil = now + 700;
    if (next !== index) setTab(TABS[next]);
  }

  const items = activePost?.tags ?? [];
  // A row tapped in Listed items: its full product page, over the feed.
  const [opened, setOpened] = useState<(typeof items)[number] | null>(null);

  const listedPane =
    items.length === 0 ? (
      <div className="flex h-full w-full items-center justify-center px-10 text-center">
        <p className="text-[15px] font-semibold text-white/70">No linked products</p>
      </div>
    ) : items.length === 1 ? (
      // One linked piece: its product page, right here. The list is for posts
      // that link several.
      <div className={`h-full w-full ${wide ? "" : "pt-14"}`}>
        <ProductPage
          key={items[0].id}
          embedded
          visible={wide || tab === "listed-items"}
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
        />
      </div>
    ) : (
      <div className={`h-full w-full ${wide ? "" : "pt-14"}`}>
        <ListedItemsPage items={items} onOpen={setOpened} />
      </div>
    );

  const openedPage = opened && (
    <ProductPage
      key={opened.id}
      tile={{
        id: opened.id,
        title: opened.title,
        photos: opened.image ? [{ url: opened.image, variant: 0 }] : [],
        variantCount: 1,
        price: opened.price,
        compareAtPrice: null,
      }}
      look={FEED_LOOK}
      onClose={() => setOpened(null)}
    />
  );

  if (wide) {
    return (
      <div
        ref={containerRef}
        className="relative flex h-full w-full items-start justify-center overflow-hidden bg-[#1c1c1e] text-white"
        style={{ gap: GAP, paddingTop: PAD_TOP }}
      >
        <div
          className="relative flex shrink-0 flex-col"
          style={{
            width: width || undefined,
            height: availH,
            transition: "width 350ms cubic-bezier(0.2, 0, 0, 1)",
          }}
        >
          <p
            className="flex items-center px-2 text-[20px] font-bold tracking-tight"
            style={{ height: PANEL_TITLE_H }}
          >
            For you
          </p>
          <div ref={feedRef} className="relative min-h-0 flex-1">
            <PostFeed
              mode="embedded"
              scope={{ type: "author", userId: ownerId }}
              loop
              onActivePost={setActivePost}
              storePicture={storePicture}
              railOutside
            />
          </div>
        </div>
        <div
          className="relative z-10 flex shrink-0 flex-col items-center justify-center gap-3"
          style={{ width: ARROWS_W, height: availH }}
        >
          {(
            [
              [-1, ChevronUp, "Previous post"],
              [1, ChevronDown, "Next post"],
            ] as const
          ).map(([dir, Icon, label]) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              onClick={() => pageFeed(dir)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 active:scale-95"
            >
              <Icon size={22} />
            </button>
          ))}
        </div>
        <div
          className="relative z-10 flex shrink-0 flex-col"
          style={{ width: PANEL_W, height: availH }}
        >
          <p
            className="flex items-center px-2 text-[20px] font-bold tracking-tight"
            style={{ height: PANEL_TITLE_H }}
          >
            Listed items
          </p>
          <div className="min-h-0 flex-1 overflow-hidden rounded-[32px] bg-black/70 shadow-[0_24px_80px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-xl [&_.overflow-y-auto]:overscroll-contain">
            {listedPane}
          </div>
        </div>
        {openedPage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative h-full w-full overflow-hidden bg-[#1c1c1e] text-white"
    >
      {/* The post on screen, blurred and dimmed, filling the screen around
          the column. Keyed so a new post fades in. */}
      <div
        className={`relative mx-auto h-full overflow-hidden bg-black ${
          framed ? "shadow-[0_0_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10" : ""
        }`}
        // Eases from one post's shape to the next as the feed scrolls.
        style={{ width: width || "100%", transition: "width 350ms cubic-bezier(0.2, 0, 0, 1)" }}
      >
        <motion.div
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: -(TABS.length - 1) * width, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          className="flex h-full"
          style={{ x, width: `${TABS.length * 100}%`, touchAction: "pan-y" }}
        >
          {/* [&_.overflow-y-auto]:touch-pan-y on both panes: each holds a
              vertical scroller (the feed, the Listed items list, an embedded
              product page), and a touch's allowed gestures only inherit up to
              the nearest scroller -- so the track's own pan-y never reached the
              video, and the browser claimed a sideways drag as a pan and
              cancelled the pager's drag (drag="x" runs on pointer events,
              which stop at that point). pan-y on the scrollers themselves
              leaves horizontal drags to the pager; vertical scrolling is
              untouched, and a nested horizontal scroller (a post's photo
              carousel) is its own scroller, so it keeps its swipe. */}
          <div
            className="h-full [&_.overflow-y-auto]:touch-pan-y"
            style={{ width: `${100 / TABS.length}%` }}
          >
            <PostFeed
              mode="embedded"
              scope={{ type: "author", userId: ownerId }}
              loop
              onActivePost={setActivePost}
              onSwipePastEnd={() => setTab("listed-items")}
              storePicture={storePicture}
            />
          </div>
          <div
            className="h-full [&_.overflow-y-auto]:touch-pan-y"
            style={{ width: `${100 / TABS.length}%` }}
          >
            {listedPane}
          </div>
        </motion.div>
        <div
          // The fade keeps the white labels readable over a pale video.
          className="absolute inset-x-0 top-0 z-30 flex justify-center gap-12 bg-gradient-to-b from-black/45 to-transparent pb-6 text-[14px] font-medium text-white/70"
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
      </div>
      {openedPage}
    </div>
  );
}
