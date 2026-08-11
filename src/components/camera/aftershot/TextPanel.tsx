import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, IText } from "fabric";
import { X, Check } from "lucide-react";
import { useAfterShotLayers, type TextLayer } from "@/lib/after-shot-layers";

const FONTS = [
  { id: "system", label: "Classic", css: "'SF Pro', system-ui, sans-serif" },
  { id: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Mono", css: "'SF Mono', Menlo, monospace" },
  { id: "bold-display", label: "Bold", css: "'Helvetica Neue', Arial, sans-serif" },
];

const COLORS = ["#ffffff", "#000000", "#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#af52de"];
const BASE_FONT_SIZE = 28; // matches the old renderLayerContent's fixed fontSize

type TextPanelProps = {
  open: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

// Same public contract as the old DOM/pointer-math version: mounts on top
// of the parent's already-rendered media via containerRef, and on confirm
// produces a plain TextLayer (x/y fractional, single uniform scale,
// rotation in degrees) — same shape layer-bake.ts and the base page's
// renderLayerContent already know how to draw. Only the EDITING interaction
// (drag/scale/rotate while this panel is open) is now handled by Fabric
// instead of hand-rolled pointer math.
export default function TextPanel({ open, containerRef, onClose }: TextPanelProps) {
  const { addLayer } = useAfterShotLayers();

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const textObjRef = useRef<IText | null>(null);

  const [content, setContent] = useState("");
  const [selectedFontId, setSelectedFontId] = useState(FONTS[0].id);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);

  const activeFont = FONTS.find((f) => f.id === selectedFontId) ?? FONTS[0];

  // Size the Fabric canvas to match the parent's real media box, same
  // ResizeObserver pattern CropPanel already uses off containerRef.
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, containerRef]);

  // Mount/teardown the Fabric canvas + the single IText object it edits.
  // Transparent background so the media underneath (rendered by the parent)
  // shows through — this canvas only owns the text object and its handles.
  useEffect(() => {
    if (!open || !canvasSize || !canvasElRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      width: canvasSize.w,
      height: canvasSize.h,
      backgroundColor: "transparent",
      selection: false,
    });
    fabricCanvasRef.current = canvas;

    const text = new IText("", {
      left: canvasSize.w / 2,
      top: canvasSize.h / 2,
      originX: "center",
      originY: "center",
      fontFamily: activeFont.css,
      fill: selectedColor,
      fontSize: BASE_FONT_SIZE,
      fontWeight: "700",
      editable: false, // typing happens via the DOM input below, not in-canvas
    });
    // Only corner handles enabled (uniform scale + rotate) — side handles
    // (mt/mb/ml/mr) that would let width/height scale independently are
    // hidden on purpose. v1 layers use a single uniform `scale`, same
    // simplification the old Draw/Sticker layer shapes already made.
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
  }, [open, canvasSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    const text = textObjRef.current;
    if (!text) return;
    text.set({ text: value });
    fabricCanvasRef.current?.requestRenderAll();
  }, []);

  const handleFontChange = useCallback((fontId: string) => {
    setSelectedFontId(fontId);
    const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0];
    const text = textObjRef.current;
    if (!text) return;
    text.set({ fontFamily: font.css });
    fabricCanvasRef.current?.requestRenderAll();
  }, []);

  const handleColorChange = useCallback((color: string) => {
    setSelectedColor(color);
    const text = textObjRef.current;
    if (!text) return;
    text.set({ fill: color });
    fabricCanvasRef.current?.requestRenderAll();
  }, []);

  const reset = useCallback(() => {
    setContent("");
    setSelectedFontId(FONTS[0].id);
    setSelectedColor(COLORS[0]);
  }, []);

  const handleCancel = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleConfirm = useCallback(() => {
    const text = textObjRef.current;
    const size = canvasSize;
    if (text && size && content.trim().length > 0) {
      // Convert Fabric's canvas-pixel state into the same fractional
      // TextLayer shape every other layer/bake consumer expects.
      const layer: TextLayer = {
        id: `text-${Date.now()}`,
        kind: "text",
        x: text.left / size.w,
        y: text.top / size.h,
        scale: text.scaleX, // corner-only handles guarantee scaleX === scaleY
        rotation: text.angle,
        zIndex: 0,
        content: content.trim(),
        font: activeFont.css,
        color: selectedColor,
      };
      addLayer(layer);
    }
    reset();
    onClose();
  }, [content, activeFont.css, selectedColor, canvasSize, addLayer, reset, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      {/* The Fabric canvas — same absolute-fill-over-containerRef position
          the old LayerOverlay draft used, just backed by Fabric instead of
          custom pointer handlers. */}
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
          onClick={handleConfirm}
          aria-label="Confirm text"
          disabled={content.trim().length === 0}
          className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 transition-transform duration-150 active:scale-90"
          style={{ background: "#fff", color: "#000" }}
        >
          <Check size={20} />
        </button>
      </div>

      <div className="mt-auto px-5 z-10" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
        <input
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Type something…"
          autoFocus
          className="w-full bg-transparent border-b border-white/20 text-lg py-2 outline-none placeholder:text-white/40 text-white"
        />

        <div className="flex items-center gap-3 mt-4 overflow-x-auto">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
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

        <div className="flex items-center gap-2 mt-4 overflow-x-auto">
          {FONTS.map((font) => (
            <button
              key={font.id}
              onClick={() => handleFontChange(font.id)}
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
      </div>
    </div>
  );
}