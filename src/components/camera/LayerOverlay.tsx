import { useCallback, useRef } from "react";
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
};

const HANDLE_SIZE = 22;
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

export default function LayerOverlay({
  containerRef,
  layers,
  updateLayer,
  selectedLayerId,
  setSelectedLayerId,
  renderLayerContent,
  onLayerTap,
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
          scale: Math.max(0.15, Math.min(8, drag.startScale * scaleFactor)),
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
          scale: Math.max(0.2, Math.min(5, drag.startScale * scaleFactor)),
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
        .map((layer) => {
          const isSelected = layer.id === selectedLayerId;
          return (
            <div
              key={layer.id}
              onPointerDown={startMove(layer)}
              className="absolute"
              style={{
                left: `${layer.x * 100}%`,
                top: `${layer.y * 100}%`,
                transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
                touchAction: "none",
                cursor: "move",
                outline: isSelected ? "1.5px dashed rgba(255,255,255,0.8)" : "none",
                outlineOffset: 6,
              }}
            >
              {renderLayerContent(layer)}

              {isSelected && (
                <div
                  onPointerDown={startTransform(layer)}
                  className="absolute rounded-full"
                  style={{
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    right: -HANDLE_SIZE / 2,
                    bottom: -HANDLE_SIZE / 2,
                    background: "#fff",
                    border: "2px solid #000",
                    cursor: "nwse-resize",
                    touchAction: "none",
                  }}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}
