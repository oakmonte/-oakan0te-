import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Play } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { PostFeed } from "@/components/feed/PostFeed";

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

function Tile({ post, ratio, onOpen }: { post: ExplorePost; ratio: string; onOpen: () => void }) {
  const src = post.thumbnail_url || post.media_url;
  const isCarousel = (post.post_media?.[0]?.count ?? 0) > 1;
  const isClip = post.media_type === "video" && post.created_with !== "photo-editor";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative block w-full overflow-hidden rounded-[14px] bg-chat-soft oak-motion-control active:scale-[0.98]"
      style={{ aspectRatio: ratio }}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {isCarousel ? (
        <span className="absolute right-2 top-2 drop-shadow">
          <Copy size={15} className="text-white" strokeWidth={2.5} />
        </span>
      ) : (
        isClip && (
          <span className="absolute right-2 top-2 drop-shadow">
            <Play size={14} className="fill-white text-white" />
          </span>
        )
      )}
    </button>
  );
}

/** The Explore tab: a two-column wall of every published post, newest first.
 *  Tapping one opens the same full-screen swipeable viewer the profile grids
 *  use, scoped to the For You feed and scrolled to the tapped post. */
export function ExploreGrid() {
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
      {activeId && (
        <PostFeed
          scope={{ type: "for-you" }}
          initialPostId={activeId}
          onClose={() => setActiveId(null)}
        />
      )}
    </>
  );
}
