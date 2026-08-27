import { useEffect, useState } from "react";
import { Check, ChevronLeft, ImageIcon } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

type DraftPhoto = { id: string; media_url: string; thumbnail_url: string | null };

/** Full-screen picker over the seller's own draft posts (photos only — a
 *  product image can't be a video) so they can reuse a shot they've already
 *  captured instead of hunting down a URL to paste. `multiple` controls
 *  whether more than one tile can be selected before confirming. */
export function DraftImagePickerSheet({
  multiple = true,
  onSelect,
  onClose,
}: {
  multiple?: boolean;
  onSelect: (urls: string[]) => void;
  onClose: () => void;
}) {
  const { user, loading: sessionLoading } = useSession();
  const [photos, setPhotos] = useState<DraftPhoto[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setPhotos([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("posts")
      .select("id, media_url, thumbnail_url")
      .eq("user_id", user.id)
      .eq("status", "draft")
      .eq("media_type", "photo")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("DraftImagePickerSheet: failed to load drafts", error);
        setPhotos(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [user, sessionLoading]);

  function toggle(url: string) {
    setSelected((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (!multiple) return [url];
      return [...prev, url];
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={onClose}
          type="button"
          className="flex items-center gap-1 text-sm text-gray-500 -ml-1"
        >
          <ChevronLeft size={18} />
          Cancel
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Choose from drafts
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
        {photos === null ? (
          <p className="text-center text-sm text-gray-400 py-16">Loading…</p>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 px-6 text-center">
            <ImageIcon size={28} className="text-gray-300" />
            <p className="text-sm text-gray-400">
              No draft photos yet. Save a shot as a draft from the camera first.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {photos.map((p) => {
              const isSelected = selected.includes(p.media_url);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.media_url)}
                  aria-label={isSelected ? "Deselect photo" : "Select photo"}
                  className="oak-motion-control relative aspect-square bg-gray-100 overflow-hidden active:scale-[0.97]"
                >
                  <img
                    src={p.thumbnail_url ?? p.media_url}
                    alt=""
                    className={`w-full h-full object-cover ${isSelected ? "opacity-70" : ""}`}
                  />
                  {isSelected && (
                    <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black flex items-center justify-center">
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
