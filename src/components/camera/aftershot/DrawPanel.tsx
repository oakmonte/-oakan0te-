//currentdrawpanel
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X, Check, Undo2 } from "lucide-react";
import { useAfterShotLayers, type DrawStroke, type DrawLayer } from "@/lib/after-shot-layers";

// Stops for the vertical color slider — white at top through the hue
// spectrum down to black at bottom, matching the Snapchat-style reference.
// Kept as a JS array (not just a CSS gradient string) because the same
// stops are used twice: once to paint the track's linear-gradient, and
// once to interpolate an actual hex value at the thumb's fractional
// position — a CSS gradient alone can't be sampled back into a color.
const GRADIENT_STOPS = [
  "#ffffff", // white
  "#ff3b30", // red
  "#ff9500", // orange
  "#ffcc00", // yellow
  "#34c759", // green
  "#0a9396", // teal
  "#0a84ff", // blue
  "#5e5ce6", // indigo
  "#af52de", // purple
  "#ff2d78", // magenta
  "#000000", // black
];
const GRADIENT_CSS = `linear-gradient(to bottom, ${GRADIENT_STOPS.join(", ")})`;

function hexToRgb(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((x) =>
        Math.round(Math.min(255, Math.max(0, x)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
// Linearly interpolates between the two GRADIENT_STOPS the fraction falls
// between, so dragging the slider yields a continuous color, not just a
// jump between the 11 named stops.
function colorAtFraction(fraction: number): string {
  const clamped = Math.min(1, Math.max(0, fraction));
  const scaled = clamped * (GRADIENT_STOPS.length - 1);
  const idx = Math.floor(scaled);
  const t = scaled - idx;
  const c1 = hexToRgb(GRADIENT_STOPS[idx]);
  const c2 = hexToRgb(GRADIENT_STOPS[Math.min(idx + 1, GRADIENT_STOPS.length - 1)]);
  return rgbToHex(c1.r + (c2.r - c1.r) * t, c1.g + (c2.g - c1.g) * t, c1.b + (c2.b - c1.b) * t);
}

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

  // 0 = white (top of gradient), 1 = black (bottom) — matches the default
  // white that COLORS[0] used to give before the swap to a continuous picker.
  const [colorFraction, setColorFraction] = useState(0);
  const selectedColor = useMemo(() => colorAtFraction(colorFraction), [colorFraction]);

  const [selectedWidthId, setSelectedWidthId] = useState(BRUSH_WIDTHS[1].id);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<DrawStroke | null>(null);
  const isDrawingRef = useRef(false);

  const activeWidth = BRUSH_WIDTHS.find((w) => w.id === selectedWidthId) ?? BRUSH_WIDTHS[1];

  // ---- color slider drag (same trackRef/window-listener pattern as
  // TextPanel's font-size slider, for consistency) ----
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const draggingSliderRef = useRef(false);

  const setFractionFromClientY = useCallback((clientY: number) => {
    const track = sliderTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setColorFraction(fraction);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      if (draggingSliderRef.current) setFractionFromClientY(e.clientY);
    };
    const onUp = () => {
      draggingSliderRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open, setFractionFromClientY]);

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
    <div
      className="absolute inset-0 z-40 flex flex-col"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
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

        {/* Vertical color gradient slider — replaces the discrete swatch
            row. Track paints GRADIENT_CSS directly; the draggable thumb's
            own background is set to the live interpolated color, so the
            thumb itself previews the current pick, same as the reference. */}
        <div
          ref={sliderTrackRef}
          className="absolute right-3 top-1/4 bottom-1/4 rounded-full"
          style={{
            width: 6,
            background: GRADIENT_CSS,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.25)",
          }}
        >
          <div
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.stopPropagation(); // don't let this also register as a draw stroke
              draggingSliderRef.current = true;
              setFractionFromClientY(e.clientY);
            }}
            className="absolute rounded-full"
            style={{
              width: 26,
              height: 26,
              left: "50%",
              top: `${colorFraction * 100}%`,
              transform: "translate(-50%, -50%)",
              background: selectedColor,
              border: "3px solid #fff",
              boxShadow: "0 1px 6px rgba(0,0,0,0.4)",
              touchAction: "none",
              cursor: "grab",
            }}
          />
        </div>
      </div>

      <div
        className="px-5 z-30"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="flex items-center gap-2">
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
