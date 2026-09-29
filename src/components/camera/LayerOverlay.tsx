import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { X, MoveDiagonal2 } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Layer } from "@/lib/after-shot-layers";

// Fully controlled by props instead of reading AfterShotLayersContext
// directly — this is what lets a single-layer draft screen (Text) and the
// real multi-layer shared stack both use the exact same drag/scale/rotate
// component without any context-shadowing tricks.
//
// IMPORTANT: containerRef is only ever READ here (via getContainerRect()),
// never attached as this component's own DOM ref. This component is
// conditionally mounted (only when activeTool === null on the after-shot
// page), and attaching containerRef to its own div would reassign the
// SHARED mediaBoxRef to point at this div, then null it out on unmount —
// breaking CropPanel/DrawPanel's containerRef.current reads while a tool
// is actually open. containerRef must keep pointing at the page's real
// media box at all times.

type LayerOverlayProps = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  layers: Layer[];
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  renderLayerContent: (layer: Layer) => React.ReactNode;
  onLayerTap?: (layer: Layer) => void; // fires only for text layers — tap-to-edit
  onRemoveLayer?: (id: string) => void;
};

const HANDLE_SIZE = 22;
// One range for both ways of resizing. The corner handle stopped at 5x while a
// pinch went to 8x, so the handle ran out of travel before the layer did.
const MIN_SCALE = 0.15;
const MAX_SCALE = 8;
const TAP_MOVE_THRESHOLD = 6; // px — below this, a pointer down+up counts as a tap, not a drag

type DragState =
  | {
      mode: "move";
      id: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
    }
  | {
      mode: "transform";
      id: string;
      centerClientX: number;
      centerClientY: number;
      startScale: number;
      startRotation: number;
      startDistance: number;
      startAngle: number;
    }
  | {
      // Two fingers on the layer itself. Distinct from "transform" (the corner
      // handle) because a pinch has no fixed anchor: the layer also follows the
      // midpoint between the fingers, so you can move, scale and rotate in one
      // gesture the way every other photo editor behaves.
      mode: "pinch";
      id: string;
      startX: number;
      startY: number;
      startScale: number;
      startRotation: number;
      startDistance: number;
      startAngle: number;
      startCenterClientX: number;
      startCenterClientY: number;
    };

type PointerSample = { x: number; y: number };

function pinchGeometry(a: PointerSample, b: PointerSample) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    distance: Math.hypot(dx, dy),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    centerX: (a.x + b.x) / 2,
    centerY: (a.y + b.y) / 2,
  };
}

const DELETE_HANDLE_SIZE = 24;

