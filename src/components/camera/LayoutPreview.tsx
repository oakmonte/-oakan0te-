import type { CameraLayout, LayoutCell } from "./layout-data";

type LayoutPreviewProps = {
  layout: CameraLayout;

  /** Gap between cells, in px. Default matches FilterPanel's card spacing. */
  gap?: number;

  /** Optional: render actual content inside a cell (e.g. a captured frame).
   *  Defaults to an empty placeholder rect — used by pickers/thumbnails. */
  renderCell?: (cell: LayoutCell, index: number) => React.ReactNode;

  /** Highlights one cell — for a future live multi-shot capture flow to
   *  indicate which cell is currently being filled. No-op until then. */
  activeCellIndex?: number;

  className?: string;
};

export default function LayoutPreview({
  layout,
  gap = 2,
  renderCell,
  activeCellIndex,
  className,
}: LayoutPreviewProps) {
  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      {layout.cells.map((cell, i) => {
        const isActive = i === activeCellIndex;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(${cell.x * 100}% + ${gap / 2}px)`,
              top: `calc(${cell.y * 100}% + ${gap / 2}px)`,
              width: `calc(${cell.w * 100}% - ${gap}px)`,
              height: `calc(${cell.h * 100}% - ${gap}px)`,
              overflow: "hidden",
              borderRadius: 4,
              background: "rgba(255,255,255,0.12)",
              border: isActive
                ? "2px solid #fff"
                : "1px solid rgba(255,255,255,0.18)",
              boxSizing: "border-box",
            }}
          >
            {renderCell?.(cell, i)}
          </div>
        );
      })}
    </div>
  );
}