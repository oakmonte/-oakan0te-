//currentdrawpanel
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X, Check, Undo2 } from "lucide-react";
import { useAfterShotLayers, type DrawStroke, type DrawLayer } from "@/lib/after-shot-layers";

const COLORS = ["#ffffff", "#000000", "#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#af52de"];
const BRUSH_WIDTHS = [
  { id: "thin", label: "Thin", value: 0.006 },
  { id: "medium", label: "Medium", value: 0.014 },
  { id: "thick", label: "Thick", value: 0.028 },
];

type DrawPanelProps = {
  open: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

export default function DrawPanel({ open, containerRef, onClose }: DrawPanelProps) {
  const { addLayer } = useAfterShotLayers();

  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedWidthId, setSelectedWidthId] = useState(BRUSH_WIDTHS[1].id);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<DrawStroke | null>(null);
  const isDrawingRef = useRef(false);

  const activeWidth = BRUSH_WIDTHS.find((w) => w.id === selectedWidthId) ?? BRUSH_WIDTHS[1];

  // Reads position off containerRef — the parent's own media box — same as
  // CropPanel does for its drag math, instead of measuring a box this
  // component renders itself.
  const pointFromEvent = useCallback(
    (e: ReactPointerEvent): [number, number] | null => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
    },
    [containerRef],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const point = pointFromEvent(e);
      if (!point) return;
      isDrawingRef.current = true;
      setActiveStroke({ points: [point], color: selectedColor, width: activeWidth.value });
    },
    [pointFromEvent, selectedColor, activeWidth.value],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!isDrawingRef.current) return;
      const point = pointFromEvent(e);
      if (!point) return;
      setActiveStroke((prev) => (prev ? { ...prev, points: [...prev.points, point] } : prev));
    },
    [pointFromEvent],
  );

  const commitActiveStroke = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setActiveStroke((prev) => {
      if (prev && prev.points.length >= 2) {
        setStrokes((s) => [...s, prev]);
      }
      return null;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const buildLayerFromStrokes = useCallback((allStrokes: DrawStroke[]): DrawLayer | null => {
    if (allStrokes.length === 0) return null;
    const allPoints = allStrokes.flatMap((s) => s.points);
    const xs = allPoints.map((p) => p[0]);
    const ys = allPoints.map((p) => p[1]);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

    const localStrokes: DrawStroke[] = allStrokes.map((s) => ({
      ...s,
      points: s.points.map(([x, y]) => [x - centerX, y - centerY] as [number, number]),
    }));

    return {
      id: `draw-${Date.now()}`,
      kind: "draw",
      x: centerX,
      y: centerY,
      scale: 1,
      rotation: 0,
      zIndex: 0,
      strokes: localStrokes,
    };
  }, []);

  const reset = useCallback(() => {
    setStrokes([]);
    setActiveStroke(null);
    isDrawingRef.current = false;
  }, []);

  const handleCancel = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleConfirm = useCallback(() => {
    const layer = buildLayerFromStrokes(strokes);
    if (layer) addLayer(layer);
    reset();
    onClose();
  }, [strokes, buildLayerFromStrokes, addLayer, reset, onClose]);

  const renderedStrokes = activeStroke ? [...strokes, activeStroke] : strokes;

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          onClick={handleCancel}
          aria-label="Cancel draw"
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          <X size={20} color="#fff" />
        </button>

        <button
          onClick={handleUndo}
          aria-label="Undo last stroke"
          disabled={strokes.length === 0}
          className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          <Undo2 size={18} color="#fff" />
        </button>

        <button
          onClick={handleConfirm}
          aria-label="Confirm drawing"
          disabled={strokes.length === 0}
          className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 transition-transform duration-150 active:scale-90"
          style={{ background: "#fff", color: "#000" }}
        >
          <Check size={20} />
        </button>
      </div>

      {/* Pointer capture surface sits directly over the parent's mounted
          media (via containerRef's box) — this div is transparent, not a
          second rendered photo/video. The SVG strokes overlay draws on top
          of whatever's already visually there underneath. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitActiveStroke}
        onPointerLeave={commitActiveStroke}
        className="relative flex-1 min-h-0"
        style={{ touchAction: "none" }}
      >
        <svg
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {renderedStrokes.map((stroke, i) => (
            <polyline
              key={i}
              points={stroke.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      <div className="px-5 z-30" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
        <div className="flex items-center gap-3 overflow-x-auto">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              aria-label={`Color ${color}`}
              className="shrink-0 rounded-full"
              style={{
                width: 28,
                height: 28,
                background: color,
                border: selectedColor === color ? "2px solid #fff" : "1px solid rgba(255,255,255,0.3)",
                outline: selectedColor === color ? "2px solid rgba(255,255,255,0.4)" : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-4">
          {BRUSH_WIDTHS.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWidthId(w.id)}
              className="shrink-0 px-4 py-2 rounded-full text-xs font-medium"
              style={{
                background: selectedWidthId === w.id ? "#fff" : "rgba(255,255,255,0.10)",
                color: selectedWidthId === w.id ? "#000" : "#fff",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}