export default function LayerOverlay({
  containerRef,
  layers,
  updateLayer,
  selectedLayerId,
  setSelectedLayerId,
  renderLayerContent,
  onLayerTap,
  onRemoveLayer,
}: LayerOverlayProps) {
  const dragRef = useRef<DragState | null>(null);
  const hasMovedRef = useRef(false);
  const tapLayerRef = useRef<Layer | null>(null);
  // Live pointers per layer, so a second finger landing on an already-dragging
  // layer can upgrade the gesture into a pinch instead of fighting it.
  const pointersRef = useRef<Map<number, PointerSample>>(new Map());

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, [containerRef]);

  const startMove = useCallback(
    (layer: Layer) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      setSelectedLayerId(layer.id);
      tapLayerRef.current = layer;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const pts = [...pointersRef.current.values()];
      if (pts.length >= 2) {
        // Second finger down — switch to pinch, anchored on the current state so
        // the layer doesn't jump at the moment the gesture changes.
        const g = pinchGeometry(pts[0], pts[1]);
        hasMovedRef.current = true; // a pinch is never a tap
        dragRef.current = {
          mode: "pinch",
          id: layer.id,
          startX: layer.x,
          startY: layer.y,
          startScale: layer.scale,
          startRotation: layer.rotation,
          startDistance: g.distance,
          startAngle: g.angle,
          startCenterClientX: g.centerX,
          startCenterClientY: g.centerY,
        };
        return;
      }

      hasMovedRef.current = false;
      dragRef.current = {
        mode: "move",
        id: layer.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: layer.x,
        startY: layer.y,
      };
    },
    [setSelectedLayerId],
  );

  const startTransform = useCallback(
    (layer: Layer) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      const rect = getContainerRect();
      if (!rect) return;
      const centerClientX = rect.left + layer.x * rect.width;
      const centerClientY = rect.top + layer.y * rect.height;
      const dx = e.clientX - centerClientX;
      const dy = e.clientY - centerClientY;
      dragRef.current = {
        mode: "transform",
        id: layer.id,
        centerClientX,
        centerClientY,
        startScale: layer.scale,
        startRotation: layer.rotation,
        startDistance: Math.hypot(dx, dy),
        startAngle: (Math.atan2(dy, dx) * 180) / Math.PI,
      };
    },
    [getContainerRect],
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number, pointerId?: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = getContainerRect();
      if (!rect) return;

      if (pointerId !== undefined && pointersRef.current.has(pointerId)) {
        pointersRef.current.set(pointerId, { x: clientX, y: clientY });
      }

      if (drag.mode === "pinch") {
        const pts = [...pointersRef.current.values()];
        if (pts.length < 2) return;
        const g = pinchGeometry(pts[0], pts[1]);
        const scaleFactor = drag.startDistance > 0 ? g.distance / drag.startDistance : 1;
        updateLayer(drag.id, {
          x: Math.min(
            1,
            Math.max(0, drag.startX + (g.centerX - drag.startCenterClientX) / rect.width),
          ),
          y: Math.min(
            1,
            Math.max(0, drag.startY + (g.centerY - drag.startCenterClientY) / rect.height),
          ),
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, drag.startScale * scaleFactor)),
          rotation: drag.startRotation + (g.angle - drag.startAngle),
        });
        return;
      }

      if (drag.mode === "move") {
        const pixelDist = Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY);
        if (pixelDist > TAP_MOVE_THRESHOLD) hasMovedRef.current = true;

        const dxFrac = (clientX - drag.startClientX) / rect.width;
        const dyFrac = (clientY - drag.startClientY) / rect.height;
        updateLayer(drag.id, {
          x: Math.min(1, Math.max(0, drag.startX + dxFrac)),
          y: Math.min(1, Math.max(0, drag.startY + dyFrac)),
        });
      } else {
        const dx = clientX - drag.centerClientX;
        const dy = clientY - drag.centerClientY;
        const distance = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const scaleFactor = drag.startDistance > 0 ? distance / drag.startDistance : 1;
        updateLayer(drag.id, {
          scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE, drag.startScale * scaleFactor)),
          rotation: drag.startRotation + (angle - drag.startAngle),
        });
      }
    },
    [getContainerRect, updateLayer],
  );

  const handlePointerUp = useCallback(
    (pointerId?: number) => {
      if (pointerId !== undefined) pointersRef.current.delete(pointerId);
      else pointersRef.current.clear();

      // Lifting one finger out of a pinch shouldn't end the gesture outright —
      // but the remaining finger's frame of reference is gone, so end it and let
      // a fresh press start a clean drag.
      if (dragRef.current?.mode === "pinch" && pointersRef.current.size > 0) {
        dragRef.current = null;
        tapLayerRef.current = null;
        return;
      }

      if (dragRef.current?.mode === "move" && !hasMovedRef.current && tapLayerRef.current) {
        const layer = tapLayerRef.current;
        if (layer.kind === "text" && onLayerTap) onLayerTap(layer);
      }
      dragRef.current = null;
      hasMovedRef.current = false;
      tapLayerRef.current = null;
    },
    [onLayerTap],
  );

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 10 }}
      onPointerMove={(e) => handlePointerMove(e.clientX, e.clientY, e.pointerId)}
      onPointerUp={(e) => handlePointerUp(e.pointerId)}
      onPointerCancel={(e) => handlePointerUp(e.pointerId)}
      onPointerLeave={() => handlePointerUp()}
      onPointerDown={() => setSelectedLayerId(null)}
    >
      {layers
        .slice()
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            isSelected={layer.id === selectedLayerId}
            renderLayerContent={renderLayerContent}
            onPointerDown={startMove(layer)}
            onRemove={onRemoveLayer}
            startTransform={startTransform}
          />
        ))}
    </div>
  );
}

