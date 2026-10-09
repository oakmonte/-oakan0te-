import { lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Image as ImageIcon, Play, Plus } from "lucide-react";
import { useActiveStore } from "@/hooks/use-own-store";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useSession } from "@/hooks/use-session";
import { useStoreInsights } from "@/hooks/use-store-insights";
import { ComingSoonState } from "@/components/store/ComingSoonState";
import { PeriodPicker } from "@/components/store/insights/PeriodPicker";
import {
  ListSkeleton,
  LoadError,
  PageHeader,
  Stat,
  Thumb,
  TruncatedNote,
} from "@/components/store/insights/parts";
import {
  formatDate,
  formatKobo,
  periodLabel,
  type ContentPost,
  type ContentResponse,
  type Period,
} from "@/lib/insights";

// The full-screen post viewer is the same one profiles use. Lazy, so the feed
// (video handling, gestures) downloads only when a seller actually taps a post.
const PostFeed = lazy(() =>
  import("@/components/feed/PostFeed").then((m) => ({ default: m.PostFeed })),
);

export const Route = createFileRoute("/store/content")({
  component: ContentPage,
});

const VISIBILITY: Record<string, string> = {
  followers: "Followers only",
  only_me: "Only you",
};

/** The seller's posts and what came of them: which of this store's pieces
 *  each one links, and the paid orders of those pieces since it went up. */
