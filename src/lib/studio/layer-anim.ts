// Entrance animations for captions and stickers.
//
// A caption that is simply there on the first frame reads as a subtitle; one
// that pops or types itself on reads as part of the edit. Each preset is an
// entrance only — how the layer arrives over its first moments — and is
// expressed as a change to fields the layer already has (scale, y, the text
// itself), so the after-shot renderer and layer-bake.ts draw it without
// learning anything new.
//
// One function for preview and export, so what plays in the editor is what's
// in the file. The preview only animates while playing: a paused frame shows
// the layer at rest, so dragging it on the preview edits its real position,
// never a mid-animation one.

import type { TimedLayer } from "./types";

export type LayerAnim = "pop" | "slide" | "typewriter";

export const LAYER_ANIMS: { id: LayerAnim | "none"; label: string; textOnly?: boolean }[] = [
  { id: "none", label: "None" },
  { id: "pop", label: "Pop" },
  { id: "slide", label: "Slide up" },
  { id: "typewriter", label: "Typewriter", textOnly: true },
];

/** How long an entrance takes, capped so a short caption still settles. */
const ENTRANCE = 0.35;
const TYPE_MAX = 1.2;

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function easeOutCubic(x: number): number {
  return 1 - (1 - x) ** 3;
}

/** The layer as drawn at timeline time `t`. Returns the same object when
 *  there's nothing to animate, so callers can cheaply tell. */
export function animateLayer(layer: TimedLayer, t: number): TimedLayer {
  const anim = layer.anim;
  if (!anim) return layer;
  const length = layer.endTime - layer.startTime;
  const elapsed = t - layer.startTime;
  if (elapsed < 0) return layer;

  if (anim === "typewriter") {
    if (layer.kind !== "text") return layer;
    const span = Math.min(TYPE_MAX, length * 0.4);
    if (elapsed >= span || span <= 0) return layer;
    const chars = Array.from(layer.content);
    const shown = Math.ceil((elapsed / span) * chars.length);
    return { ...layer, content: chars.slice(0, Math.max(1, shown)).join("") };
  }

  const span = Math.min(ENTRANCE, length * 0.4);
  if (elapsed >= span || span <= 0) return layer;
  const progress = elapsed / span;

  if (anim === "pop") {
    // Overshoots a touch past full size before settling — that's the "pop".
    return { ...layer, scale: layer.scale * Math.max(0.05, easeOutBack(progress)) };
  }
  // Slide: rises a tenth of the frame into place.
  return { ...layer, y: layer.y + 0.1 * (1 - easeOutCubic(progress)) };
}
