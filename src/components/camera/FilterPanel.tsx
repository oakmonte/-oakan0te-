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
  style: "Style",
  portrait: "Portrait",
  mood: "Mood",
  night: "Night",
  food: "Food",
  pet: "Pet",
  pro: "Pro",
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
function FilterThumb({ filter, active }: { filter: CameraFilter; active?: boolean }) {
  const thumb = useFilterThumbnail(filter);
  const size = active ? 72 : 56;
  const margin = active ? 16 : 8;
  const scale = active ? 1.1 : 1;
  
  return (
    <div className="relative flex-shrink-0" style={{ margin: `${margin}px` }}>
      <div
        className="w-[56px] h-[56px] overflow-hidden bg-cover bg-center transition-all duration-200"
        style={{
          backgroundColor: filter.thumbnailColor,
          backgroundImage: thumb ? `url(${thumb})` : undefined,
          transform: `scale(${scale})`,
          opacity: active ? 1 : 0.8,
          border: active ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
          borderRadius: "14px",
          boxShadow: active
            ? "0 4px 12px rgba(0,0,0,0.3)"
            : "0 2px 8px rgba(0,0,0,0.2)",
        }}
      >
        {active && (
          <div
            className="absolute top-2 right-2 flex items-center justify-center"
            style={{ width: 24, height: 24, background: "rgba(0,0,0,0.5)", borderRadius: "50%" }}
          >
            <Check size={16} strokeWidth={2} color="#fff" />
          </div>
        )}
      </div>
      <div className="mt-1 text-xs text-center text-white/80">{filter.name}</div>
    </div>
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string>(selectedId);
  
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
    setActiveFilterId(selectedId);
    setCategory(favoriteIds.size > 0 ? "favorites" : "style");
    // Scroll to active filter
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector(
        `[data-filter-id="${selectedId}"]`
      ) as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId]);

  const activeId = preview?.id ?? activeFilterId;
  const activeIntensity = preview?.intensity ?? intensity;
  const activeFilter = CAMERA_FILTERS.find((f) => f.id === activeId);

  const getVisibleFilters = (cat: FilterCategory) => {
    return cat === "favorites"
      ? CAMERA_FILTERS.filter((f) => favoriteIds.has(f.id))
      : CAMERA_FILTERS.filter((f) => f.category === cat);
  };

  const handleFilterSelect = (filter: CameraFilter) => {
    setActiveFilterId(filter.id);
    const next = { id: filter.id, intensity: filter.intensity };
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
      {/* Category Tabs */}
      <div
        className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4"
        style={{ scrollbarWidth: "none" }}
      >
        {FILTER_CATEGORIES.map((cat) => {
          const selected = cat === category;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategory(cat);
                // Only change which filters are displayed — do NOT auto-select
                // the first filter in the category. Auto-selecting called
                // onPreview which replaced whatever the user had already picked,
                // so merely browsing categories looked like filters weren't
                // sticking or were being overridden.
              }}
              className="shrink-0 rounded-full transition-all duration-200"
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: selected ? "rgba(255,255,255,0.2)" : "transparent",
                color: selected ? "#fff" : "#fff8",
                border: selected ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* Horizontal Filter Carousel */}
      <div
        className="relative"
        ref={scrollRef}
        style={{
          padding: "0 16px",
          overflowX: "hidden",
          touchAction: "pan-y",
          ["-webkit-overflow-scrolling"]: "touch",
        }}
      >
        <div
          className="flex gap-4 overflow-x-auto pb-6"
          style={{ scrollbarWidth: "none", margin: "-8px 0" }}
        >
          {getVisibleFilters(category).length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm opacity-50 text-center">
              {category === "favorites"
                ? "Tap the heart on any filter to pin it here."
                : "No filters in this category yet."}
            </div>
          ) : (
            <>
              {getVisibleFilters(category).map((f) => {
                const selected = f.id === activeId;
                const favorited = favoriteIds.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    data-filter-id={f.id}
                    onClick={() => handleFilterSelect(f)}
                    className="relative"
                  >
                    <FilterThumb filter={f} active={selected} />
                    
                    {/* Favorite heart badge */}
                    {favorited && (
                      <div
                        className="absolute top-2 right-2 flex items-center justify-center"
                        style={{ width: 20, height: 20, background: "#ff3b30", borderRadius: "50%" }}
                      >
                        <Heart size={12} strokeWidth={1.5} color="#fff" />
                      </div>
                    )}
                  </button>
                );
              })}
              <div className="w-16" /> {/* Spacer for end */}
            </>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div
        className="sticky bottom-0 left-0 right-0 -mx-4 px-4 pt-2 pb-4"
        style={{ background: "linear-gradient(to top, #111 60%, rgba(17,17,17,0))" }}
      >
        {activeId !== "natural" && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
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
              className="w-full"
            />
          </div>
        )}

        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-white/60 hover:text-white/80 transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center justify-center gap-2 rounded-full font-bold text-sm uppercase tracking-wide py-2 px-4 active:scale-[0.98]"
            style={{ background: "#fff", color: "#000" }}
          >
            Apply
          </button>
        </div>
      </div>
    </CameraPanel>
  );
}
