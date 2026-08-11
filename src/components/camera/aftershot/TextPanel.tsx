//currenttextpanel
import { useCallback, useState } from "react";
import { X, Check } from "lucide-react";
import { useAfterShotLayers, type Layer, type TextLayer } from "@/lib/after-shot-layers";
import LayerOverlay from "@/components/camera/LayerOverlay";

const FONTS = [
  { id: "system", label: "Classic", css: "'SF Pro', system-ui, sans-serif" },
  { id: "serif", label: "Serif", css: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Mono", css: "'SF Mono', Menlo, monospace" },
  { id: "bold-display", label: "Bold", css: "'Helvetica Neue', Arial, sans-serif" },
];

const COLORS = ["#ffffff", "#000000", "#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#af52de"];
const DRAFT_ID = "draft-text-layer";

type TextPanelProps = {
  open: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
};

// Renders on top of the media that's ALREADY mounted by the parent
// (/create/after-shot's own <img>/<video>) instead of re-rendering its own
// copy — this is the actual point of converting from a route to a panel:
// after-shot's media element, crop state, filter state, and layer stack
// all stay mounted underneath this the whole time it's open.
export default function TextPanel({ open, containerRef, onClose }: TextPanelProps) {
  const { addLayer } = useAfterShotLayers();

  const [content, setContent] = useState("");
  const [selectedFontId, setSelectedFontId] = useState(FONTS[0].id);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [draftLayer, setDraftLayer] = useState<TextLayer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeFont = FONTS.find((f) => f.id === selectedFontId) ?? FONTS[0];

  const syncDraft = useCallback((nextContent: string, nextFontCss: string, nextColor: string) => {
    setDraftLayer((prev) =>
      prev
        ? { ...prev, content: nextContent, font: nextFontCss, color: nextColor }
        : {
            id: DRAFT_ID,
            kind: "text",
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0,
            zIndex: 0,
            content: nextContent,
            font: nextFontCss,
            color: nextColor,
          },
    );
  }, []);

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      syncDraft(value, activeFont.css, selectedColor);
    },
    [syncDraft, activeFont.css, selectedColor],
  );

  const handleFontChange = useCallback(
    (fontId: string) => {
      setSelectedFontId(fontId);
      const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0];
      syncDraft(content, font.css, selectedColor);
    },
    [syncDraft, content, selectedColor],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      setSelectedColor(color);
      syncDraft(content, activeFont.css, color);
    },
    [syncDraft, content, activeFont.css],
  );

  const updateDraftLayer = useCallback((id: string, patch: Partial<Layer>) => {
    if (id !== DRAFT_ID) return;
    setDraftLayer((prev) => (prev ? ({ ...prev, ...patch } as TextLayer) : prev));
  }, []);

  const reset = useCallback(() => {
    setContent("");
    setDraftLayer(null);
    setSelectedId(null);
    setSelectedFontId(FONTS[0].id);
    setSelectedColor(COLORS[0]);
  }, []);

  const handleCancel = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleConfirm = useCallback(() => {
    if (draftLayer && draftLayer.content.trim().length > 0) {
      addLayer({ ...draftLayer, id: `text-${Date.now()}` });
    }
    reset();
    onClose();
  }, [draftLayer, addLayer, reset, onClose]);

  const renderLayerContent = useCallback((layer: Layer) => {
    if (layer.kind !== "text") return null;
    return (
      <span
        style={{
          fontFamily: layer.font,
          color: layer.color,
          fontSize: 28,
          fontWeight: 700,
          whiteSpace: "pre-wrap",
          textShadow: "0 1px 4px rgba(0,0,0,0.4)",
          pointerEvents: "none",
        }}
      >
        {layer.content || " "}
      </span>
    );
  }, []);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      {/* Draft layer renders directly onto the parent's already-mounted
          media via the passed-in containerRef — no separate preview here. */}
      <LayerOverlay
        containerRef={containerRef}
        layers={draftLayer ? [draftLayer] : []}
        updateLayer={updateDraftLayer}
        selectedLayerId={selectedId}
        setSelectedLayerId={setSelectedId}
        renderLayerContent={renderLayerContent}
      />

      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
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

      <div className="mt-auto px-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}>
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