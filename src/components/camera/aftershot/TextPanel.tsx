import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, IText } from "fabric";
import { X, Check, Type, Palette, RectangleHorizontal, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { useAfterShotLayers, type TextLayer } from "@/lib/after-shot-layers";

const FONTS = [
  { id: "system", label: "Classic", css: "'SF Pro', system-ui, sans-serif" },
  { id: "serif", label: "Elegance", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Neon", css: "'SF Mono', Menlo, monospace" },
  { id: "bold-display", label: "Retro", css: "'Helvetica Neue', Arial, sans-serif" },
  { id: "comic", label: "Comic Sans", css: "'Comic Sans MS', cursive" },
];

const COLORS = ["#ffffff", "#000000", "#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#0a9396", "#0a84ff", "#3f51b5", "#af52de"];
const BOX_COLOR = "rgba(0,0,0,0.55)";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 72;
const DEFAULT_FONT_SIZE = 32;
// Cycles on tap: 400 (off/normal) -> 600 -> 700 -> 800 -> 900 -> back to 400
const WEIGHT_LEVELS = [400, 600, 700, 800, 900];

type TextPanelProps = {
  open: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

const ALIGN_CYCLE: TextLayer["align"][] = ["left", "center", "right"];
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight };

// Tracks how much the on-screen soft keyboard is covering the viewport, via
// the visualViewport API — the layout viewport does NOT shrink with the
// keyboard on iOS Safari, so anything meant to sit "above the keyboard"
// has to be repositioned manually using this, not just placed at the
// bottom of normal document flow.
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(covered)));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

export default function TextPanel({ open, containerRef, onClose }: TextPanelProps) {
  const { addLayer } = useAfterShotLayers();
  const keyboardInset = useKeyboardInset();

  const [phase, setPhase] = useState<"compose" | "place">("compose");

  const [content, setContent] = useState("");
  const [selectedFontId, setSelectedFontId] = useState(FONTS[0].id);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE); // raw px while composing, converted to a fraction at confirm
  const [align, setAlign] = useState<TextLayer["align"]>("center");
  const [boxOn, setBoxOn] = useState(false);
  const [weightLevel, setWeightLevel] = useState(0); // index into WEIGHT_LEVELS
  const [showColorRow, setShowColorRow] = useState(false);

  const activeFont = FONTS.find((f) => f.id === selectedFontId) ?? FONTS[0];
  const AlignIcon = ALIGN_ICON[align];
  const fontWeight = WEIGHT_LEVELS[weightLevel];

  // ---- vertical size slider ----
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingSlider = useRef(false);

  const setFontSizeFromClientY = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
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

    const text = new IText(content, {
      left: canvasSize.w / 2,
      top: canvasSize.h / 2,
      originX: "center",
      originY: "center",
      fontFamily: activeFont.css,
      fill: selectedColor,
      fontSize, // still raw px here — placement box is the same width as the compose screen, so no conversion needed yet
      fontWeight,
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
    setWeightLevel(0);
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
        content,
        font: activeFont.css,
        color: selectedColor,
        fontSize: fontSize / size.w, // px -> fraction of box width, resolution-independent for bake/render
        align,
        boxColor: boxOn ? BOX_COLOR : null,
        fontWeight,
      };
      addLayer(layer);
    }
    reset();
    onClose();
  }, [content, activeFont.css, selectedColor, fontSize, align, boxOn, fontWeight, canvasSize, addLayer, reset, onClose]);

  const cycleAlign = useCallback(() => {
    setAlign((prev) => ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(prev) + 1) % ALIGN_CYCLE.length]);
  }, []);

  const cycleWeight = useCallback(() => {
    setWeightLevel((prev) => (prev + 1) % WEIGHT_LEVELS.length);
  }, []);

  if (!open) return null;

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

  // ---- COMPOSE PHASE ----
  // No bg-black here — TextPanel is mounted inside the SAME mediaBoxRef
  // div as the page's real <img>/<video>, sitting on top of it in the DOM.
  // The media is already visible underneath; painting black over it was
  // the only thing hiding it.
  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
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
          {/* Bold-strength cycle: tap steps through WEIGHT_LEVELS, wrapping
              back to normal. The "B" itself renders at the current weight
              so the button visually shows the effect, not just a fixed icon. */}
          <button
            onClick={cycleWeight}
            aria-label={`Bold strength: ${fontWeight}`}
            className="flex items-center justify-center w-9 h-9 rounded-full text-base"
            style={{
              background: weightLevel > 0 ? "#fff" : "transparent",
              color: weightLevel > 0 ? "#000" : "#fff",
              fontWeight,
            }}
          >
            B
          </button>
        </div>

        <button onClick={() => setPhase("place")} disabled={content.trim().length === 0} className="text-white font-semibold disabled:opacity-40">
          Done
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center px-8">
        <div
          style={{
            fontFamily: activeFont.css,
            color: selectedColor,
            fontSize,
            fontWeight,
            textAlign: align,
            background: boxOn ? BOX_COLOR : "transparent",
            padding: boxOn ? "4px 10px" : 0,
            borderRadius: boxOn ? 4 : 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxWidth: "100%",
            textShadow: boxOn ? "none" : "0 1px 4px rgba(0,0,0,0.4)",
          }}
        >
          {content || <span style={{ opacity: 0.5 }}>Type something…</span>}
        </div>

        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          autoFocus
          className="absolute inset-0 opacity-0"
          style={{ caretColor: "transparent" }}
        />

        <div ref={trackRef} className="absolute right-3 top-1/4 bottom-1/4 w-1 rounded-full" style={{ background: "rgba(255,255,255,0.25)" }}>
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

      {/* Pinned above the keyboard when it's open, otherwise resting at
          the safe-area bottom — position:absolute + keyboardInset instead
          of normal flex flow, since the layout viewport doesn't shrink
          with the keyboard on iOS. */}
      <div
        className="absolute left-0 right-0 px-5 z-30"
        style={{
          bottom: keyboardInset > 0 ? keyboardInset : "calc(env(safe-area-inset-bottom) + 20px)",
          paddingBottom: keyboardInset > 0 ? 12 : 0,
        }}
      >
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