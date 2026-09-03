import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  MoreHorizontal,
  ShoppingBag,
  Plus,
  Check,
  Play,
  ChevronLeft,
  Link2,
  MapPin,
} from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Tables } from "@/lib/integrations/my-supabase/types";
import { useSession } from "@/hooks/use-session";
import { CommentSheet } from "@/components/feed/CommentSheet";
import { LinkProductsSheet } from "@/components/feed/LinkProductsSheet";

// Bare icons over the media with no chip behind them, per the reference —
// every one needs its own shadow or they wash out against a light photo.
const ICON_SHADOW = "drop-shadow(0 1px 4px rgba(0,0,0,0.65))";

// Snap back from a swipe that didn't go far enough to dismiss.
const SETTLE_SPRING = { type: "spring" as const, stiffness: 400, damping: 40 };

export type FeedScope =
  | { type: "for-you" }
  | { type: "following"; viewerId: string }
  | { type: "user"; userId: string; status: "published" | "draft" };

export type TaggedProduct = {
  id: string;
  title: string;
  price: number | null;
  image: string | null;
};

/** The post currently filling the screen, reported up so a caller can show
 *  something about it beside the feed — Explore's Listed items tab reads this
 *  to list the products linked to whatever you're looking at. */
export type ActivePost = { id: string; tags: TaggedProduct[] };

type FeedPost = Pick<
  Tables<"posts">,
  "id" | "user_id" | "media_url" | "media_type" | "thumbnail_url" | "caption" | "location"
