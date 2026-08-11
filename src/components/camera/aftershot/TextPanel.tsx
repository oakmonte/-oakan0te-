import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, IText } from "fabric";
import {
  X,
  Check,
  Type,
  Palette,
  RectangleHorizontal,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
} from "lucide-react";
import { useAfterShotLayers, type TextLayer } from "@/lib/after-shot-layers";

const FONTS = [
  { id: "system", label: "Classic", css: "'SF Pro', system-ui, sans-serif" },
  { id: "serif", label: "Elegance", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Neon", css: "'SF Mono', Menlo, monospace" },
  { id: "bold-display", label: "Retro", css: "'Helvetica Neue', Arial, sans-serif" },
  { id: "comic", label: "Comic Sans", css: "'Comic Sans MS', cursive" },
];

const COLORS = ["#ffffff", "#000000", "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0a9396", "#0a84ff", "#3f51b5", "#af52de"];
const BOX_COLOR = "rgba(0,0,0,0.55)"; // fixed box color for v1 — flagged simplification, see note below
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 72;
const DEFAULT_FONT_SIZE = 32;

type TextPanelProps = {
  open: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

const ALIGN_CYCLE: TextLayer["align"][] = ["left", "center", "right"];
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight };

export default function TextPanel({ open, containerRef, onClose }: TextPanelProps) {
  const { addLayer } = useAfterShotLayers();

  const [phase, setPhase] = useState<"compose" | "place">("compose");

  const [content, setContent] = useState("");
  const [selectedFontId, setSelectedFontId] = useState(FONTS[0].id);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [align, setAlign] = useState<TextLayer["align"]>("center");
  const [boxOn, setBoxOn] = useState(false);
  const [uppercase, setUppercase] = useState(false);
  const [showColorRow, setShowColorRow] = useState(false);

  const activeFont = FONTS.find((f) => f.id === selectedFontId) ?? FONTS[0];
  const AlignIcon = ALIGN_ICON[align];

  // ---- vertical size slider ("conical tube") ----
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingSlider = useRef(false);

  const setFontSizeFromClientY = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    // Inverted: top of track = largest size, bottom = smallest — matches
    // the reference's handle-near-top-means-bigger convention.
    const size = MAX_FONT_SIZE - fraction * (MAX_FONT_SIZE - MIN_FONT_SIZE);
    setFontSize(Math.round(size));
  }, []);

  useEffect(() => {
    if (phase !== "compose") return;
    const onMove = (e: PointerEvent) => {
      if (!draggingSlider.current) return;
      setFontSizeFromClientY(e.clientY);
    };
    const onUp = () => {
      draggingSlider.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [phase, setFontSizeFromClientY]);

  const sliderFraction = 1 - (fontSize - MIN_FONT_SIZE) / (MAX_FONT_SIZE - MIN_FONT_SIZE);

  // ---- placement phase (Fabric) ----
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const textObjRef = useRef<IText | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (phase !== "place") return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase, containerRef]);

  useEffect(() => {
    if (phase !== "place" || !canvasSize || !canvasElRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      width: canvasSize.w,
      height: canvasSize.h,
      backgroundColor: "transparent",
      selection: false,
    });
    fabricCanvasRef.current = canvas;

    const displayText = uppercase ? content.toUpperCase() : content;
    const text = new IText(displayText, {
      left: canvasSize.w / 2,
      top: canvasSize.h / 2,
      originX: "center",
      originY: "center",
      fontFamily: activeFont.css,
      fill: selectedColor,
      fontSize,
      fontWeight: "400",
      textAlign: align,
      backgroundColor: boxOn ? BOX_COLOR : undefined,
      editable: false,
    });
    text.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
    canvas.add(text);
    canvas.setActiveObject(text);
    textObjRef.current = text;
    canvas.requestRenderAll();

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
      textObjRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, canvasSize]);

  const reset = useCallback(() => {
    setPhase("compose");
    setContent("");
    setSelectedFontId(FONTS[0].id);
    setSelectedColor(COLORS[0]);
    setFontSize(DEFAULT_FONT_SIZE);
    setAlign("center");
    setBoxOn(false);
    setUppercase(false);
    setShowColorRow(false);
  }, []);

  const handleCancel = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleConfirmPlacement = useCallback(() => {
    const text = textObjRef.current;
    const size = canvasSize;
    if (text && size) {
      const layer: TextLayer = {
        id: `text-${Date.now()}`,
        kind: "text",
        x: text.left / size.w,
        y: text.top / size.h,
        scale: text.scaleX,
        rotation: text.angle,
        zIndex: 0,
        content: uppercase ? content.toUpperCase() : content,
        font: activeFont.css,
        color: selectedColor,
        fontSize,
        align,
        boxColor: boxOn ? BOX_COLOR : null,
        bold: false,
      };
      addLayer(layer);
    }
    reset();
    onClose();
  }, [content, uppercase, activeFont.css, selectedColor, fontSize, align, boxOn, canvasSize, addLayer, reset, onClose]);

  const cycleAlign = useCallback(() => {
    setAlign((prev) => ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(prev) + 1) % ALIGN_CYCLE.length]);
  }, []);

  if (!open) return null;

  // ---- PLACEMENT PHASE: same shape as before — Fabric canvas over media, X/check ----
  if (phase === "place") {
    return (
      <div className="absolute inset-0 z-40 flex flex-col" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
        <canvas ref={canvasElRef} className="absolute inset-0" style={{ touchAction: "none" }} />
        <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-10">
          <button
            onClick={handleCancel}
            aria-label="Cancel text"
            className="flex items-center justify-center w-10 h-10 rounded-full"
            style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
          >
            <X size={20} color="#fff" />
          </button>
          <button
            onClick={handleConfirmPlacement}
            aria-label="Confirm text"
            className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
            style={{ background: "#fff", color: "#000" }}
          >
            <Check size={20} />
          </button>
        </div>
      </div>
    );
  }

  // ---- COMPOSE PHASE: full-screen black editor, matches the reference ----
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowColorRow(false)}
            aria-label="Show font options"
            className="flex items-center justify-center w-9 h-9 rounded-full"
            style={{ background: !showColorRow ? "rgba(255,255,255,0.15)" : "transparent" }}
          >
            <Type size={20} color="#fff" />
          </button>
          <button
            onClick={() => setShowColorRow((v) => !v)}
            aria-label="Toggle color picker"
            className="flex items-center justify-center w-9 h-9 rounded-full"
            style={{ background: showColorRow ? "rgba(255,255,255,0.15)" : "transparent" }}
          >
            <Palette size={20} color="#fff" />
          </button>
          <button
            onClick={() => setBoxOn((v) => !v)}
            aria-label="Toggle text box"
            className="flex items-center justify-center w-9 h-9 rounded-full"
            style={{ background: boxOn ? "#fff" : "transparent", color: boxOn ? "#000" : "#fff" }}
          >
            <RectangleHorizontal size={20} />
          </button>
          <button
            onClick={cycleAlign}
            aria-label={`Alignment: ${align}`}
            className="flex items-center justify-center w-9 h-9 rounded-full"
          >
            <AlignIcon size={20} color="#fff" />
          </button>
          <button
            onClick={() => setUppercase((v) => !v)}
            aria-label="Toggle uppercase"
            className="flex items-center justify-center w-9 h-9 rounded-full"
            style={{ background: uppercase ? "#fff" : "transparent", color: uppercase ? "#000" : "#fff" }}
          >
            <Sparkles size={20} />
          </button>
        </div>

        <button onClick={() => setPhase("place")} disabled={content.trim().length === 0} className="text-white font-semibold disabled:opacity-40">
          Done
        </button>
      </div>

      {/* Live preview + hidden input driving it — no drag here, that only
          starts once placement phase mounts the Fabric canvas. */}
      <div className="relative flex-1 flex items-center justify-center px-8">
        <div
          style={{
            fontFamily: activeFont.css,
            color: selectedColor,
            fontSize,
            fontWeight: "400",
            textAlign: align,
            textTransform: uppercase ? "uppercase" : "none",
            background: boxOn ? BOX_COLOR : "transparent",
            padding: boxOn ? "4px 10px" : 0,
            borderRadius: boxOn ? 4 : 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxWidth: "100%",
          }}
        >
          {content || <span style={{ opacity: 0.35 }}>Type something…</span>}
        </div>

        {/* real input, invisible but focused, driving `content` */}
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
          className="absolute inset-0 opacity-0"
          style={{ caretColor: "transparent" }}
        />

        {/* vertical size slider — right edge, "conical tube" */}
        <div
          ref={trackRef}
          className="absolute right-3 top-1/4 bottom-1/4 w-1 rounded-full"
          style={{ background: "rgba(255,255,255,0.25)" }}
        >
          <div
            onPointerDown={(e) => {
              draggingSlider.current = true;
              setFontSizeFromClientY(e.clientY);
            }}
            className="absolute rounded-full"
            style={{
              width: 20,
              height: 20,
              left: "50%",
              top: `${sliderFraction * 100}%`,
              transform: "translate(-50%, -50%)",
              background: "#fff",
              touchAction: "none",
              cursor: "grab",
            }}
          />
        </div>
      </div>

      <div className="px-5 z-30" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
        {showColorRow ? (
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
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto">
            {FONTS.map((font) => (
              <button
                key={font.id}
                onClick={() => setSelectedFontId(font.id)}
                className="shrink-0 px-4 py-2 rounded-full text-xs font-medium"
                style={{
                  fontFamily: font.css,
                  background: selectedFontId === font.id ? "#fff" : "rgba(255,255,255,0.10)",
                  color: selectedFontId === font.id ? "#000" : "#fff",
                }}
              >
                {font.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}