import { useState, useEffect, useRef } from "react";
import { Heart, Check } from "lucide-react";
import CameraPanel from "./CameraPanel";
import { CAMERA_FILTERS, FILTER_CATEGORIES, type FilterCategory } from "./filter-data";
import heroEditorial from "@/assets/hero-editorial.jpg";

type FilterPanelProps = {
  open: boolean;
  selectedId: string;
  favoriteIds: Set<string>;
  onClose: () => void;
  onPreview: (id: string) => void;
  onApply: (id: string) => void;
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

export default function FilterPanel({
  open,
  selectedId,
  favoriteIds,
  onClose,
  onPreview,
  onApply,
  onToggleFavorite,
}: FilterPanelProps) {
  const [category, setCategory] = useState<FilterCategory>("favorites");
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Snapshot the committed filter on open, so closing without Apply
  // (backdrop tap, swipe-down) can revert the live preview cleanly.
  const committedOnOpenRef = useRef(selectedId);

  useEffect(() => {
    if (!open) return;
    committedOnOpenRef.current = selectedId;
    setPreviewId(null);
    setCategory(favoriteIds.size > 0 ? "favorites" : "portrait");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeId = previewId ?? selectedId;

  const visibleFilters =
    category === "favorites"
      ? CAMERA_FILTERS.filter((f) => favoriteIds.has(f.id))
      : CAMERA_FILTERS.filter((f) => f.category === category);

  const handlePick = (id: string) => {
    setPreviewId(id);
    onPreview(id);
  };

  const handleDiscardAndClose = () => {
    if (previewId !== null && previewId !== committedOnOpenRef.current) {
      onPreview(committedOnOpenRef.current);
    }
    onClose();
  };

  const handleApply = () => {
    onApply(activeId);
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
        <div className="grid grid-cols-2 gap-3 pb-24">
          {visibleFilters.map((f) => {
            const selected = f.id === activeId;
            const favorited = favoriteIds.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handlePick(f.id)}
                className="oak-motion-control relative rounded-2xl overflow-hidden text-left"
                style={{
                  border: selected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div className="w-full aspect-square overflow-hidden bg-neutral-800">
                  <img
                    src={heroEditorial}
                    alt={f.name}
                    className="w-full h-full object-cover"
                    style={{ filter: f.css }}
                  />
                </div>

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
        className="sticky bottom-0 left-0 right-0 -mx-6 px-6 pt-4 pb-2"
        style={{ background: "linear-gradient(to top, #111 60%, rgba(17,17,17,0))" }}
      >
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
