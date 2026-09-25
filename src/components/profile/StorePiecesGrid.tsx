import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Tables } from "@/lib/integrations/my-supabase/types";

type StorePieceRow = Pick<Tables<"store_pieces">, "id" | "media_url" | "caption">;

async function fetchStorePieces(storeId: string): Promise<StorePieceRow[]> {
  const { data, error } = await supabase
    .from("store_pieces")
    .select("id, media_url, caption")
    .eq("store_id", storeId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("StorePiecesGrid: failed to load pieces", error);
    return [];
  }
  return data ?? [];
}

/** Renders a store profile's Wardrobe/Gallery tab: a 3-col grid of a store's
 *  non-sellable "pieces", backed by the `store_pieces` table (RLS decides
 *  what a non-owner viewer gets back; the explicit `.eq("status",
 *  "published")` above keeps the grid itself decisive regardless of who's
 *  asking -- there's no separate drafts view for pieces, so an owner's own
 *  drafts simply don't show here). Falls back to `emptyState` when there's
 *  nothing published yet. Tapping a tile opens a plain lightbox -- not
 *  PostFeed, whose swipeable-feed/video/product-tag machinery solves problems
 *  this content doesn't have. */
export function StorePiecesGrid({
  storeId,
  storeUsername,
  isOwnStoreProfile,
  emptyState,
}: {
  storeId: string;
  storeUsername: string;
  isOwnStoreProfile: boolean;
  emptyState: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const closeViewer = useCallback(() => setActiveId(null), []);
  useOverlayHistory(activeId !== null, closeViewer);

  const { data: pieces, isPending } = useQuery({
    queryKey: ["store-pieces", storeId] as const,
    queryFn: () => fetchStorePieces(storeId),
    staleTime: 30_000,
  });

  const addPiece = () =>
    navigate({ to: "/create/store-piece", search: { storeId, storeUsername } });

  if (isPending) {
    return (
      <div className="grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-white/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!pieces || pieces.length === 0) return <>{emptyState}</>;

  const active = pieces.find((p) => p.id === activeId) ?? null;

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5">
        {/* Leading "+" tile rather than only offering Add from the empty
            state, so there's always an add affordance once the grid already
            has pieces in it. */}
        {isOwnStoreProfile && (
          <button
            type="button"
            onClick={addPiece}
            aria-label="Add a piece"
            className="oak-motion-control aspect-square flex items-center justify-center bg-white/[0.06] active:scale-[0.97]"
          >
            <Plus size={22} className="text-white/60" />
          </button>
        )}
        {pieces.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveId(p.id)}
            aria-label="Open piece"
            className="oak-motion-control relative aspect-square bg-neutral-900 overflow-hidden active:scale-[0.97]"
          >
            <img src={p.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={closeViewer}
              aria-label="Close"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4">
            <img src={active.media_url} alt="" className="max-w-full max-h-full object-contain" />
          </div>
          {active.caption && (
            <p className="px-6 pb-8 pt-2 text-sm text-white/80 text-center">{active.caption}</p>
          )}
        </div>
      )}
    </>
  );
}

/** Not a branch of ProfileTabEmptyState -- that component is shared with the
 *  personal profile, where Wardrobe genuinely has no backing feature yet.
 *  Coupling a store-specific CTA into its generic per-tab copy lookup risks
 *  exactly the drift that file's own header comment is trying to prevent for
 *  the tab bar, with no equivalent shared contract for empty-state behavior
 *  to justify it. The non-Artist subtitle below intentionally matches
 *  ProfileTabEmptyState's existing `wardrobe` copy verbatim. */
export function StorePiecesEmptyState({
  isArtist,
  isOwnStoreProfile,
  storeId,
  storeUsername,
}: {
  isArtist: boolean;
  isOwnStoreProfile: boolean;
  storeId: string;
  storeUsername: string;
}) {
  const navigate = useNavigate();

  if (!isOwnStoreProfile) {
    return (
      <div className="flex flex-col items-center text-center px-8 pt-16">
        <h3 className="text-[16px] font-bold text-white/70">
          {isArtist ? "No gallery yet" : "No wardrobe yet"}
        </h3>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center px-8 pt-16 gap-1.5">
      <h3 className="text-[16px] font-bold">
        {isArtist ? "Build your gallery" : "Build your wardrobe"}
      </h3>
      <p className="text-[13px] text-white/50 max-w-[220px]">
        {isArtist
          ? "Share pieces that aren't for sale — work you want people to see."
          : "Pieces you own or want to show off and get recommendations for live here."}
      </p>
      <button
        type="button"
        onClick={() => navigate({ to: "/create/store-piece", search: { storeId, storeUsername } })}
        className="mt-3 rounded-full bg-white text-black py-2.5 px-6 text-[14px] font-semibold"
      >
        Add piece
      </button>
    </div>
  );
}
