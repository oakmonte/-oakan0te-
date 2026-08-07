import { useState, useEffect } from "react";
import CameraPanel from "./CameraPanel";
import LayoutCard from "./LayoutCard";
import { CAMERA_LAYOUTS, LAYOUT_CATEGORIES, type LayoutCategory } from "./layout-data";

type LayoutPanelProps = {
  open: boolean;
  value: string;
  savedIds: Set<string>;
  onClose: () => void;
  onChange: (id: string) => void;
  onToggleSave: (id: string) => void;
};

const CATEGORY_LABELS: Record<LayoutCategory, string> = {
  featured: "Featured",
  fashion: "Fashion",
  classic: "Classic",
  magazine: "Magazine",
  saved: "❤ Saved",
};

const PANEL_HEIGHT = 600;

export default function LayoutPanel({
  open,
  value,
  savedIds,
  onClose,
  onChange,
  onToggleSave,
}: LayoutPanelProps) {
  const [category, setCategory] = useState<LayoutCategory>("featured");

  useEffect(() => {
    if (open) setCategory("featured");
  }, [open]);

  const visibleLayouts =
    category === "featured"
      ? CAMERA_LAYOUTS.filter((l) => l.featured)
      : category === "saved"
        ? CAMERA_LAYOUTS.filter((l) => savedIds.has(l.id))
        : CAMERA_LAYOUTS.filter((l) => l.category === category);

  const handleSelect = (id: string) => {
    onChange(id);
    onClose();
  };

  return (
    <CameraPanel open={open} onClose={onClose} title="Layout" height={PANEL_HEIGHT}>
      <div
        className="flex gap-2 overflow-x-auto pb-4 -mx-6 px-6"
        style={{ scrollbarWidth: "none" }}
      >
        {LAYOUT_CATEGORIES.map((cat) => {
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

      {visibleLayouts.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm opacity-50 text-center px-6">
          {category === "saved"
            ? "Tap the heart on any layout to save it here."
            : "No layouts in this category yet."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-6">
          {visibleLayouts.map((layout) => (
            <LayoutCard
              key={layout.id}
              layout={layout}
              selected={layout.id === value}
              saved={savedIds.has(layout.id)}
              onSelect={handleSelect}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
    </CameraPanel>
  );
}