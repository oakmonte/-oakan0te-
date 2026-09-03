import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Tables } from "@/lib/integrations/my-supabase/types";
import { PostFeed } from "@/components/feed/PostFeed";

type PostRow = Pick<
  Tables<"posts">,
  "id" | "media_url" | "media_type" | "thumbnail_url" | "caption" | "location"
>;

/** Renders a profile's Posts or Drafts tab: a 3-col grid of a user's real
 *  posts, backed by the `posts` table (RLS decides what a non-owner viewer
 *  gets back — this component doesn't re-filter by visibility itself). Falls
 *  back to `emptyState` (the existing per-tab copy) when there's nothing.
 *  Tapping a thumbnail opens the same full-bleed, swipeable feed viewer used
 *  by Explore's For You/Following tabs, scoped to this same user+status set
 *  and scrolled to the tapped post — one feed-viewing implementation, not two. */
export function PostsGrid({
  userId,
  status,
  emptyState,
}: {
  userId: string;
  status: "published" | "draft";
  emptyState: ReactNode;
}) {
  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    supabase
      .from("posts")
      .select("id, media_url, media_type, thumbnail_url, caption, location")
      .eq("user_id", userId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("PostsGrid: failed to load posts", error);
        setPosts(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, status]);

  if (posts === null) {
    return <div className="text-center text-[13px] text-white/40 py-12">Loading…</div>;
  }
  if (posts.length === 0) return <>{emptyState}</>;

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5">
        {posts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveId(p.id)}
            aria-label="Open post"
            className="oak-motion-control relative aspect-square bg-neutral-900 overflow-hidden active:scale-[0.97]"
          >
            {p.media_type === "video" ? (
              <video
                src={p.media_url}
                poster={p.thumbnail_url ?? undefined}
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={p.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
            )}
            {p.media_type === "video" && (
              <span className="absolute top-1.5 right-1.5 drop-shadow">
                <Play size={13} className="fill-white text-white" />
              </span>
            )}
          </button>
        ))}
      </div>

      {activeId && (
        <PostFeed
          scope={{ type: "user", userId, status }}
          initialPostId={activeId}
          onClose={() => setActiveId(null)}
        />
      )}
    </>
  );
}
