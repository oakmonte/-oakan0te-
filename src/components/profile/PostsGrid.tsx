import { useCallback, useState } from "react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Tables } from "@/lib/integrations/my-supabase/types";
import { PostFeed } from "@/components/feed/PostFeed";

type PostRow = Pick<
  Tables<"posts">,
  "id" | "media_url" | "media_type" | "thumbnail_url" | "caption" | "location" | "created_with"
>;

async function fetchProfilePosts(
  userId: string,
  status: "published" | "draft",
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, media_url, media_type, thumbnail_url, caption, location, created_with")
    .eq("user_id", userId)
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("PostsGrid: failed to load posts", error);
    return [];
  }
  return data ?? [];
}

/** Renders a profile's Posts or Drafts tab: a 3-col grid of a user's real
 *  posts, backed by the `posts` table (RLS decides what a non-owner viewer
 *  gets back — this component doesn't re-filter by visibility itself). Falls
 *  back to `emptyState` (the existing per-tab copy) when there's nothing.
 *  Tapping a thumbnail opens the same full-bleed, swipeable feed viewer used
 *  by Explore's For You/Following tabs, scoped to this same user+status set
 *  and scrolled to the tapped post — one feed-viewing implementation, not two.
 *
 *  Read through react-query, not a raw useEffect: the profile page keeps
 *  every tab panel mounted and people bounce in and out of a profile
 *  constantly, so an uncached fetch meant a "Loading…" flash on every single
 *  visit and every tab switch. Cached, a revisit paints the previous grid
 *  immediately and revalidates behind it. */
export function PostsGrid({
  userId,
  status,
  emptyState,
}: {
  userId: string;
  status: "published" | "draft";
  emptyState: ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // The post viewer is a full-screen page in everything but the URL.
  const closeViewer = useCallback(() => setActiveId(null), []);
  useOverlayHistory(activeId !== null, closeViewer);
  const { data: posts, isPending } = useQuery({
    queryKey: ["profile-posts", userId, status] as const,
    queryFn: () => fetchProfilePosts(userId, status),
    staleTime: 30_000,
  });

  // Skeleton tiles rather than a centred "Loading…" line: same 3-col grid,
  // same aspect ratio, so the real thumbnails drop straight into the boxes
  // the skeleton already reserved instead of shoving the page around.
  if (isPending) {
    return (
      <div className="grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-white/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!posts || posts.length === 0) return <>{emptyState}</>;

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
                disablePictureInPicture
                disableRemotePlayback
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={p.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
            )}
            {/* A live photo is stored as a video but isn't one — a play badge
                on it reads as "this is a clip you'll have to sit through".
                `created_with` is what tells the two apart. */}
            {p.media_type === "video" && p.created_with !== "photo-editor" && (
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
