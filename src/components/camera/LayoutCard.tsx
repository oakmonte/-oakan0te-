import { Heart, Check } from "lucide-react";
import LayoutPreview from "./LayoutPreview";
import type { CameraLayout } from "./layout-data";

type LayoutCardProps = {
  layout: CameraLayout;
  selected: boolean;
  saved: boolean;
  onSelect: (id: string) => void;
  onToggleSave: (id: string) => void;
};

export default function LayoutCard({
  layout,
  selected,
  saved,
  onSelect,
  onToggleSave,
}: LayoutCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(layout.id)}
      className="oak-motion-control relative rounded-2xl overflow-hidden text-left"
      style={{
        border: selected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="w-full aspect-square bg-neutral-900 p-2">
        <LayoutPreview layout={layout} />
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
        <span className="text-sm font-medium truncate pr-2">{layout.name}</span>
        <span
          role="button"
          aria-label={saved ? "Remove from saved" : "Save this layout"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(layout.id);
          }}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
        </span>
      </div>
    </button>
  );
}
