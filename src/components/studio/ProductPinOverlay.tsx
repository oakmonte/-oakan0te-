import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  PIN_BG,
  PIN_DOT_RADIUS,
  PIN_FONT_STACK,
  PIN_GAP,
  PIN_PILL_HEIGHT,
  PIN_PILL_PAD_X,
  PIN_PILL_RADIUS,
  PIN_PRICE_SIZE,
  PIN_TITLE_SIZE,
  pinAppearance,
} from "@/lib/studio/render";
import type { ProductPin } from "@/lib/studio/types";

// The on-screen half of the shoppable tag. Every dimension is the same fraction
// of frame width that drawPins() bakes with, so what you drag into place is
// what ends up in the file — the after-shot layer system's convention, applied
// to a marketplace object.

type Props = {
  pins: ProductPin[];
  time: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<ProductPin>) => void;
};

export default function ProductPinOverlay({
  pins,
  time,
  containerRef,
  selectedId,
  onSelect,
  onUpdate,
}: Props) {
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    pinX: number;
    pinY: number;
  } | null>(null);

  const startDrag = useCallback(
    (pin: ProductPin) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      onSelect(pin.id);
      dragRef.current = {
        id: pin.id,
        startX: e.clientX,
        startY: e.clientY,
        pinX: pin.x,
        pinY: pin.y,
      };
    },
    [onSelect],
  );

  const handleMove = useCallback(
    (e: ReactPointerEvent) => {
      const drag = dragRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!drag || !rect) return;
      const x = Math.min(0.94, Math.max(0.06, drag.pinX + (e.clientX - drag.startX) / rect.width));
      const y = Math.min(0.94, Math.max(0.06, drag.pinY + (e.clientY - drag.startY) / rect.height));
      // Flip the pill to whichever side has room, so dragging a tag to the right
      // edge doesn't push it off frame.
      onUpdate(drag.id, { x, y, side: x > 0.55 ? "left" : "right" });
    },
    [containerRef, onUpdate],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  const boxWidth = containerRef.current?.clientWidth ?? 0;
  if (boxWidth === 0) return null;

  const visible = pins.filter((p) => time >= p.startTime && time <= p.endTime);
  if (visible.length === 0) return null;

  const dot = PIN_DOT_RADIUS * boxWidth;
  const pillH = PIN_PILL_HEIGHT * boxWidth;
  const padX = PIN_PILL_PAD_X * boxWidth;
  const gap = PIN_GAP * boxWidth;

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 12 }}
      onPointerMove={handleMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      {visible.map((pin) => {
        const appear = pinAppearance(pin, time);
        const isSelected = pin.id === selectedId;
        return (
          <div
            key={pin.id}
            onPointerDown={startDrag(pin)}
            className="absolute"
            style={{
              left: `${pin.x * 100}%`,
              top: `${pin.y * 100}%`,
              transform: `translate(-50%, -50%) scale(${appear.scale})`,
              opacity: appear.opacity,
              touchAction: "none",
            }}
          >
            <div
              className="rounded-full"
              style={{
                width: dot * 2,
                height: dot * 2,
                background: "#fff",
                boxShadow: `0 0 0 ${dot * 0.9}px rgba(255,255,255,0.28)`,
                outline: isSelected ? "1.5px dashed rgba(255,255,255,0.9)" : "none",
                outlineOffset: dot,
              }}
            />
            <div
              className="absolute flex flex-col justify-center whitespace-nowrap"
              style={{
                top: "50%",
                [pin.side === "right" ? "left" : "right"]: dot + gap,
                transform: "translateY(-50%)",
                height: pillH,
                padding: `0 ${padX}px`,
                background: PIN_BG,
                borderRadius: PIN_PILL_RADIUS * boxWidth,
                fontFamily: PIN_FONT_STACK,
              }}
            >
              <span
                style={{
                  fontSize: PIN_TITLE_SIZE * boxWidth,
                  fontWeight: 600,
                  color: "#fff",
                  lineHeight: 1.15,
                }}
              >
                {pin.title}
              </span>
              {pin.price && (
                <span
                  style={{
                    fontSize: PIN_PRICE_SIZE * boxWidth,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.72)",
                    lineHeight: 1.15,
                  }}
                >
                  {pin.price}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
