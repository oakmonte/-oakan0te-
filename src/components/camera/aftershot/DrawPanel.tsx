import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X, Check, Undo2, Redo2 } from "lucide-react";
import { useAfterShotLayers, type DrawStroke, type DrawLayer } from "@/lib/after-shot-layers";
import { StrokeShape } from "./StrokeShape";

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

const BRUSH_STYLES = [
  { id: "pen", label: "Pen" },
  { id: "neon", label: "Neon" },
  { id: "eraser", label: "Eraser" },
] as const;
type BrushStyleId = (typeof BRUSH_STYLES)[number]["id"];

// How close a pointer has to get to a stroke before the eraser takes it, as a
// multiple of the current brush width — so the thick eraser really does grab
// more than the thin one.
const ERASE_REACH = 1.2;

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Whole-stroke eraser (the Snapchat/Instagram behaviour) rather than a pixel
// eraser: strokes are stored as vector polylines, so rubbing out the middle of
// one would mean splitting it, and nothing downstream — including the bake — is
// set up for partial strokes.
function strokeIsHit(stroke: DrawStroke, x: number, y: number, reach: number) {
  const pts = stroke.points;
  if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][1] - y) <= reach;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    if (distanceToSegment(x, y, ax, ay, bx, by) <= reach) return true;
  }
  return false;
}

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
  const [brushStyle, setBrushStyle] = useState<BrushStyleId>("pen");
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<DrawStroke | null>(null);
  const isDrawingRef = useRef(false);

  // Snapshot-based history. Strokes are cheap and few, and snapshots make undo
  // and redo behave identically for drawing and for erasing — a per-action diff
  // would need two separate cases and get erase-then-undo subtly wrong.
  const [undoStack, setUndoStack] = useState<DrawStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawStroke[][]>([]);

  const activeWidth = BRUSH_WIDTHS.find((w) => w.id === selectedWidthId) ?? BRUSH_WIDTHS[1];

  // Live pixel size of the media box. The stroke overlay renders in raw px (no
  // viewBox scaling), which is the only way the line under your finger is
  // exactly the line that gets stored.
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBoxSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, containerRef]);

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
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [open, setFractionFromClientY]);

  // Both axes are measured against the box WIDTH, not width-then-height. Storing
  // y against height would make a circle come out an ellipse the moment the
  // stroke is confirmed, because the placed renderer and the bake both scale x
  // and y by canvas width — a square coordinate space is the one all three
  // stages agree on.
  const pointFromEvent = useCallback(
    (e: ReactPointerEvent): [number, number] | null => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return null;
      return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.width];
    },
    [containerRef],
  );

  const pushHistory = useCallback(() => {
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);
  }, [strokes]);

  const eraseAt = useCallback(
    (point: [number, number]) => {
      const reach = activeWidth.value * ERASE_REACH;
      setStrokes((prev) => {
        const kept = prev.filter((s) => !strokeIsHit(s, point[0], point[1], reach));
        return kept.length === prev.length ? prev : kept;
      });
    },
    [activeWidth.value],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      const point = pointFromEvent(e);
      if (!point) return;
      isDrawingRef.current = true;
      pushHistory();
      if (brushStyle === "eraser") {
        eraseAt(point);
        return;
      }
      setActiveStroke({
        points: [point],
        color: selectedColor,
        width: activeWidth.value,
        glow: brushStyle === "neon",
      });
    },
    [pointFromEvent, pushHistory, brushStyle, eraseAt, selectedColor, activeWidth.value],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!isDrawingRef.current) return;
      const point = pointFromEvent(e);
      if (!point) return;
      if (brushStyle === "eraser") {
        eraseAt(point);
        return;
      }
      setActiveStroke((prev) => (prev ? { ...prev, points: [...prev.points, point] } : prev));
    },
    [pointFromEvent, brushStyle, eraseAt],
  );

  const commitActiveStroke = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setActiveStroke((prev) => {
      // A single point is a dot — a tap, not a failed line. It used to be
      // dropped here, so tapping the canvas did nothing at all.
      if (prev && prev.points.length >= 1) setStrokes((s) => [...s, prev]);
      return null;
    });
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const restored = prev[prev.length - 1];
      setRedoStack((r) => [...r, strokes]);
      setStrokes(restored);
      return prev.slice(0, -1);
    });
  }, [strokes]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const restored = prev[prev.length - 1];
      setUndoStack((u) => [...u, strokes]);
      setStrokes(restored);
      return prev.slice(0, -1);
    });
  }, [strokes]);

  const buildLayerFromStrokes = useCallback(
    (allStrokes: DrawStroke[]): DrawLayer | null => {
      if (allStrokes.length === 0 || boxSize.w === 0 || boxSize.h === 0) return null;
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
        // Stroke coords are in width-units; BaseLayer.y is a fraction of HEIGHT
        // (LayerOverlay positions with top: y%), so convert on the way out.
        y: (centerY * boxSize.w) / boxSize.h,
        scale: 1,
        rotation: 0,
        zIndex: 0,
        strokes: localStrokes,
      };
    },
    [boxSize],
  );

  const reset = useCallback(() => {
    setStrokes([]);
    setActiveStroke(null);
    setUndoStack([]);
    setRedoStack([]);
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

  const isEraser = brushStyle === "eraser";

  return (
    <div
      className="oak-motion-fade absolute inset-0 z-40"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {/* Pointer capture surface is absolute inset-0 — pixel-for-pixel the SAME
          box pointFromEvent measures against (containerRef). It used to be a
          flex-1 child sitting BELOW a document-flow header row, so its own
          coordinate origin was the header's height lower than where
          pointFromEvent's fractions were computed from. Every stroke rendered
          exactly that many pixels below the finger that drew it — this is why
          strokes formed below the actual touch point. Header and toolbar now
          float on top of this full-bleed surface instead of pushing it down. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitActiveStroke}
        onPointerCancel={commitActiveStroke}
        onPointerLeave={commitActiveStroke}
        className="absolute inset-0"
        style={{ touchAction: "none" }}
      >
        {/* Raw px user units — no viewBox. The previous version scaled a 0-1
            viewBox to the box AND set vector-effect="non-scaling-stroke", which
            together meant stroke-width 0.014 was read as 0.014 SCREEN px: every
            stroke painted zero visible pixels. */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {renderedStrokes.map((stroke, i) => (
            <StrokeShape key={i} stroke={stroke} scale={boxSize.w} />
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
            opacity: isEraser ? 0.35 : 1,
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

      {/* Header floats ON TOP of the full-bleed touch surface instead of
          pushing it down. pointerEvents:none on the row and :auto on just the
          three button groups means the empty space between them still lets
          you draw right up to the top edge — nothing about the header steals
          touches from the canvas underneath. */}
      <div
        className="oak-motion-enter absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]"
        style={{ pointerEvents: "none" }}
      >
        <button
          onClick={handleCancel}
          aria-label="Cancel draw"
          className="oak-motion-control flex items-center justify-center w-10 h-10 rounded-full active:scale-90"
          style={{
            background: "rgba(255,255,255,0.10)",
            backdropFilter: "blur(12px)",
            pointerEvents: "auto",
          }}
        >
          <X size={20} color="#fff" />
        </button>

        <div className="flex items-center gap-2" style={{ pointerEvents: "auto" }}>
          <button
            onClick={handleUndo}
            aria-label="Undo"
            disabled={undoStack.length === 0}
            className="oak-motion-control flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 active:scale-90"
            style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
          >
            <Undo2 size={18} color="#fff" />
          </button>
          <button
            onClick={handleRedo}
            aria-label="Redo"
            disabled={redoStack.length === 0}
            className="oak-motion-control flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 active:scale-90"
            style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
          >
            <Redo2 size={18} color="#fff" />
          </button>
        </div>

        <button
          onClick={handleConfirm}
          aria-label="Confirm drawing"
          disabled={strokes.length === 0}
          className="oak-motion-control flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 active:scale-90"
          style={{ background: "#fff", color: "#000", pointerEvents: "auto" }}
        >
          <Check size={20} />
        </button>
      </div>

      {/* Same floating treatment for the bottom toolbar. */}
      <div
        className="oak-motion-enter absolute left-0 right-0 bottom-0 px-5 z-30"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
          pointerEvents: "none",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Size pills render an actual dot at the real brush size instead of
              the words Thin/Medium/Thick — you can see what you're about to
              draw with before committing a stroke to find out. */}
          <div className="flex items-center gap-2" style={{ pointerEvents: "auto" }}>
            {BRUSH_WIDTHS.map((w) => {
              const selected = selectedWidthId === w.id;
              const dot = Math.max(4, Math.round(w.value * (boxSize.w || 375)));
              return (
                <button
                  key={w.id}
                  onClick={() => setSelectedWidthId(w.id)}
                  aria-label={`${w.label} brush`}
                  aria-pressed={selected}
                  className="oak-motion-control shrink-0 flex items-center justify-center rounded-full active:scale-90"
                  style={{
                    width: 38,
                    height: 38,
                    background: selected ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
                    border: selected ? "1.5px solid #fff" : "1.5px solid transparent",
                  }}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: Math.min(dot, 24),
                      height: Math.min(dot, 24),
                      background: isEraser ? "rgba(255,255,255,0.55)" : selectedColor,
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.25)",
                    }}
                  />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2" style={{ pointerEvents: "auto" }}>
            {BRUSH_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setBrushStyle(s.id)}
                aria-pressed={brushStyle === s.id}
                className="oak-motion-control shrink-0 px-4 py-2 rounded-full text-xs font-medium active:scale-95"
                style={{
                  background: brushStyle === s.id ? "#fff" : "rgba(255,255,255,0.10)",
                  color: brushStyle === s.id ? "#000" : "#fff",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
