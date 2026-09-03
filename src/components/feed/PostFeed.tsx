import { useEffect, useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  Bookmark,
  ArrowUpRight,
  ShoppingBag,
  Plus,
  Check,
  Play,
  X,
  MapPin,
} from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Tables } from "@/lib/integrations/my-supabase/types";
import { useSession } from "@/hooks/use-session";

// Bare icons over the media with no chip behind them, per the reference —
// every one needs its own shadow or they wash out against a light photo.
const ICON_SHADOW = "drop-shadow(0 1px 4px rgba(0,0,0,0.65))";

export type FeedScope =
  | { type: "for-you" }
  | { type: "following"; viewerId: string }
  | { type: "user"; userId: string; status: "published" | "draft" };

type TaggedProduct = { id: string; title: string; price: number | null; image: string | null };

type FeedPost = Pick<
  Tables<"posts">,
  "id" | "user_id" | "media_url" | "media_type" | "thumbnail_url" | "caption" | "location"
> & {
  authorUsername: string | null;
  authorAvatar: string | null;
  authorIsFollowed: boolean;
  tags: TaggedProduct[];
};

const FEED_LIMIT = 30;

function scopeKey(scope: FeedScope): string {
  if (scope.type === "for-you") return "for-you";
  if (scope.type === "following") return `following:${scope.viewerId}`;
  return `user:${scope.userId}:${scope.status}`;
}

async function fetchFeed(scope: FeedScope, viewerId: string | null): Promise<FeedPost[]> {
  let query = supabase
    .from("posts")
    .select(
      "id, user_id, media_url, media_type, thumbnail_url, caption, location, profiles(personal_username, avatar_url)",
    )
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);

  if (scope.type === "user") {
    query = query.eq("user_id", scope.userId).eq("status", scope.status);
  } else {
    query = query.eq("status", "published");
    if (scope.type === "following") {
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", scope.viewerId);
      const followingIds = (followRows ?? []).map((r) => r.following_id);
      if (followingIds.length === 0) return [];
      query = query.in("user_id", followingIds);
    }
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("PostFeed: failed to load posts", error);
    return [];
  }

  const postIds = data.map((p) => p.id);
  const tagsByPost = new Map<string, TaggedProduct[]>();
  if (postIds.length > 0) {
    const { data: tagRows } = await supabase
      .from("post_product_tags")
      .select("post_id, products(id, title, product_variants(price, main_image_url))")
      .in("post_id", postIds);
    for (const row of tagRows ?? []) {
      const p = row.products;
      if (!p) continue;
      const list = tagsByPost.get(row.post_id) ?? [];
      list.push({
        id: p.id,
        title: p.title ?? "Untitled",
        price: p.product_variants[0]?.price ?? null,
        image: p.product_variants[0]?.main_image_url ?? null,
      });
      tagsByPost.set(row.post_id, list);
    }
  }

  // "following" scope already implies every author here is followed; for
  // for-you/user scopes it isn't known yet, so check for real against the
  // same follows table rather than guessing.
  let followedAuthorIds = new Set<string>();
  if (scope.type === "following") {
    followedAuthorIds = new Set(data.map((p) => p.user_id));
  } else if (viewerId) {
    const authorIds = [...new Set(data.map((p) => p.user_id))];
    if (authorIds.length > 0) {
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", viewerId)
        .in("following_id", authorIds);
      followedAuthorIds = new Set((followRows ?? []).map((r) => r.following_id));
    }
  }

  return data.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    media_url: p.media_url,
    media_type: p.media_type,
    thumbnail_url: p.thumbnail_url,
    caption: p.caption,
    location: p.location,
    authorUsername: p.profiles?.personal_username ?? null,
    authorAvatar: p.profiles?.avatar_url ?? null,
    authorIsFollowed: followedAuthorIds.has(p.user_id),
    tags: tagsByPost.get(p.id) ?? [],
  }));
}

/** Real, shared post-feed engine: a full-bleed, vertically snap-scrolling
 *  feed backed by the `posts` table (RLS decides what a viewer actually gets
 *  back). Powers Explore's For You/Following tabs AND the profile grid's post
 *  viewer, so "swipe through real posts" only has one implementation.
 *
 *  `mode="embedded"` renders as a plain w-full/h-full block with no close
 *  button, for a caller (ExploreFeedOverlay) that already owns the
 *  fixed-position chrome around it. `mode="standalone"` (default) owns its
 *  own fixed full-screen overlay + close button, for a caller (PostsGrid)
 *  that has nothing like that already. Engagement icons (like/comment/save/
 *  share) are decoration, not wired up — there's no likes/comments schema
 *  yet, and a fake count would be worse than an honest do-nothing button. */
