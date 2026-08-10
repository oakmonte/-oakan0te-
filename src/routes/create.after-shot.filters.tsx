import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { X, Check } from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import FilterPanel from "@/components/camera/FilterPanel";
import { CAMERA_FILTERS } from "@/components/camera/filter-data";
import { applyFilterToPhotoBlob, applyFilterToVideoBlob } from "@/lib/filter-media";

export const Route = createFileRoute("/create/after-shot/filters")({
  head: () => ({ meta: [{ title: "Filters — Oakmonte" }] }),
  component: FiltersPage,
});

const DEFAULT_FILTER_ID = "natural";

function FiltersPage() {
  const navigate = useNavigate();
  const { media, setMedia } = useAfterShotContext();

  // A second, independent filter pass on top of whatever was already baked
  // in at capture time — favorites here are local to this page, not shared
  // with the camera page's own favorited-filters state. Worth unifying
  // later (localStorage or a shared store) if favoriting should carry
  // across both screens.
  const [selectedFilterId, setSelectedFilterId] = useState(DEFAULT_FILTER_ID);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const activeFilter = CAMERA_FILTERS.find((f) => f.id === selectedFilterId) ?? CAMERA_FILTERS[0];

  const toggleFavorite = useCallback((id: string) => {
    setFavoritedFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (selectedFilterId === DEFAULT_FILTER_ID) {
      // Natural is a no-op — skip the re-encode entirely.
      navigate({ to: "/create/after-shot" });
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const filteredBlob =
        media.type === "photo"
          ? await applyFilterToPhotoBlob(media.blob, activeFilter.css)
          : await applyFilterToVideoBlob(media.blob, activeFilter.css, setProgress);
      const url = URL.createObjectURL(filteredBlob);
      setMedia(
        media.type === "photo"
          ? { type: "photo", blob: filteredBlob, url }
          : { type: "video", blob: filteredBlob, url },
      );
      navigate({ to: "/create/after-shot" });
    } catch (err) {
      console.error("Filter apply failed:", err);
      setBusy(false);
    }
  }, [selectedFilterId, activeFilter.css, media, setMedia, navigate]);

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-20">
        <button
          onClick={() => navigate({ to: "/create/after-shot" })}
          aria-label="Cancel filter"
          disabled={busy}
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          <X size={20} />
        </button>
        <button
          onClick={handleConfirm}
          aria-label="Confirm filter"
          disabled={busy}
          className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 transition-transform duration-150 active:scale-90"
          style={{ background: "#fff", color: "#000" }}
        >
          <Check size={20} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-5">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ maxHeight: "100%", aspectRatio: "9/16", width: "auto", height: "100%" }}
        >
          {media.type === "photo" ? (
            <img
              src={media.url}
              alt="Captured"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: activeFilter.css }}
            />
          ) : (
            <video
              src={media.url}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: activeFilter.css }}
            />
          )}

          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
              <span className="text-sm uppercase tracking-widest">
                {media.type === "video" ? `Applying… ${Math.round(progress * 100)}%` : "Applying…"}
              </span>
            </div>
          )}
        </div>
      </div>

      <FilterPanel
        open
        selectedId={selectedFilterId}
        favoriteIds={favoritedFilterIds}
        onClose={() => navigate({ to: "/create/after-shot" })}
        onPreview={setSelectedFilterId}
        onApply={setSelectedFilterId}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}