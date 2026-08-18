import { createContext, useContext, useState, useCallback } from "react";

type BaseLayer = {
  id: string;
  x: number; // 0-1, fraction of media width — resolution-independent like the crop rect pattern
  y: number; // 0-1, fraction of media height
  scale: number;
  rotation: number; // degrees
  zIndex: number;
};

export type TextLayer = BaseLayer & {
  kind: "text";
  content: string;
  font: string;
  color: string;
  fontSize: number; // fraction of container width — multiply by box width for px, same convention as x/y
  align: "left" | "center" | "right";
  boxColor: string | null;
  fontWeight: number; // 400–900, cycles via the bold-strength control
};

// Text wraps at this fraction of the media box width. Shared by the composing
// textarea in TextPanel and the committed-layer render on the after-shot page,
// so what you type wraps exactly where it will wrap once it's placed.
export const TEXT_LAYER_WIDTH_FRACTION = 0.8;

// Line height is part of that same contract — a textarea and a span do not
// default to the same one, and any mismatch shifts the wrap points.
export const TEXT_LAYER_LINE_HEIGHT = 1.25;

// The text box's padding and corner radius, as multiples of font size rather
// than fixed px. Fixed px can't survive the bake: the editor lays text out at
// ~375px wide and the export canvas is 1080+, so a literal 4px pad would come
// out nearly three times too tight in the file you actually publish. Deriving
// both from font size — which is already stored resolution-independently as a
// fraction of width — makes the preview and the bake agree at any size.
export const TEXT_LAYER_BOX_PAD_X = 0.3;
export const TEXT_LAYER_BOX_PAD_Y = 0.15;
export const TEXT_LAYER_BOX_RADIUS = 0.15;

// Drop shadow behind unboxed text, same reasoning: multiples of font size.
export const TEXT_LAYER_SHADOW_BLUR = 0.12;
export const TEXT_LAYER_SHADOW_OFFSET_Y = 0.03;
export const TEXT_LAYER_SHADOW_COLOR = "rgba(0,0,0,0.4)";

export type StickerLayer = BaseLayer & {
  kind: "sticker";
  assetUrl: string;
};

// A sticker's unscaled width, as a fraction of the media width. layer.scale
// multiplies on top of this. Shared so the on-screen <img> and the canvas bake
// agree — the bake already assumed 0.25 while nothing rendered it on screen.
export const STICKER_LAYER_WIDTH_FRACTION = 0.25;

export type DrawStroke = {
  points: [number, number][]; // 0-1 fractional coords, same convention as BaseLayer.x/y
  color: string;
  width: number; // 0-1 fraction of media width, scaled up at bake time
  glow?: boolean; // neon brush — renders a coloured bloom around the stroke
};

export type DrawLayer = BaseLayer & {
  kind: "draw";
  strokes: DrawStroke[];
};

export type Layer = TextLayer | StickerLayer | DrawLayer;

export type AfterShotLayersContextValue = {
  layers: Layer[];
  addLayer: (layer: Layer) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
};

export const AfterShotLayersContext = createContext<AfterShotLayersContextValue | null>(null);

export function useAfterShotLayers() {
  const ctx = useContext(AfterShotLayersContext);
  if (!ctx) throw new Error("useAfterShotLayers must be used within /create/after-shot");
  return ctx;
}

// Provider logic lives here too (not just the context), so any route can
// mount <AfterShotLayersProvider> without duplicating this state hookup —
// mirrors how simple after-shot-context.ts's shape is, just with array ops
// instead of a single media setter.
export function useAfterShotLayersState(): AfterShotLayersContextValue {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const addLayer = useCallback((layer: Layer) => {
    setLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  }, []);

  const updateLayer = useCallback((id: string, patch: Partial<Layer>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)));
  }, []);

  const removeLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setSelectedLayerId((cur) => (cur === id ? null : cur));
  }, []);

  return { layers, addLayer, updateLayer, removeLayer, selectedLayerId, setSelectedLayerId };
}
