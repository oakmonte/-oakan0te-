import { useEffect, useState } from "react";
import { Check, ImageIcon, Play, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

// Product-side counterpart to LinkProductsSheet.tsx (the post-side "link
// products" sheet) — both write to post_product_tags, so a link made here
// shows up immediately over there (the post reads as already tagged with
// this product) and vice versa. Posts and drafts are shown as two separate
// sections rather than one mixed list, on purpose — they're different
// things to a seller (one's live, one isn't) and mixing them reads as one
// undifferentiated pile.
type Row = {
  id: string;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  media_type: string | null;
};

export function LinkContentSheet({
  linkedIds,
  onChange,
  onClose,
}: {
  linkedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { user, loading: sessionLoading } = useSession();
  const [posts, setPosts] = useState<Row[] | null>(null);
  const [drafts, setDrafts] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(linkedIds));

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setPosts([]);
      setDrafts([]);
      return;
    }
    let cancelled = false;
    const base = supabase
      .from("posts")
      .select("id, caption, media_url, thumbnail_url, media_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    base.eq("status", "published").then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error("LinkContentSheet: failed to load posts", error);
      setPosts(data ?? []);
    });

    supabase
      .from("posts")
      .select("id, caption, media_url, thumbnail_url, media_type")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("LinkContentSheet: failed to load drafts", error);
        setDrafts(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [user, sessionLoading]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange([...next]);
      return next;
    });
  }

  const loading = sessionLoading || posts === null || drafts === null;
  const hasNothing = !loading && (posts?.length ?? 0) === 0 && (drafts?.length ?? 0) === 0;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Link content
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <p className="py-16 text-center text-sm text-gray-400">Loading…</p>
        ) : hasNothing ? (
          // Nothing to link to yet — the seller can just leave, not get
          // funneled into making a post from inside the product form.
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <ImageIcon size={28} className="text-gray-300" />
            <p className="text-sm text-gray-400">
              No posts or drafts yet. Make one first, then come back to link it here.
            </p>
          </div>
        ) : (
          <>
            <ContentSection
              label="Posts"
              rows={posts ?? []}
              selected={selected}
              onToggle={toggle}
              emptyCopy="No published posts yet."
            />
            <ContentSection
              label="Drafts"
              rows={drafts ?? []}
              selected={selected}
              onToggle={toggle}
              emptyCopy="No drafts yet."
            />
          </>
        )}
      </div>
    </div>
  );
}

function ContentSection({
  label,
  rows,
  selected,
  onToggle,
  emptyCopy,
}: {
  label: string;
  rows: Row[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyCopy: string;
}) {
  return (
    <div className="border-b-8 border-gray-50">
      <p className="px-4 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">{emptyCopy}</p>
      ) : (
        <div className="pb-2">
          {rows.map((row) => {
            const isSelected = selected.has(row.id);
            const isVideo = row.media_type === "video";
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onToggle(row.id)}
                aria-pressed={isSelected}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
              >
                <span className="relative w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={row.thumbnail_url ?? row.media_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {isVideo && (
                    <span className="absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/55">
                      <Play size={8} className="ml-px text-white" fill="white" />
                    </span>
                  )}
                </span>
                <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">
                  {row.caption?.trim() || "Untitled post"}
                </span>
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors duration-200 ${
                    isSelected ? "bg-black border-black" : "border-gray-300"
                  }`}
                >
                  {isSelected && <Check size={12} className="text-white oak-motion-pop" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