> & {
  authorDisplayName: string | null;
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
  // public_profiles, not profiles: profiles' SELECT policy is auth.uid() = id,
  // so embedding it returns a row for your OWN posts and null for everybody
  // else's — which is why every other author showed up as "User" with a blank
  // avatar. The view exposes exactly the public columns, and posts_user_id_fkey
  // resolves against it.
  let query = supabase
    .from("posts")
    .select(
      "id, user_id, media_url, media_type, thumbnail_url, caption, location, public_profiles(display_name, personal_username, avatar_url)",
    )
    .order("created_at", { ascending: false });

  if (scope.type === "user") {
    // No limit for a single profile's grid — PostsGrid renders every post it
    // finds, and capping here meant tapping anything past the cap scrolled to
    // a post that wasn't in the feed and silently landed on the first one.
    query = query.eq("user_id", scope.userId).eq("status", scope.status);
  } else {
    query = query.limit(FEED_LIMIT);
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
    authorDisplayName:
      p.public_profiles?.display_name ?? p.public_profiles?.personal_username ?? null,
    authorAvatar: p.public_profiles?.avatar_url ?? null,
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
  asStore = false,
  onActivePost,
}: {
  scope: FeedScope;
  initialPostId?: string;
  onClose?: () => void;
  mode?: "embedded" | "standalone";
  /** Set by a surface where the viewer is acting as one of their stores
   *  (the store profile's own post viewer, once stores can post). Hides
   *  add-to-cart: a store is a seller identity, it doesn't buy. Browsing as
   *  yourself this stays false everywhere — you can buy from your own store. */
  asStore?: boolean;
  /** Called with whichever post is currently filling the screen, including on
   *  every scroll to a new one. Explore uses it to keep its Listed items tab
   *  pointed at the post you were just looking at. */
  onActivePost?: (active: ActivePost) => void;
}) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const key = scopeKey(scope);
  const { user: viewer } = useSession();
  const viewerId = viewer?.id ?? null;
  // Stable, so the card's "I'm on screen" effect doesn't re-run every render
  // of the feed.
  const handleActive = useCallback((active: ActivePost) => onActivePost?.(active), [onActivePost]);

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

  // `relative` on the embedded shell matters: the inner layers are
  // `absolute inset-0`, and embedded mode has no `fixed` to position against.
  const shellClass =
    mode === "standalone"
      ? "fixed inset-0 z-[70] bg-black"
      : "relative w-full h-full bg-black overflow-hidden";

  // Swipe RIGHT to dismiss.
  //
  // This used to be swipe-down, which meant every downward drag had to be
  // classified as either "scroll to the previous post" or "close the viewer" —
  // and the only thing separating them was where the scroller happened to be
  // resting. That's a coin flip from the viewer's point of view. Right is a
  // free axis here (the feed only ever scrolls vertically), so the two
  // gestures can't be confused: up/down always pages posts, right always
  // leaves.
  //
  // Still a NON-PASSIVE touchmove listener rather than pointer events: the
  // moment the browser decides a touch is a scroll it fires pointercancel and
  // stops delivering pointermove, so a gesture starting on a scrolling list
  // can never be picked up that way. preventDefault() on the first clearly
  // horizontal move stops the browser claiming it. Registered imperatively
  // because React attaches onTouchMove passively, where preventDefault() is a
  // no-op.
  const dismissX = useMotionValue(0);
  // Shrinks and rounds toward a card as it slides off, the way both references
  // do — the motion alone read as the page glitching rather than as the post
  // being put away. Opacity lives on the backdrop behind it, never on the
  // media itself (fading a photo looks like a broken render).
  const dismissScale = useTransform(dismissX, [0, 320], [1, 0.86]);
  const dismissRadius = useTransform(dismissX, [0, 120], [0, 26]);
  const backdropOpacity = useTransform(dismissX, [0, 320], [1, 0.35]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onClose) return;

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let tracking = false;
    let engaged = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = lastX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastT = e.timeStamp;
      velocity = 0;
      tracking = true;
      engaged = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      const dx = x - startX;
      const dy = e.touches[0].clientY - startY;

      // Direction lock, decided once on the first move big enough to have a
      // direction. Anything that isn't a clear rightward swipe — vertical, or
      // leftward — is handed straight back to native scrolling for the rest of
      // the gesture, so paging between posts is untouched.
      if (!engaged) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (dx <= 0 || Math.abs(dx) <= Math.abs(dy)) {
          tracking = false;
          return;
        }
        engaged = true;
      }

      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = ((x - lastX) / dt) * 1000;
      lastX = x;
      lastT = e.timeStamp;

      e.preventDefault();
      // 1:1 with the finger. A back-swipe that lags behind the thumb is the
      // thing that made the old gesture feel synthetic.
      dismissX.set(Math.max(0, dx));
    };

    const onTouchEnd = () => {
      if (engaged) {
        const travelled = lastX - startX;
        // A quarter of the screen, or a flick — the same deal every
        // swipe-back on the platform offers.
        if (travelled > el.clientWidth * 0.25 || velocity > 500) {
          // Carry it the rest of the way off-screen instead of cutting: an
          // instant unmount mid-gesture is what made this feel broken.
          animate(dismissX, el.clientWidth, { duration: 0.18, ease: "easeOut" }).then(() =>
            onClose(),
          );
        } else {
          animate(dismissX, 0, SETTLE_SPRING);
        }
      }
      tracking = false;
      engaged = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onClose, dismissX]);

  // The page behind a full-screen viewer must not scroll under it — and
  // scrollIntoView below walks scrollable ANCESTORS, so without this opening
  // the viewer also dragged the profile page around behind it.
  useEffect(() => {
    if (mode !== "standalone") return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mode]);

  // Declared before the early returns so the loading and empty states get it
  // too — the loading state used to be a black screen with no way out.
  const closeButton = onClose && (
    <button
      type="button"
      onClick={onClose}
      aria-label="Back"
      className="absolute z-20 flex items-center justify-center active:scale-90"
      style={{ top: "calc(env(safe-area-inset-top) + 12px)", left: 16, filter: ICON_SHADOW }}
    >
      <ChevronLeft size={26} className="text-white" />
    </button>
  );

  let body: ReactNode;
  if (posts === null) {
    body = (
      <div className={`${shellClass} flex items-center justify-center`}>
        {closeButton}
        <p className="text-[13px] text-white/40">Loading…</p>
      </div>
    );
  } else if (posts.length === 0) {
    body = (
      <div className={`${shellClass} flex flex-col items-center justify-center text-center px-8`}>
        {closeButton}
        <p className="text-[13px] text-white/50 max-w-[220px]">
          {scope.type === "following"
            ? "Follow people to see their posts here."
            : "Nothing to show yet."}
        </p>
      </div>
    );
  } else {
    body = (
      // Three nodes on purpose: a static backdrop that stays put and fades,
      // the shell that carries the dismiss transform, and the scroller.
      // Transforming the scroller itself (what this used to do) fights
      // scroll-snap and leaves the snap points offset mid-gesture.
      <div className={shellClass}>
        <motion.div className="absolute inset-0 bg-black" style={{ opacity: backdropOpacity }} />
        <motion.div
          className="absolute inset-0 overflow-hidden bg-black"
          style={{
            x: dismissX,
            scale: dismissScale,
            borderRadius: dismissRadius,
          }}
        >
          {closeButton}
          <div
            ref={containerRef}
            className="h-full w-full overflow-y-auto"
            style={{ scrollSnapType: "y mandatory" }}
          >
            {posts.map((post) => (
              <FeedPostCard
                key={post.id}
                post={post}
                viewerId={viewerId}
                isProfileViewer={scope.type === "user"}
                asStore={asStore}
                onActive={handleActive}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Portalled in standalone mode. It renders from inside PostsGrid, which now
  // lives inside the profile pager's transformed track — and a transformed
  // ancestor becomes the containing block for `position: fixed`, so the
  // overlay was being laid out against the track and dragged N screen-widths
  // off to the left with it. On the Posts tab (x = 0, no transform emitted) it
  // happened to look right, which is exactly the kind of bug that only shows
  // up on the Drafts tab.
  if (mode === "standalone" && typeof document !== "undefined") {
    return createPortal(body, document.body);
  }
  return <>{body}</>;
}

function FeedPostCard({
  post,
  viewerId,
  isProfileViewer,
  asStore,
  onActive,
}: {
  post: FeedPost;
  viewerId: string | null;
  /** Fired when this card becomes the one on screen. */
  onActive: (active: ActivePost) => void;
  /** True when this feed is a profile grid's post viewer rather than the home
   *  feed. The "more" menu is scoped to that view: in the home feed your own
   *  post is just another post in the stream and still gets the share plane. */
  isProfileViewer: boolean;
  /** True when the viewer is acting as a store rather than as a person.
   *  Stores don't buy, so the add-to-cart bag is hidden. */
  asStore: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Two separate ideas, deliberately not one `playing` flag: `onScreen` is
  // whether this card is the one being looked at, `userPaused` is whether the
  // viewer deliberately stopped it. Only the second should ever show the pause
  // glyph, and only the second should survive a scroll away and back.
  const [onScreen, setOnScreen] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [following, setFollowing] = useState(post.authorIsFollowed);
  const [followPending, setFollowPending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [burst, setBurst] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  // Local so linking a product updates the chips under the caption straight
  // away — the feed's post list is fetched once and isn't refetched on a
  // link, and re-running the whole query to move one chip would jump the
  // scroller off the post you're standing on.
  const [tags, setTags] = useState<TaggedProduct[]>(post.tags);
  const isOwnPost = viewerId === post.user_id;
  const isVideo = post.media_type === "video";
  // The owner-only management surface: link products, and the "more" menu.
  const isOwnerView = isOwnPost && isProfileViewer;

  // "Is this the card being looked at" — two things ride on it. Autoplay is
  // scoped to it (every video in the feed playing at once would saturate the
  // connection on the mobile networks this app is built for, so exactly one
  // plays and the rest sit paused on their poster), and it's what tells the
  // caller which post's linked products to show on its Listed items tab.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.intersectionRatio >= 0.6), {
      threshold: [0, 0.6, 1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (onScreen) onActive({ id: post.id, tags });
  }, [onScreen, post.id, tags, onActive]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (onScreen && !userPaused) {
      // Rejected play() is normal (a still-loading src, a backgrounded tab) —
      // it must not surface as an unhandled rejection.
      void v.play().catch(() => {});
    } else {
      v.pause();
      // Scrolling back to a post should start it over, the way both references
      // do, rather than resuming from wherever it was abandoned.
      if (!onScreen) v.currentTime = 0;
    }
  }, [onScreen, userPaused]);

  // A deliberate pause belongs to the moment, not to the post: scroll away and
  // back and it plays again.
  useEffect(() => {
    if (!onScreen) setUserPaused(false);
  }, [onScreen]);

  // Single tap toggles playback, double tap likes — so a single tap has to
  // wait out the double-tap window before it commits. 260ms is short enough
  // not to feel laggy and long enough that a real double tap lands inside it.
  const tapTimer = useRef<number | null>(null);
  const tapStart = useRef({ x: 0, y: 0 });
  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  function handleTap() {
    if (tapTimer.current !== null) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      // Double tap only ever likes, never unlikes — same as Instagram. The
      // heart in the rail is the way back out.
      setLiked(true);
      setBurst((n) => n + 1);
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      if (isVideo) setUserPaused((p) => !p);
    }, 260);
  }

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
      ref={cardRef}
      data-post-id={post.id}
      className="relative w-full h-full bg-neutral-950 text-white"
      style={{ scrollSnapAlign: "start" }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={post.media_url}
          poster={post.thumbnail_url ?? undefined}
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <img src={post.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}

      {/* The tap surface. Its own layer rather than a handler on the media so
          it can sit under the rail and the caption — those get their own taps
          — and so a photo post is tappable for the double-tap like too. The
          movement guard keeps a scroll that ends with a lift from registering
          as a tap. */}
      <div
        className="absolute inset-0"
        onPointerDown={(e) => {
          tapStart.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const dx = e.clientX - tapStart.current.x;
          const dy = e.clientY - tapStart.current.y;
          if (Math.hypot(dx, dy) < 10) handleTap();
        }}
      />

      {/* Pause glyph, only for a deliberate pause. It used to show whenever
          the video wasn't playing, which — now that playback starts on its
          own — would mean a play button flashing over every card you scroll
          past. */}
      {isVideo && userPaused && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0, scale: 1.25 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.12 }}
        >
          <Play size={64} className="text-white/75" fill="currentColor" strokeWidth={0} />
        </motion.div>
      )}

      {/* Double-tap like burst. Keyed on a counter so tapping again while the
          previous heart is still fading restarts it instead of doing nothing. */}
      <AnimatePresence>
        {burst > 0 && (
          <motion.div
            key={burst}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.15, 1, 1.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, times: [0, 0.2, 0.6, 1] }}
          >
            <Heart size={112} className="text-white" fill="#fe2c55" strokeWidth={0} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute right-5 bottom-28 flex flex-col items-center text-white">
        {/* Avatar always sits above the action rail, in line with it — only
            the follow +/check badge is conditional on not being your own post. */}
        <div className="relative mb-8">
          <div
            className="w-9 h-9 rounded-full overflow-hidden bg-white/20 border-2 border-white"
            style={{ filter: ICON_SHADOW }}
          >
            {post.authorAvatar && (
              <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          {!isOwnPost && viewerId && (
            <button
              type="button"
              onClick={toggleFollow}
              aria-label={following ? "Unfollow" : "Follow"}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#fe2c55] text-white active:scale-90"
            >
              {following ? <Check size={11} strokeWidth={3} /> : <Plus size={11} strokeWidth={3} />}
            </button>
          )}
        </div>
        <div className="flex flex-col items-center gap-10">
          <button
            type="button"
            onClick={() => setLiked((v) => !v)}
            aria-label={liked ? "Unlike" : "Like"}
            aria-pressed={liked}
            className="active:scale-90 transition-transform duration-150"
          >
            <Heart
              size={26}
              style={{ filter: ICON_SHADOW }}
              className={liked ? "text-[#fe2c55]" : "text-white"}
              fill={liked ? "#fe2c55" : "none"}
            />
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            aria-label="Comments"
            className="active:scale-90 transition-transform duration-150"
          >
            <MessageCircle size={26} style={{ filter: ICON_SHADOW }} />
          </button>
          <Bookmark size={26} style={{ filter: ICON_SHADOW }} />
          {/* Add-to-cart: adds every product tagged on this post at once so
              the viewer can keep scrolling without leaving the feed.
              Hidden by WHO'S BROWSING, not by who owns the post: a store
              identity doesn't buy, so it never sees the bag. Browsing as
              yourself you always see it — including on your own posts and
              your own store's, because owning a shop doesn't stop you buying
              from it. There's no cart table or /cart route anywhere in the
              app yet (BottomNav already links to a /cart route that doesn't
              exist), so wiring this for real means standing up a whole cart
              subsystem first, not something to improvise as a side effect
              of a feed icon. */}
          {!asStore && (
            <div className="relative" style={{ filter: ICON_SHADOW }}>
              <ShoppingBag size={26} />
              {tags.length > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-white text-black">
                  <Plus size={11} strokeWidth={3} />
                </span>
              )}
            </div>
          )}
          {/* Link products — owner-only, directly above the "more" dots.
              Linking is what makes a post shoppable: the products picked here
              are what draw the chips under the caption and what a stranger
              swiping to Listed items on this post ends up looking at. */}
          {isOwnerView && (
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              aria-label="Link products"
              className="relative active:scale-90 transition-transform duration-150"
              style={{ filter: ICON_SHADOW }}
            >
              <Link2 size={26} />
              {tags.length > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-white text-black text-[10px] font-bold">
                  {tags.length}
                </span>
              )}
            </button>
          )}
          {/* "More" (delete, edit, and so on) replaces the share plane only in
              your own profile's post viewer — that's the management surface.
              In the home feed the same post of yours is just another post in
              the stream, so it keeps the plane. No options menu exists yet;
              this is the icon swap. */}
          {isOwnerView ? (
            <MoreHorizontal size={26} style={{ filter: ICON_SHADOW }} />
          ) : (
            <Send
              size={26}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: ICON_SHADOW }}
            />
          )}
        </div>
      </div>

      <div className="absolute left-4 bottom-28 right-20">
        <p
          className="text-[14px] font-semibold truncate text-white"
          style={{ filter: ICON_SHADOW }}
        >
          {post.authorDisplayName ?? "User"}
        </p>
        {post.caption && <p className="text-[13px] text-white/80 mt-0.5">{post.caption}</p>}
        {post.location && (
          <p className="text-[12px] text-white/50 flex items-center gap-1 mt-1">
            <MapPin size={12} /> {post.location}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-2.5" style={{ scrollbarWidth: "none" }}>
            {tags.map((t) => (
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

      <CommentSheet open={commentsOpen} onClose={() => setCommentsOpen(false)} />
      {isOwnerView && (
        <LinkProductsSheet
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          postId={post.id}
          linked={tags}
          onChange={setTags}
        />
      )}
    </div>
  );
}