export function PostFeed({
  scope,
  initialPostId,
  onClose,
  mode = "standalone",
}: {
  scope: FeedScope;
  initialPostId?: string;
  onClose?: () => void;
  mode?: "embedded" | "standalone";
}) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const key = scopeKey(scope);
  const { user: viewer } = useSession();
  const viewerId = viewer?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    fetchFeed(scope, viewerId).then((rows) => {
      if (!cancelled) setPosts(rows);
    });
    return () => {
      cancelled = true;
    };
    // scope is re-derived into `key` above; that's the real dependency —
    // callers routinely pass a fresh scope object literal every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, viewerId]);

  useEffect(() => {
    if (!initialPostId || !posts) return;
    containerRef.current
      ?.querySelector(`[data-post-id="${initialPostId}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [initialPostId, posts]);

  const wrapperClass =
    mode === "standalone"
      ? "fixed inset-0 z-[70] bg-black overflow-y-auto"
      : "w-full h-full bg-black overflow-y-auto";

  if (posts === null) {
    return (
      <div className={`${wrapperClass} flex items-center justify-center`}>
        <p className="text-[13px] text-white/40">Loading…</p>
      </div>
    );
  }

  const closeButton = onClose && (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="fixed z-20 flex items-center justify-center w-9 h-9 rounded-full active:scale-90"
      style={{
        top: "calc(env(safe-area-inset-top) + 12px)",
        left: 16,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(10px)",
      }}
    >
      <X size={18} className="text-white" />
    </button>
  );

  if (posts.length === 0) {
    return (
      <div className={`${wrapperClass} flex flex-col items-center justify-center text-center px-8`}>
        {closeButton}
        <p className="text-[13px] text-white/50 max-w-[220px]">
          {scope.type === "following"
            ? "Follow people to see their posts here."
            : "Nothing to show yet."}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={wrapperClass} style={{ scrollSnapType: "y mandatory" }}>
      {closeButton}
      {posts.map((post) => (
        <FeedPostCard key={post.id} post={post} viewerId={viewerId} />
      ))}
    </div>
  );
}

function FeedPostCard({ post, viewerId }: { post: FeedPost; viewerId: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [following, setFollowing] = useState(post.authorIsFollowed);
  const [followPending, setFollowPending] = useState(false);
  const isOwnPost = viewerId === post.user_id;

  async function toggleFollow() {
    if (!viewerId || followPending) return;
    const next = !following;
    setFollowing(next);
    setFollowPending(true);
    try {
      const { error } = next
        ? await supabase
            .from("follows")
            .insert({ follower_id: viewerId, following_id: post.user_id })
        : await supabase
            .from("follows")
            .delete()
            .eq("follower_id", viewerId)
            .eq("following_id", post.user_id);
      if (error) throw error;
    } catch (err) {
      console.error("PostFeed: follow toggle failed", err);
      setFollowing(!next);
    } finally {
      setFollowPending(false);
    }
  }

  return (
    <div
      data-post-id={post.id}
      className="relative w-full h-full bg-neutral-950"
      style={{ scrollSnapAlign: "start" }}
    >
      {post.media_type === "video" ? (
        <>
          <video
            ref={videoRef}
            src={post.media_url}
            poster={post.thumbnail_url ?? undefined}
            loop
            playsInline
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) {
                void v.play();
                setPlaying(true);
              } else {
                v.pause();
                setPlaying(false);
              }
            }}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <Play size={40} className="text-white/70" />
              </div>
            </div>
          )}
        </>
      ) : (
        <img src={post.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}

      <div className="absolute right-3 bottom-56 flex flex-col items-center">
        {!isOwnPost && (
          <div className="relative mb-8">
            <div
              className="w-9 h-9 rounded-full overflow-hidden bg-white/20 border-2 border-white"
              style={{ filter: ICON_SHADOW }}
            >
              {post.authorAvatar && (
                <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            {viewerId && (
              <button
                type="button"
                onClick={toggleFollow}
                aria-label={following ? "Unfollow" : "Follow"}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#fe2c55] text-white active:scale-90"
              >
                {following ? (
                  <Check size={11} strokeWidth={3} />
                ) : (
                  <Plus size={11} strokeWidth={3} />
                )}
              </button>
            )}
          </div>
        )}
        <div className="flex flex-col items-center gap-8">
          <Heart size={26} style={{ filter: ICON_SHADOW }} />
          <MessageCircle size={26} style={{ filter: ICON_SHADOW }} />
          <Bookmark size={26} style={{ filter: ICON_SHADOW }} />
          {/* Add-to-cart: adds every product tagged on this post at once so
              the viewer can keep scrolling without leaving the feed. Always
              shown, per the reference, even when this post has no tags yet —
              there's no cart table or /cart route anywhere in the app yet
              (BottomNav already links to a /cart route that doesn't exist),
              so wiring this for real means standing up a whole cart
              subsystem first, not something to improvise as a side effect
              of a feed icon. */}
          <div className="relative" style={{ filter: ICON_SHADOW }}>
            <ShoppingBag size={26} />
            {post.tags.length > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-white text-black">
                <Plus size={11} strokeWidth={3} />
              </span>
            )}
          </div>
          <ArrowUpRight size={26} style={{ filter: ICON_SHADOW }} />
        </div>
      </div>

      <div className="absolute left-4 bottom-28 right-20">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-white/15 overflow-hidden shrink-0">
            {post.authorAvatar && (
              <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <p className="text-[14px] font-semibold truncate">@{post.authorUsername ?? "user"}</p>
        </div>
        {post.caption && <p className="text-[13px] text-white/80">{post.caption}</p>}
        {post.location && (
          <p className="text-[12px] text-white/50 flex items-center gap-1 mt-1">
            <MapPin size={12} /> {post.location}
          </p>
        )}
        {post.tags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-2.5" style={{ scrollbarWidth: "none" }}>
            {post.tags.map((t) => (
              <div
                key={t.id}
                className="shrink-0 flex items-center gap-2 rounded-full pl-1 pr-3 py-1"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <img
                  src={t.image ?? "https://placehold.co/32x32"}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
                <span className="text-[12px]">
                  {t.title}
                  {t.price != null ? ` · ₦${t.price.toLocaleString()}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