// Everything below lives INSIDE the layer's scale() transform, so each size is
// divided by layer.scale to come out at a constant on-screen size. Without that
// the old dashed outline thickened and blurred as a caption was pinched up, and
// the handles ballooned with it.
const FRAME_PAD = 8; // on-screen px between the content and the frame
const FRAME_RADIUS = 10;

// A thin solid line with a faint dark halo — readable over a white shirt and a
// black one alike, which the translucent dashed line never was.
const FRAME_SHADOW = "0 0 0 0.5px rgba(0,0,0,0.28), 0 2px 10px rgba(0,0,0,0.22)";
const HANDLE_SHADOW = "0 1px 3px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(0,0,0,0.15)";

/** Where the visible content sits inside a layer's box, in the box's own
 *  unscaled px. */
type Bounds = { left: number; top: number; width: number; height: number };

/** The part of a layer you can actually see.
 *
 *  A caption's box is always 80% of the frame wide — it has to be, so it wraps
 *  where the bake wraps (see use-layer-renderer.tsx) — and a drawing's is the
 *  whole frame square. Outlining THAT put a frame far wider than a one-word
 *  caption, with the resize handle out near the screen edge, where there was
 *  no room left to drag it outward. The renderer marks the visible part with
 *  `data-layer-bounds`; null means the whole box is content (a sticker). */
function measureContent(box: HTMLElement): Bounds | null {
  const el = box.querySelector("[data-layer-bounds]");
  if (!el) return null;
  if (el instanceof SVGSVGElement) {
    let bb: DOMRect;
    try {
      bb = el.getBBox();
    } catch {
      return null;
    }
    if (bb.width === 0 && bb.height === 0) return null;
    const vb = el.viewBox.baseVal;
    const unit = vb.width ? el.width.baseVal.value / vb.width : 1;
    // getBBox leaves out stroke width, and a thick pen stroke would poke out
    // of a frame drawn tight to its centre line.
    const stroke = Number(el.dataset.strokePad ?? 0);
    return {
      left: (bb.x - vb.x) * unit - stroke,
      top: (bb.y - vb.y) * unit - stroke,
      width: bb.width * unit + stroke * 2,
      height: bb.height * unit + stroke * 2,
    };
  }
  if (el instanceof HTMLElement) {
    return {
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    };
  }
  return null;
}

