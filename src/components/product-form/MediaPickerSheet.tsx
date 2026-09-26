import { useEffect, useState } from "react";
import { Check, ChevronLeft, ImageIcon, Play } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

// Full-screen picker over the user's own posts — drafts or published — so they
// can reuse something they've already made instead of hunting down a URL.
//
// One component, two entry points. The drafts and posts sheets were separate
// files that differed by a status filter and two strings; keeping them apart
// meant every change (like accepting videos) had to be made twice, correctly,
// in both.
//
// `include` is what keeps that split honest: a product image genuinely cannot
// be a video, so the product form asks for photos only. The video editor asks
// for everything.

export type PickedMedia = {
  url: string;
  kind: "photo" | "video";
  /** The post's stored poster frame. Saves the caller decoding one itself,
   *  which for a remote video means a CORS-gated canvas read. */
  thumbnailUrl: string | null;
};

type Row = {
  id: string;
  media_url: string;
  thumbnail_url: string | null;
  media_type: string | null;
};

export function MediaPickerSheet({
  source,
  include = "photos",
  multiple = true,
  onSelect,
  onClose,
}: {
  source: "drafts" | "posts";
  include?: "photos" | "all";
  multiple?: boolean;
  onSelect: (media: PickedMedia[]) => void;
  onClose: () => void;
}) {
  const { user, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<PickedMedia[]>([]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setRows([]);
      return;
    }
    let cancelled = false;
    let query = supabase
      .from("posts")
      .select("id, media_url, thumbnail_url, media_type")
      .eq("user_id", user.id)
      .eq("status", source === "drafts" ? "draft" : "published");
    if (include === "photos") query = query.eq("media_type", "photo");

    query.order("created_at", { ascending: false }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error(`MediaPickerSheet: failed to load ${source}`, error);
      setRows(data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [user, sessionLoading, source, include]);

  function toggle(row: Row) {
    const item: PickedMedia = {
      url: row.media_url,
      kind: row.media_type === "video" ? "video" : "photo",
      thumbnailUrl: row.thumbnail_url,
    };
    setSelected((prev) => {
      if (prev.some((m) => m.url === item.url)) return prev.filter((m) => m.url !== item.url);
      if (!multiple) return [item];
      return [...prev, item];
    });
  }

  const title = source === "drafts" ? "Choose from drafts" : "Choose from posts";
  const emptyCopy =
    source === "drafts"
      ? include === "all"
        ? "No drafts yet. Save something as a draft first."
        : "No draft photos yet. Save or upload an image as a draft from the camera first."
      : include === "all"
        ? "No published posts yet."
        : "No published posts yet. Publish a photo post first.";

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-white">
      <div className="shrink-0 flex h-14 items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur">
        <button
          onClick={onClose}
          type="button"
          className="-ml-1 flex items-center gap-1 text-sm text-gray-500"
        >
          <ChevronLeft size={18} />
          Cancel
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold">
          {title}
        </span>
        <button
          onClick={() => onSelect(selected)}
          type="button"
          disabled={selected.length === 0}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Use {selected.length > 0 ? selected.length : ""}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rows === null ? (
          <p className="py-16 text-center text-sm text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <ImageIcon size={28} className="text-gray-300" />
            <p className="text-sm text-gray-400">{emptyCopy}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {rows.map((row) => {
              const isSelected = selected.some((m) => m.url === row.media_url);
              const isVideo = row.media_type === "video";
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => toggle(row)}
                  aria-label={isSelected ? "Deselect" : "Select"}
                  className="oak-motion-control relative aspect-square overflow-hidden bg-gray-100 active:scale-[0.97]"
                >
                  {isVideo && !row.thumbnail_url ? (
                    // A video post with no stored poster. Showing the element
                    // itself gets frame zero without a canvas read, which a
                    // remote file may not permit.
                    <video
                      src={row.media_url}
                      muted
                      playsInline
                      disablePictureInPicture
                      disableRemotePlayback
                      preload="metadata"
                      className={`h-full w-full object-cover ${isSelected ? "opacity-70" : ""}`}
                    />
                  ) : (
                    <img
                      src={row.thumbnail_url ?? row.media_url}
                      alt=""
                      className={`h-full w-full object-cover ${isSelected ? "opacity-70" : ""}`}
                    />
                  )}
                  {isVideo && (
                    <span className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/55">
                      <Play size={10} className="ml-[1px] text-white" fill="white" />
                    </span>
                  )}
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black">
                      <Check size={13} className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
