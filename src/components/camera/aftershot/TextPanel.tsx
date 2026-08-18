import { useCallback, useEffect, useRef, useState } from "react";
import { X, Palette, RectangleHorizontal, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import {
  useAfterShotLayers,
  TEXT_LAYER_WIDTH_FRACTION,
  TEXT_LAYER_LINE_HEIGHT,
  TEXT_LAYER_BOX_PAD_X,
  TEXT_LAYER_BOX_PAD_Y,
  TEXT_LAYER_BOX_RADIUS,
  TEXT_LAYER_SHADOW_BLUR,
  TEXT_LAYER_SHADOW_OFFSET_Y,
  TEXT_LAYER_SHADOW_COLOR,
  type TextLayer,
} from "@/lib/after-shot-layers";
import { useVisibleViewport } from "@/hooks/use-visible-viewport";

const FONTS = [
  { id: "system", label: "Classic", css: "'SF Pro', system-ui, sans-serif" },
  { id: "serif", label: "Elegance", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Neon", css: "'SF Mono', Menlo, monospace" },
  // Impact, not Helvetica — the old entry here was Helvetica/Arial, which renders
  // identically to "Classic" on every device, so two of the five presets were the
  // same font under different names.
  {
    id: "display",
    label: "Retro",
    css: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
  },
  { id: "comic", label: "Comic Sans", css: "'Comic Sans MS', cursive" },
];

const COLORS = [
  "#ffffff",
  "#000000",
  "#ff3b30",
  "#ff9500",
  "#ffcc00",
  "#34c759",
  "#0a9396",
  "#0a84ff",
  "#3f51b5",
  "#af52de",
];
const BOX_COLOR = "rgba(0,0,0,0.55)";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 72;
const DEFAULT_FONT_SIZE = 32;
const WEIGHT_LEVELS = [400, 600, 700, 800, 900];
const FALLBACK_BOX_WIDTH = 375; // used only if containerRef isn't measurable yet — shouldn't normally hit
const SLIDER_HIT_WIDTH = 44; // visible track stays 4px; this is the touch target around it

type TextPanelProps = {
  open: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  editingLayerId: string | null; // null = creating a new layer; a real id = editing that existing layer
  onClose: () => void;
};

const ALIGN_CYCLE: TextLayer["align"][] = ["left", "center", "right"];
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight };

export default function TextPanel({ open, containerRef, editingLayerId, onClose }: TextPanelProps) {
  const { layers, addLayer, updateLayer, removeLayer } = useAfterShotLayers();

  // The panel sizes itself to the slice of screen the keyboard leaves free, which
  // is what stops the browser from pushing the page up to make room for it. See
  // use-visible-viewport.ts for why one signal isn't enough across browsers.
  //
  // This panel is deliberately a sibling of the media box, not a child of it:
  // the media box carries transform: translateY(-50%), and a transformed ancestor
  // becomes the containing block for fixed/absolute descendants, so nothing
  // rendered inside it can ever anchor itself to the screen.
  const viewport = useVisibleViewport(open);

  const [content, setContent] = useState("");
  const [selectedFontId, setSelectedFontId] = useState(FONTS[0].id);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE); // raw px while composing
  const [align, setAlign] = useState<TextLayer["align"]>("center");
  const [boxOn, setBoxOn] = useState(false);
  const [weightLevel, setWeightLevel] = useState(0);
  const [showColorRow, setShowColorRow] = useState(false);
  const [boxWidth, setBoxWidth] = useState(FALLBACK_BOX_WIDTH);

  const activeFont = FONTS.find((f) => f.id === selectedFontId) ?? FONTS[0];
  const AlignIcon = ALIGN_ICON[align];
  const fontWeight = WEIGHT_LEVELS[weightLevel];
  const committedRef = useRef(false); // guards against double-commit (blur + X firing together)
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Compose at the exact width the placed layer will wrap at, so the text
  // doesn't reflow the moment you tap away.
  const composeWidth = Math.round(boxWidth * TEXT_LAYER_WIDTH_FRACTION);

  // Track the media box's width — needed to convert TextLayer.fontSize
  // (stored as a fraction of box width, resolution-independent) into real
  // px for editing, and back again on commit.
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => setBoxWidth(el.clientWidth || FALLBACK_BOX_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, containerRef]);

  // Reset to blank, or pre-fill from the layer being edited, every time
  // the panel opens or which layer it's editing changes.
  useEffect(() => {
    if (!open) return;
    committedRef.current = false;
    const editing = editingLayerId
      ? layers.find((l) => l.id === editingLayerId && l.kind === "text")
      : null;
    if (editing && editing.kind === "text") {
      // Measured off the live element rather than the boxWidth state — on the
      // first open that state is still the fallback, which restored the font
      // size several percent off.
      const width = containerRef.current?.clientWidth || boxWidth;
      setContent(editing.content);
      setSelectedFontId(FONTS.find((f) => f.css === editing.font)?.id ?? FONTS[0].id);
      setSelectedColor(editing.color);
      setFontSize(Math.round(editing.fontSize * width) || DEFAULT_FONT_SIZE);
      setAlign(editing.align);
      setBoxOn(editing.boxColor !== null);
      const wIdx = WEIGHT_LEVELS.indexOf(editing.fontWeight);
      setWeightLevel(wIdx === -1 ? 0 : wIdx);
    } else {
      setContent("");
      setSelectedFontId(FONTS[0].id);
      setSelectedColor(COLORS[0]);
      setFontSize(DEFAULT_FONT_SIZE);
      setAlign("center");
      setBoxOn(false);
      setWeightLevel(0);
    }
    setShowColorRow(false);

    // preventScroll is the other half of the keyboard fix: a plain focus() (and
    // autoFocus, which is what this replaces) asks the browser to scroll the
    // field into view, and that scroll is what drags the page up when the
    // keyboard slides in.
    const el = inputRef.current;
    if (el) {
      el.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (!el.isConnected) return;
        const end = el.value.length;
        el.setSelectionRange(end, end);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingLayerId]);

  // Auto-grow: the textarea is always exactly as tall as its content, so it
  // reads as free-floating text on the photo instead of a scrolling field.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content, fontSize, activeFont.css, fontWeight, boxOn, composeWidth, open]);

  // Suppresses iOS Safari's auto-zoom-on-input-focus for this screen only —
  // restores the original viewport meta on close/unmount so the rest of the
  // app keeps normal pinch-zoom behavior. Scoped to this component instead
  // of a global viewport change.
  useEffect(() => {
    if (!open) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.getAttribute("content");
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=overlays-content",
    );
    return () => {
      if (original !== null) meta.setAttribute("content", original);
    };
  }, [open]);

  // ---- vertical size slider ----
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingSlider = useRef(false);

  const setFontSizeFromClientY = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setFontSize(Math.round(MAX_FONT_SIZE - fraction * (MAX_FONT_SIZE - MIN_FONT_SIZE)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      if (draggingSlider.current) setFontSizeFromClientY(e.clientY);
    };
    const onUp = () => {
      draggingSlider.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [open, setFontSizeFromClientY]);

  const sliderFraction = 1 - (fontSize - MIN_FONT_SIZE) / (MAX_FONT_SIZE - MIN_FONT_SIZE);

  const refocus = useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);

  const cycleAlign = useCallback(() => {
    setAlign((prev) => ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(prev) + 1) % ALIGN_CYCLE.length]);
  }, []);

  const cycleWeight = useCallback(() => {
    setWeightLevel((prev) => (prev + 1) % WEIGHT_LEVELS.length);
  }, []);

  // Single commit path for every trigger (the X, blur from tapping outside the
  // input, tapping the background directly). Guarded so it only actually runs
  // once even if two triggers fire back to back.
  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;

    const trimmed = content.trim();
    const width = containerRef.current?.clientWidth || boxWidth;

    if (editingLayerId) {
      if (trimmed.length === 0) {
        removeLayer(editingLayerId);
      } else {
        updateLayer(editingLayerId, {
          content: trimmed,
          font: activeFont.css,
          color: selectedColor,
          fontSize: fontSize / width,
          align,
          boxColor: boxOn ? BOX_COLOR : null,
          fontWeight,
        } as Partial<TextLayer>);
      }
    } else if (trimmed.length > 0) {
      const layer: TextLayer = {
        id: `text-${Date.now()}`,
        kind: "text",
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        zIndex: 0,
        content: trimmed,
        font: activeFont.css,
        color: selectedColor,
        fontSize: fontSize / width,
        align,
        boxColor: boxOn ? BOX_COLOR : null,
        fontWeight,
      };
      addLayer(layer);
    }
    // trimmed === "" and !editingLayerId: nothing typed, nothing to do — just closes.

    onClose();
  }, [
    content,
    editingLayerId,
    containerRef,
    boxWidth,
    activeFont.css,
    selectedColor,
    fontSize,
    align,
    boxOn,
    fontWeight,
    addLayer,
    updateLayer,
    removeLayer,
    onClose,
  ]);

  // Escape backs out leaving the layer exactly as it was — flipping the guard
  // first is what keeps the unmount blur from committing on the way out.
  const cancel = useCallback(() => {
    committedRef.current = true;
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        // Plain Enter is a newline now that this is a textarea; Cmd/Ctrl+Enter
        // keeps a commit shortcut for anyone editing on a desktop.
        e.preventDefault();
        commit();
      }
    },
    [cancel, commit],
  );

  if (!open) return null;

  return (
    <div
      className="absolute left-0 right-0 z-40 flex flex-col"
      style={{
        top: viewport.top,
        height: viewport.height || "100%",
        fontFamily: "'SF Pro', system-ui, sans-serif",
      }}
    >
      <style>{`.oak-text-row::-webkit-scrollbar { display: none; }`}</style>

      {/* Toolbar — onMouseDown preventDefault keeps the text input focused
          when tapping these buttons, so toggling an option never triggers
          the input's blur (and therefore never triggers commit). */}
      <div
        onMouseDown={(e) => e.preventDefault()}
        className="shrink-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]"
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowColorRow(false);
              refocus();
            }}
            aria-label="Show font options"
            className="flex items-center justify-center w-11 h-11 rounded-full"
            style={{ background: !showColorRow ? "rgba(255,255,255,0.15)" : "transparent" }}
          >
            <span className="text-white text-lg font-semibold">A</span>
          </button>
          <button
            onClick={() => {
              setShowColorRow((v) => !v);
              refocus();
            }}
            aria-label="Toggle color picker"
            className="flex items-center justify-center w-11 h-11 rounded-full"
            style={{ background: showColorRow ? "rgba(255,255,255,0.15)" : "transparent" }}
          >
            <Palette size={26} color="#fff" />
          </button>
          <button
            onClick={() => {
              setBoxOn((v) => !v);
              refocus();
            }}
            aria-label="Toggle text box"
            className="flex items-center justify-center w-11 h-11 rounded-full"
            style={{ background: boxOn ? "#fff" : "transparent", color: boxOn ? "#000" : "#fff" }}
          >
            <RectangleHorizontal size={26} />
          </button>
          <button
            onClick={() => {
              cycleAlign();
              refocus();
            }}
            aria-label={`Alignment: ${align}`}
            className="flex items-center justify-center w-11 h-11 rounded-full"
          >
            <AlignIcon size={26} color="#fff" />
          </button>
          <button
            onClick={() => {
              cycleWeight();
              refocus();
            }}
            aria-label={`Bold strength: ${fontWeight}`}
            className="flex items-center justify-center w-11 h-11 rounded-full text-lg"
            style={{
              background: weightLevel > 0 ? "#fff" : "transparent",
              color: weightLevel > 0 ? "#000" : "#fff",
              fontWeight,
            }}
          >
            B
          </button>
        </div>
        <button
          onClick={commit}
          aria-label="Done, place text"
          className="flex items-center justify-center w-11 h-11 rounded-full"
        >
          <X size={22} color="#fff" />
        </button>
      </div>

      {/* Tapping this background area (anywhere that isn't the input or the
          toolbar) commits and returns to the after-shot page. Layers already on
          the photo stay visible behind it — the page keeps its own LayerOverlay
          mounted while this panel is open, so drawings and other captions no
          longer blink out while you type. */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center" onClick={commit}>
        <textarea
          ref={inputRef}
          rows={1}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          placeholder="Type something…"
          style={{
            fontFamily: activeFont.css,
            color: selectedColor,
            fontSize,
            fontWeight,
            textAlign: align,
            lineHeight: TEXT_LAYER_LINE_HEIGHT,
            background: boxOn ? BOX_COLOR : "transparent",
            // Same font-size multiples the placed layer and the bake use, so the
            // box you compose in is the box that ends up in the file.
            padding: boxOn
              ? `${fontSize * TEXT_LAYER_BOX_PAD_Y}px ${fontSize * TEXT_LAYER_BOX_PAD_X}px`
              : 0,
            borderRadius: boxOn ? fontSize * TEXT_LAYER_BOX_RADIUS : 0,
            border: "none",
            outline: "none",
            width: composeWidth,
            maxHeight: "100%",
            resize: "none",
            overflow: "hidden",
            overflowWrap: "break-word",
            textShadow: boxOn
              ? "none"
              : `0 ${fontSize * TEXT_LAYER_SHADOW_OFFSET_Y}px ${fontSize * TEXT_LAYER_SHADOW_BLUR}px ${TEXT_LAYER_SHADOW_COLOR}`,
          }}
        />

        {/* 4px track, 44px touch target. stopPropagation on click is what keeps a
            tap on the slider from bubbling to the background's commit and
            closing the panel mid-adjustment. */}
        <div
          className="absolute right-1 top-1/4 bottom-1/4 flex justify-center"
          style={{ width: SLIDER_HIT_WIDTH, touchAction: "none" }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.stopPropagation();
            draggingSlider.current = true;
            setFontSizeFromClientY(e.clientY);
          }}
        >
          <div
            ref={trackRef}
            className="w-1 h-full rounded-full"
            style={{ background: "rgba(255,255,255,0.25)" }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 20,
              height: 20,
              left: "50%",
              top: `${sliderFraction * 100}%`,
              transform: "translate(-50%, -50%)",
              background: "#fff",
            }}
          />
        </div>
      </div>

      <div
        onMouseDown={(e) => e.preventDefault()}
        className="shrink-0 px-5"
        style={{
          paddingTop: 12,
          paddingBottom:
            viewport.keyboardHeight > 0 ? 12 : "calc(env(safe-area-inset-bottom) + 20px)",
        }}
      >
        {showColorRow ? (
          <div className="oak-text-row flex items-center gap-3 overflow-x-auto py-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  setSelectedColor(color);
                  refocus();
                }}
                aria-label={`Color ${color}`}
                aria-pressed={selectedColor === color}
                className="shrink-0 rounded-full"
                style={{
                  width: 28,
                  height: 28,
                  background: color,
                  border:
                    selectedColor === color ? "2px solid #fff" : "1px solid rgba(255,255,255,0.3)",
                  outline: selectedColor === color ? "2px solid rgba(255,255,255,0.4)" : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="oak-text-row flex items-center gap-2 overflow-x-auto py-1">
            {FONTS.map((font) => (
              <button
                key={font.id}
                onClick={() => {
                  setSelectedFontId(font.id);
                  refocus();
                }}
                aria-pressed={selectedFontId === font.id}
                className="shrink-0 px-4 py-2 rounded-full text-xs font-medium"
                style={{
                  fontFamily: font.css,
                  background: selectedFontId === font.id ? "#fff" : "rgba(255,255,255,0.10)",
                  color: selectedFontId === font.id ? "#000" : "#fff",
                  border:
                    selectedFontId === font.id
                      ? "1px solid #fff"
                      : "1px solid rgba(255,255,255,0.35)",
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