function sameBounds(a: Bounds | null, b: Bounds | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/** Position a box at `bounds` grown by `grow` on every side, or fill the
 *  layer's box when there is nothing narrower to hug. */
function around(bounds: Bounds | null, grow: number): React.CSSProperties {
  if (!bounds) return { inset: -grow };
  return {
    left: bounds.left - grow,
    top: bounds.top - grow,
    width: bounds.width + grow * 2,
    height: bounds.height + grow * 2,
  };
}

function LayerItem({
  layer,
  isSelected,
  renderLayerContent,
  onPointerDown,
  onRemove,
  startTransform,
}: {
  layer: Layer;
  isSelected: boolean;
  renderLayerContent: (layer: Layer) => React.ReactNode;
  onPointerDown: (e: ReactPointerEvent) => void;
  onRemove?: (id: string) => void;
  startTransform: (layer: Layer) => (e: ReactPointerEvent) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);

  // Whenever the layer changes (text, font, box) and whenever the content
  // resizes on its own — a web font landing after first paint
  // reflows the caption without React hearing about it.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const next = measureContent(box);
    setBounds((prev) => (sameBounds(prev, next) ? prev : next));
  }, [layer, renderLayerContent]);
  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = box?.querySelector("[data-layer-bounds]");
    if (!box || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const next = measureContent(box);
      setBounds((prev) => (sameBounds(prev, next) ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [layer.kind]);

  const k = 1 / (layer.scale || 1);

  return (
    <div
      ref={boxRef}
      className="absolute"
      style={{
        left: `${layer.x * 100}%`,
        top: `${layer.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
        // The box itself takes no touches; only the hit area over the visible
        // content does. Otherwise a tap on empty picture beside a short
        // caption — or anywhere at all over a drawing — grabbed the layer.
        pointerEvents: "none",
      }}
    >
      {renderLayerContent(layer)}

      <div
        onPointerDown={onPointerDown}
        className="absolute"
        style={{
          ...around(bounds, FRAME_PAD * k),
          pointerEvents: "auto",
          touchAction: "none",
          cursor: "move",
        }}
      />

      {isSelected && (
        <SelectionFrame
          layer={layer}
          bounds={bounds}
          onRemove={onRemove}
          startTransform={startTransform}
        />
      )}
    </div>
  );
}

function SelectionFrame({
  layer,
  bounds,
  onRemove,
  startTransform,
}: {
  layer: Layer;
  bounds: Bounds | null;
  onRemove?: (id: string) => void;
  startTransform: (layer: Layer) => (e: ReactPointerEvent) => void;
}) {
  const k = 1 / (layer.scale || 1);
  const pad = FRAME_PAD * k;
  // Corners of the frame, in the layer box's own coordinates.
  const frame = around(bounds, pad);

  // A corner anchor is a zero-size point ON the frame line; the handle is
  // centred on it and counter-scaled, so it sits exactly on the corner at any
  // zoom instead of drifting off it.
  const corner = (pos: React.CSSProperties, child: React.ReactNode) => (
    <div className="absolute" style={{ ...pos, width: 0, height: 0 }}>
      <div
        className="absolute"
        style={{ left: 0, top: 0, transform: `translate(-50%, -50%) scale(${k})` }}
      >
        {child}
      </div>
    </div>
  );

  return (
    <>
      <div
        className="oak-motion-fade absolute pointer-events-none"
        style={{
          ...frame,
          borderRadius: FRAME_RADIUS * k,
          border: `${1.5 * k}px solid rgba(255,255,255,0.95)`,
          boxShadow: FRAME_SHADOW,
        }}
      />

      {onRemove &&
        corner(
          bounds ? { left: frame.left, top: frame.top } : { left: -pad, top: -pad },
          <button
            type="button"
            aria-label="Delete layer"
            // Stops propagation so the tap doesn't also re-drag or deselect
            // before the layer is gone.
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(layer.id);
            }}
            // oak-hit: drawn small so it doesn't hide the caption, grabbed
            // at a full 44px so it doesn't take three tries.
            className="oak-hit oak-motion-control flex items-center justify-center rounded-full active:scale-90"
            style={{
              width: DELETE_HANDLE_SIZE,
              height: DELETE_HANDLE_SIZE,
              background: "#fff",
              boxShadow: HANDLE_SHADOW,
              touchAction: "none",
              pointerEvents: "auto",
            }}
          >
            <X size={12} strokeWidth={2.75} color="#111" />
          </button>,
        )}

      {/* Scale / rotate handle — bottom-right corner */}
      {corner(
        bounds
          ? {
              left: bounds.left + bounds.width + pad,
              top: bounds.top + bounds.height + pad,
            }
          : { right: -pad, bottom: -pad },
        <div
          onPointerDown={startTransform(layer)}
          className="oak-hit flex items-center justify-center rounded-full"
          style={{
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: "#fff",
            boxShadow: HANDLE_SHADOW,
            cursor: "nwse-resize",
            touchAction: "none",
            pointerEvents: "auto",
          }}
        >
          <MoveDiagonal2 size={12} strokeWidth={2.5} color="#111" />
        </div>,
      )}
    </>
  );
}
