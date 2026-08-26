import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Play, X, MapPin } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Tables } from "@/lib/integrations/my-supabase/types";

type PostRow = Pick<
  Tables<"posts">,
  "id" | "media_url" | "media_type" | "thumbnail_url" | "caption" | "location"
>;

type TaggedProduct = { id: string; title: string; price: number | null; image: string | null };

/** Renders a profile's Posts or Drafts tab: a 3-col grid of a user's real
 *  posts, backed by the `posts` table (RLS decides what a non-owner viewer
 *  gets back — this component doesn't re-filter by visibility itself). Falls
 *  back to `emptyState` (the existing per-tab copy) when there's nothing. */
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
  const [active, setActive] = useState<PostRow | null>(null);

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
            onClick={() => setActive(p)}
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
              <img src={p.media_url} alt="" className="w-full h-full object-cover" />
            )}
            {p.media_type === "video" && (
              <span className="absolute top-1.5 right-1.5 drop-shadow">
                <Play size={13} className="fill-white text-white" />
              </span>
            )}
          </button>
        ))}
      </div>

      <PostViewer post={active} onClose={() => setActive(null)} />
    </>
  );
}

function PostViewer({ post, onClose }: { post: PostRow | null; onClose: () => void }) {
  const [tags, setTags] = useState<TaggedProduct[]>([]);

  useEffect(() => {
    if (!post) {
      setTags([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("post_product_tags")
      .select("products(id, title, product_variants(price, main_image_url))")
      .eq("post_id", post.id)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setTags(
          data
            .map((row) => row.products)
            .filter((p): p is NonNullable<typeof p> => p !== null)
            .map((p) => ({
              id: p.id,
              title: p.title ?? "Untitled",
              price: p.product_variants[0]?.price ?? null,
              image: p.product_variants[0]?.main_image_url ?? null,
            })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [post]);

  if (!post) return null;

  return (
    <div className="oak-motion-fade fixed inset-0 z-[60] bg-black flex flex-col">
      <button
        onClick={onClose}
        aria-label="Close"
        className="oak-motion-control absolute z-10 flex items-center justify-center w-9 h-9 rounded-full active:scale-90"
        style={{
          top: "calc(env(safe-area-inset-top) + 12px)",
          right: 16,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(10px)",
        }}
      >
        <X size={18} className="text-white" />
      </button>

      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {post.media_type === "photo" ? (
          <img src={post.media_url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <video
            src={post.media_url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {(post.caption || post.location || tags.length > 0) && (
        <div
          className="px-5 pt-3 text-white"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
        >
          {post.caption && <p className="text-[14px] mb-1.5">{post.caption}</p>}
          {post.location && (
            <p className="text-[12px] text-white/50 flex items-center gap-1">
              <MapPin size={12} /> {post.location}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pt-3" style={{ scrollbarWidth: "none" }}>
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
      )}
    </div>
  );
}
