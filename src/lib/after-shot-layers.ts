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
  fontSize: number;
  align: "left" | "center" | "right";
  boxColor: string | null; // null = no background box
  bold: boolean; // currently always false — no UI control for it yet
};

export type StickerLayer = BaseLayer & {
  kind: "sticker";
  assetUrl: string;
};

export type DrawStroke = {
  points: [number, number][]; // 0-1 fractional coords, same convention as BaseLayer.x/y
  color: string;
  width: number; // 0-1 fraction of media width, scaled up at bake time
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
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
    );
  }, []);

  const removeLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setSelectedLayerId((cur) => (cur === id ? null : cur));
  }, []);

  return { layers, addLayer, updateLayer, removeLayer, selectedLayerId, setSelectedLayerId };
}