function ContentPage() {
  const { storeId } = useActiveStore();
  const { user } = useSession();
  const [period, setPeriod] = useState<Period>("30d");
  const { data, isPending, isError, isPlaceholderData, isFetching, refetch } =
    useStoreInsights<ContentResponse>(storeId, "content", { period });
  const [viewing, setViewing] = useState<string | null>(null);
  const closeViewer = useCallback(() => setViewing(null), []);
  useOverlayHistory(viewing !== null, closeViewer);

  const createButton = (
    <Link
      to="/create"
      className="oak-tap inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-sd-ink px-5 text-[14px] font-semibold text-sd-bg oak-motion-control active:scale-[0.97]"
    >
      <Plus size={16} /> Create a post
    </Link>
  );

  if (isPending || !storeId) {
    return (
      <Shell>
        <PageHeader title="Content" />
        <span className="sr-only" role="status">
          Loading your posts
        </span>
        <ListSkeleton rows={4} />
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <PageHeader title="Content" />
        {isError && <LoadError message="Couldn't load your content" onRetry={() => void refetch()} />}
      </Shell>
    );
  }
  if (data.totals.published === 0) {
    return (
      <div className="flex flex-col items-center">
        <ComingSoonState
          icon={ImageIcon}
          title="No posts yet"
          description="Post your pieces and link them, and this shows which posts lead to orders."
        />
        <div className="-mt-6">{createButton}</div>
      </div>
    );
  }

  const label = periodLabel(period).toLowerCase();

  return (
    <Shell>
      <PageHeader title="Content">
        Your posts, the pieces they link, and the orders that followed.
      </PageHeader>

      <div className="flex items-center justify-between gap-3">
        {createButton}
        <PeriodPicker value={period} onChange={setPeriod} label="Orders period" />
      </div>

      <div
        className={`grid grid-cols-3 gap-2 oak-motion-control ${
          isPlaceholderData && isFetching ? "opacity-50" : ""
        }`}
      >
        <Stat label="Posts" value={data.totals.published} />
        <Stat
          label="Link pieces"
          value={data.totals.linkedPosts}
          hint={data.totals.shown < data.totals.published ? `of latest ${data.totals.shown}` : undefined}
        />
        <Stat
          label="Orders after"
          value={data.totals.orders}
          hint={data.totals.orders ? formatKobo(data.totals.revenueKobo) : label}
        />
      </div>

      <ul
        className={`flex flex-col gap-3 oak-motion-control ${
          isPlaceholderData && isFetching ? "opacity-50" : ""
        }`}
      >
        {data.posts.map((p) => (
          <li key={p.id}>
            <PostRow post={p} periodText={label} onOpen={() => setViewing(p.id)} />
          </li>
        ))}
      </ul>

      {data.totals.shown < data.totals.published && (
        <p className="text-[12px] text-sd-ink-muted">
          Showing your latest {data.totals.shown} of {data.totals.published} posts.
        </p>
      )}
      <p className="text-[12px] leading-snug text-sd-ink-muted">
        &ldquo;Orders after&rdquo; counts paid orders that include a piece a post links, placed after
        the post went up. It&apos;s a signal, not proof the post made the sale, and one order can
        count toward more than one post. Only your own store&apos;s pieces are counted.
      </p>
      {data.truncated && <TruncatedNote />}

      {viewing && user && (
        <Suspense fallback={<div className="fixed inset-0 z-[70] bg-black" />}>
          <PostFeed
            scope={{ type: "user", userId: user.id, status: "published" }}
            initialPostId={viewing}
            onClose={closeViewer}
          />
        </Suspense>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      {children}
    </div>
  );
}

function PostCover({ post }: { post: ContentPost }) {
  // Same rule as the profile grid: a video's poster as a plain image when it
  // has one; only a poster-less video falls back to letting the browser paint
  // frame 0.
  const cls = "h-full w-full object-cover";
  if (post.mediaType === "video" && post.thumbnailUrl) {
    return <img src={post.thumbnailUrl} alt="" loading="lazy" className={cls} />;
  }
  if (post.mediaType === "video") {
    return (
      <video
        src={post.mediaUrl}
        muted
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        preload="metadata"
        className={cls}
      />
    );
  }
  return <img src={post.mediaUrl} alt="" loading="lazy" className={cls} />;
}

function PostRow({
  post: p,
  periodText,
  onOpen,
}: {
  post: ContentPost;
  periodText: string;
  onOpen: () => void;
}) {
  const a = p.attribution;
  // A live photo is stored as a video but isn't one; no play badge on it.
  const isClip = p.mediaType === "video" && p.createdWith !== "photo-editor";
  return (
    <div className="flex gap-3 rounded-2xl border border-sd-line bg-sd-surface p-3">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open post"
        className="relative aspect-[3/4] w-[84px] shrink-0 overflow-hidden rounded-xl bg-sd-soft oak-motion-control active:scale-[0.97]"
      >
        <PostCover post={p} />
        {isClip && (
          <span className="absolute right-1.5 top-1.5 drop-shadow">
            <Play size={12} className="fill-white text-white" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12px] text-sd-ink-muted">
          <span>{formatDate(p.createdAt)}</span>
          {VISIBILITY[p.visibility] && (
            <span className="rounded-full bg-sd-soft px-2 py-0.5 font-medium">
              {VISIBILITY[p.visibility]}
            </span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-sd-ink">
          {p.caption?.trim() || <span className="text-sd-ink-muted">No caption</span>}
        </p>

        {p.products.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.products.map((prod) => (
              <Link
                key={prod.id}
                to="/store/products/$id"
                params={{ id: prod.id }}
                className="oak-tap inline-flex h-10 max-w-full items-center gap-2 rounded-full border border-sd-line bg-sd-surface py-1 pl-1 pr-3 active:bg-sd-soft"
              >
                <Thumb src={prod.imageUrl} size={28} />
                <span className="min-w-0 truncate text-[12px] font-medium text-sd-ink">
                  {prod.title}
                </span>
                {prod.priceKobo !== null && (
                  <span className="shrink-0 text-[12px] text-sd-ink-muted">
                    {formatKobo(prod.priceKobo)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[12px] leading-snug text-sd-ink-muted">
            Links none of your pieces. Tag pieces when you post so viewers can buy from it.
          </p>
        )}

        {p.products.length > 0 && (
          <p
            className={`mt-2 text-[13px] ${a.orders ? "font-semibold text-sd-ink" : "text-sd-ink-muted"}`}
          >
            {a.orders
              ? `${a.orders === 1 ? "1 order" : `${a.orders} orders`} · ${a.units} ${
                  a.units === 1 ? "piece" : "pieces"
                } · ${formatKobo(a.revenueKobo)}`
              : `No orders of these pieces in the ${periodText}`}
          </p>
        )}
      </div>
    </div>
  );
}
