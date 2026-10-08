import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, MoreHorizontal } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { AnimatePresence } from "framer-motion";
import { ExploreFeedOverlay } from "@/components/ExploreFeedOverlay";

type ExplorePost = {
  id: string;
  media_url: string;
  media_type: string;
  thumbnail_url: string | null;
  created_with: string | null;
  post_media: { count: number }[];
};

async function fetchExplorePosts(): Promise<ExplorePost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, media_url, media_type, thumbnail_url, created_with, post_media(count)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(60);
  // Thrown so react-query keeps the grid it already has on a flaky connection.
  if (error) {
    console.error("ExploreGrid: failed to load posts", error);
    throw error;
  }
  return data ?? [];
}

// Photos have no stored size, so tiles cycle through a few ratios per column.
// It reads as the staggered wall of the design without a layout shift when
// the real image arrives (object-cover fills whatever box it gets).
const LEFT_RATIOS = ["4/5", "1/1", "3/4", "5/6", "2/3"];
const RIGHT_RATIOS = ["1/1", "3/4", "4/5", "2/3", "5/6"];

// A grid video plays on its own, muted and looping, but only while it is on
// screen: dozens of videos decoding at once saturates a phone, so each tile
// watches itself and starts or stops with its visibility. The source is only
// attached once the tile is near the viewport.
function TileVideo({ src, poster }: { src: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  visibleRef.current = visible;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Two watchers: one attaches the source a little before the tile scrolls
    // in, the other decides playing. A shared rootMargin would count a tile
    // just above the screen as "visible" and keep it playing off-screen.
    const nearObs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
      },
      { rootMargin: "200px 0px" },
    );
    const visibleObs = new IntersectionObserver(
      ([entry]) => setVisible(entry.intersectionRatio >= 0.5),
      { threshold: [0, 0.5] },
    );
    nearObs.observe(el);
    visibleObs.observe(el);
    return () => {
      nearObs.disconnect();
      visibleObs.disconnect();
    };
  }, []);

  // Driven by state, not called from the observer: the first "visible" can
  // arrive before the source is attached, and a play() then is lost.
  useEffect(() => {
    const el = ref.current;
    if (!el || !near) return;
    if (visible) void el.play().catch(() => {});
    else el.pause();
  }, [near, visible]);

  return (
    <video
      ref={ref}
      src={near ? src : undefined}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      // A play() asked for before any data is loaded can be dropped; ask again
      // once there is a frame, if the tile is still on screen.
      onLoadedData={(e) => {
        if (visibleRef.current) void e.currentTarget.play().catch(() => {});
      }}
      disablePictureInPicture
      disableRemotePlayback
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

function Tile({ post, ratio, onOpen }: { post: ExplorePost; ratio: string; onOpen: () => void }) {
  const isCarousel = (post.post_media?.[0]?.count ?? 0) > 1;
  const isVideo = post.media_type === "video";
  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        className="relative block w-full overflow-hidden rounded-[14px] bg-chat-soft oak-motion-control active:scale-[0.98]"
        style={{ aspectRatio: ratio }}
      >
        {isVideo ? (
          <TileVideo src={post.media_url} poster={post.thumbnail_url} />
        ) : (
          <img
            src={post.thumbnail_url || post.media_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {isCarousel && (
          <span className="absolute right-2 top-2 drop-shadow">
            <Copy size={15} className="text-white" strokeWidth={2.5} />
          </span>
        )}
      </button>
      {/* Just the dots: no glass, no background. */}
      <button
        type="button"
        aria-label="More"
        className="flex h-8 w-10 items-center justify-start px-1 text-chat-text active:opacity-60"
      >
        <MoreHorizontal size={20} />
      </button>
    </div>
  );
}

/** The Explore tab: a two-column wall of every published post, newest first.
 *  Tapping one opens the same full-screen swipeable viewer the profile grids
 *  use, scoped to the For You feed and scrolled to the tapped post. */
export function ExploreGrid({ ownUsername }: { ownUsername?: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: posts, isPending } = useQuery({
    queryKey: ["home-explore-posts"],
    queryFn: fetchExplorePosts,
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-2 px-2 pt-24">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-[14px] bg-chat-soft"
            style={{ aspectRatio: i % 2 ? "3/4" : "4/5" }}
          />
        ))}
      </div>
    );
  }
  if (!posts || posts.length === 0) {
    return (
      <div className="px-8 pt-[40vh] text-center">
        <p className="text-[17px] font-semibold text-chat-text">Nothing to explore yet</p>
        <p className="mt-1 text-[14px] text-chat-muted">
          Posts from creators and stores land here as soon as they&apos;re published.
        </p>
      </div>
    );
  }

  const left = posts.filter((_, i) => i % 2 === 0);
  const right = posts.filter((_, i) => i % 2 === 1);
  return (
    <>
      <div className="grid grid-cols-2 items-start gap-2 px-2 pt-24">
        <div className="flex flex-col gap-2">
          {left.map((p, i) => (
            <Tile
              key={p.id}
              post={p}
              ratio={LEFT_RATIOS[i % LEFT_RATIOS.length]}
              onOpen={() => setActiveId(p.id)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {right.map((p, i) => (
            <Tile
              key={p.id}
              post={p}
              ratio={RIGHT_RATIOS[i % RIGHT_RATIOS.length]}
              onOpen={() => setActiveId(p.id)}
            />
          ))}
        </div>
      </div>
      <AnimatePresence>
        {activeId && (
          <ExploreFeedOverlay
            key="explore-overlay"
            ownUsername={ownUsername}
            initialPostId={activeId}
            onClose={() => setActiveId(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
