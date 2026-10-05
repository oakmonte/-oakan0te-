import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2, Play } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { getPostUploadSnapshot, subscribePostUpload } from "@/lib/post-upload";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Tables } from "@/lib/integrations/my-supabase/types";
import { PostFeed } from "@/components/feed/PostFeed";

type PostRow = Pick<
  Tables<"posts">,
  "id" | "media_url" | "media_type" | "thumbnail_url" | "caption" | "location" | "created_with"
> & { post_media: { count: number }[] };

async function fetchProfilePosts(
  userId: string,
  status: "published" | "draft",
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, media_url, media_type, thumbnail_url, caption, location, created_with, post_media(count)",
    )
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
 *  Tapping a thumbnail opens the same full-screen, swipeable feed viewer used
 *  by Explore's For You/Following tabs (in its profile mode, where each post
 *  keeps its own aspect ratio over a blurred backdrop instead of being
 *  cropped), scoped to this same user+status set and scrolled to the tapped
 *  post — one feed-viewing implementation, not two.
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
  const {
    data: posts,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["profile-posts", userId, status] as const,
    queryFn: () => fetchProfilePosts(userId, status),
    staleTime: 30_000,
  });

  // A post this viewer is sending right now shows up first in their own
  // grid the moment it's sent: its cover (a frame of the video) with a
  // spinner, until the real post replaces it. Without this the grid sat
  // unchanged, then the post appeared later, black until its video loaded.
  const { user } = useSession();
  const upload = useSyncExternalStore(subscribePostUpload, getPostUploadSnapshot, () => null);
  const uploadIsHere = !!upload && upload.kind === status && user?.id === userId;
  const landedId = upload?.status === "success" ? upload.postId : null;
  useEffect(() => {
    if (landedId && uploadIsHere) void refetch();
  }, [landedId, uploadIsHere, refetch]);
  const pending =
    uploadIsHere &&
    (upload.status === "uploading" ||
      (upload.status === "success" && !(posts ?? []).some((p) => p.id === upload.postId)))
      ? upload
      : null;

  // Skeleton tiles rather than a centred "Loading…" line: same 3-col grid,
  // same aspect ratio, so the real thumbnails drop straight into the boxes
  // the skeleton already reserved instead of shoving the page around.
  if (isPending) {
    return (
      <div className="grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] bg-chat-text/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  if ((!posts || posts.length === 0) && !pending) return <>{emptyState}</>;

  return (
    <>
      {/* 3:4 tiles, taller than the old squares: posts are portrait, and a
          square crop cut off most of each one. */}
      <div className="grid grid-cols-3 gap-0.5">
        {pending && (
          <div className="relative aspect-[3/4] overflow-hidden bg-chat-surface">
            {pending.preview && (
              <img src={pending.preview} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/25">
              <Loader2 size={26} className="animate-spin text-white drop-shadow" />
            </div>
          </div>
        )}
        {(posts ?? []).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveId(p.id)}
            aria-label="Open post"
            className="oak-motion-control relative aspect-[3/4] bg-chat-surface overflow-hidden active:scale-[0.97]"
          >
            {/* A video with a poster shows the poster as a plain image --
                instant, and no video element per tile. Only a video with no
                poster at all falls back to letting the browser show frame 0. */}
            {p.media_type === "video" && p.thumbnail_url ? (
              <img
                src={p.thumbnail_url}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            ) : p.media_type === "video" ? (
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
            {(p.post_media?.[0]?.count ?? 0) > 1 ? (
              // A carousel: the stacked-pages badge, as on Instagram.
              <span className="absolute top-1.5 right-1.5 drop-shadow">
                <Copy size={14} className="text-white" strokeWidth={2.5} />
              </span>
            ) : (
              p.media_type === "video" &&
              p.created_with !== "photo-editor" && (
                <span className="absolute top-1.5 right-1.5 drop-shadow">
                  <Play size={13} className="fill-white text-white" />
                </span>
              )
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
