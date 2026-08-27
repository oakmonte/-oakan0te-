import { useState, useEffect, useRef } from "react";
import { Heart, Check } from "lucide-react";
import CameraPanel from "./CameraPanel";
import {
  CAMERA_FILTERS,
  FILTER_CATEGORIES,
  type FilterCategory,
  type CameraFilter,
} from "./filter-data";
import { useFilterThumbnail } from "@/lib/filter-thumbnail";

type FilterPanelProps = {
  open: boolean;
  selectedId: string;
  /** Committed intensity (0..100) for selectedId. Defaults to the filter's
   *  own default the moment a new filter is picked — this is only for
   *  resuming a previously-dialed-in value when reopening the panel. */
  intensity: number;
  favoriteIds: Set<string>;
  onClose: () => void;
  onPreview: (id: string, intensity: number) => void;
  onApply: (id: string, intensity: number) => void;
  onToggleFavorite: (id: string) => void;
};

const CATEGORY_LABELS: Record<FilterCategory, string> = {
  favorites: "★ Favorites",
  portrait: "Portrait",
  fashion: "Fashion",
  film: "Film",
  vintage: "Vintage",
  bw: "B&W",
  lifestyle: "Lifestyle",
  creative: "Creative",
};

const PANEL_HEIGHT = 640;

/** A real baked preview of the filter's actual grade, not a CSS-filtered
 *  static image — see filter-thumbnail.ts. Shows the swatch color as a
 *  skeleton until the bake resolves. Always shown at the filter's own
 *  default intensity — this is for browsing/picking, not a live readout of
 *  the intensity slider below. */
function FilterThumb({ filter }: { filter: CameraFilter }) {
  const thumb = useFilterThumbnail(filter);
  return (
    <div
      className="w-full aspect-square overflow-hidden bg-cover bg-center transition-opacity duration-200"
      style={{
        backgroundColor: filter.thumbnailColor,
        backgroundImage: thumb ? `url(${thumb})` : undefined,
      }}
    />
  );
}

export default function FilterPanel({
  open,
  selectedId,
  intensity,
  favoriteIds,
  onClose,
  onPreview,
  onApply,
  onToggleFavorite,
}: FilterPanelProps) {
  const [category, setCategory] = useState<FilterCategory>("favorites");
  // null means "no local override" — activeId/activeIntensity fall back to
  // the committed props, exactly like previewId already did before
  // intensity existed.
  const [preview, setPreview] = useState<{ id: string; intensity: number } | null>(null);

  // Snapshot the committed filter+intensity on open, so closing without
  // Apply (backdrop tap, swipe-down) can revert the live preview cleanly.
  const committedOnOpenRef = useRef({ id: selectedId, intensity });

  useEffect(() => {
    if (!open) return;
    committedOnOpenRef.current = { id: selectedId, intensity };
    setPreview(null);
    setCategory(favoriteIds.size > 0 ? "favorites" : "portrait");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeId = preview?.id ?? selectedId;
  const activeIntensity = preview?.intensity ?? intensity;
  const activeFilter = CAMERA_FILTERS.find((f) => f.id === activeId);

  const visibleFilters =
    category === "favorites"
      ? CAMERA_FILTERS.filter((f) => favoriteIds.has(f.id))
      : CAMERA_FILTERS.filter((f) => f.category === category);

  const handlePick = (f: CameraFilter) => {
    const next = { id: f.id, intensity: f.intensity };
    setPreview(next);
    onPreview(next.id, next.intensity);
  };

  const handleIntensityDrag = (value: number) => {
    const next = { id: activeId, intensity: value };
    setPreview(next);
    onPreview(next.id, next.intensity);
  };

  const handleDiscardAndClose = () => {
    const committed = committedOnOpenRef.current;
    if (preview && (preview.id !== committed.id || preview.intensity !== committed.intensity)) {
      onPreview(committed.id, committed.intensity);
    }
    onClose();
  };

  const handleApply = () => {
    onApply(activeId, activeIntensity);
    onClose();
  };

  return (
    <CameraPanel open={open} onClose={handleDiscardAndClose} title="Filters" height={PANEL_HEIGHT}>
      <div
        className="flex gap-2 overflow-x-auto pb-4 -mx-6 px-6"
        style={{ scrollbarWidth: "none" }}
      >
        {FILTER_CATEGORIES.map((cat) => {
          const selected = cat === category;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className="shrink-0 rounded-full transition-all duration-200"
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                background: selected ? "#fff" : "rgba(255,255,255,0.08)",
                color: selected ? "#000" : "#fff",
                border: selected ? "1px solid transparent" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {visibleFilters.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm opacity-50 text-center px-6">
          {category === "favorites"
            ? "Tap the heart on any filter to pin it here."
            : "No filters in this category yet."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-4">
          {visibleFilters.map((f) => {
            const selected = f.id === activeId;
            const favorited = favoriteIds.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handlePick(f)}
                className="oak-motion-control relative rounded-2xl overflow-hidden text-left"
                style={{
                  border: selected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <FilterThumb filter={f} />

                {selected && (
                  <span
                    className="oak-motion-pop absolute top-2 right-2 flex items-center justify-center rounded-full"
                    style={{ width: 22, height: 22, background: "#fff", color: "#000" }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}

                <div
                  className="flex items-center justify-between px-3 py-2.5"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  <span className="text-sm font-medium truncate pr-2">{f.name}</span>
                  <span
                    role="button"
                    aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(f.id);
                    }}
                  >
                    <Heart size={16} fill={favorited ? "currentColor" : "none"} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div
        className="sticky bottom-0 left-0 right-0 -mx-6 px-6 pt-3 pb-2"
        style={{ background: "linear-gradient(to top, #111 65%, rgba(17,17,17,0))" }}
      >
        {activeId !== "natural" && (
          <div className="pb-3">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                Intensity
              </span>
              <span className="text-xs font-semibold tabular-nums">
                {Math.round(activeIntensity)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={activeIntensity}
              onChange={(e) => handleIntensityDrag(Number(e.target.value))}
              aria-label={`${activeFilter?.name ?? "Filter"} intensity`}
              className="oak-intensity-slider w-full"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleApply}
          className="oak-motion-control w-full rounded-full font-bold text-sm uppercase tracking-wide py-3.5 active:scale-[0.98]"
          style={{ background: "#fff", color: "#000" }}
        >
          Apply Filter
        </button>
      </div>
    </CameraPanel>
  );
}
