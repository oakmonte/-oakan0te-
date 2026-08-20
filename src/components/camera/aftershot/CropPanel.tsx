import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X, Check, RotateCcw } from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import { cropPhotoBlob, cropVideoBlob, type CropRect } from "@/lib/crop-media";

type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e";

const ASPECT_PRESETS: { id: string; label: string; aspect: number | null }[] = [
  { id: "free", label: "Free", aspect: null },
  { id: "1:1", label: "1:1", aspect: 1 },
  { id: "4:5", label: "4:5", aspect: 4 / 5 },
  { id: "3:4", label: "3:4", aspect: 3 / 4 },
  { id: "9:16", label: "9:16", aspect: 9 / 16 },
  { id: "16:9", label: "16:9", aspect: 16 / 9 },
];

const CORNER_SIZE = 26;
const EDGE_THICKNESS = 24;
const MIN_CROP = 44;

type Rect = { x: number; y: number; w: number; h: number };

function centeredRect(boxW: number, boxH: number, aspect: number | null): Rect {
  if (boxW <= 0 || boxH <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  if (aspect === null) return { x: 0, y: 0, w: boxW, h: boxH };
  const boxAspect = boxW / boxH;
  let w: number;
  let h: number;
  if (aspect > boxAspect) {
    w = boxW;
    h = w / aspect;
  } else {
    h = boxH;
    w = h * aspect;
  }
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

// Resize from an edge or a corner. The previous version only had corners, and it
// derived height from width alone whenever an aspect was locked — so dragging a
// corner vertically did nothing at all. Here the aspect is satisfied by taking
// whichever axis the finger moved furthest on, then the result is clamped inside
// the box without letting the clamp break the ratio.
function resizeRect(
  start: Rect,
  handle: Handle,
  px: number,
  py: number,
  aspect: number | null,
  boxW: number,
  boxH: number,
): Rect {
  const touchesN = handle.includes("n");
  const touchesS = handle.includes("s");
  const touchesW = handle.includes("w");
  const touchesE = handle.includes("e");

  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;

  const cx = Math.max(0, Math.min(boxW, px));
  const cy = Math.max(0, Math.min(boxH, py));

  if (touchesW) left = Math.min(cx, right - MIN_CROP);
  if (touchesE) right = Math.max(cx, left + MIN_CROP);
  if (touchesN) top = Math.min(cy, bottom - MIN_CROP);
  if (touchesS) bottom = Math.max(cy, top + MIN_CROP);

  let w = right - left;
  let h = bottom - top;

  if (aspect !== null) {
    // Anchor is the side (or corner) opposite the one being dragged.
    const anchorX = touchesW ? right : left;
    const anchorY = touchesN ? bottom : top;

    // Drive from whichever axis this handle actually controls; corners use the
    // larger implied size so the crop tracks the finger on both axes.
    const fromW = w;
    const fromH = h * aspect;
    let targetW: number;
    if (touchesW || touchesE) {
      targetW = touchesN || touchesS ? Math.max(fromW, fromH) : fromW;
    } else {
      targetW = fromH;
    }
    let targetH = targetW / aspect;

    // Clamp against the box, preserving the ratio.
    const maxW = touchesW ? anchorX : boxW - anchorX;
    const maxH = touchesN ? anchorY : boxH - anchorY;
    if (targetW > maxW) {
      targetW = maxW;
      targetH = targetW / aspect;
    }
    if (targetH > maxH) {
      targetH = maxH;
      targetW = targetH * aspect;
    }
    targetW = Math.max(MIN_CROP, targetW);
    targetH = Math.max(MIN_CROP / aspect, targetH);

    left = touchesW ? anchorX - targetW : anchorX;
    top = touchesN ? anchorY - targetH : anchorY;
    w = targetW;
    h = targetH;
  }

  // Final containment.
  left = Math.max(0, Math.min(left, boxW - w));
  top = Math.max(0, Math.min(top, boxH - h));
  return { x: left, y: top, w, h };
}

type CropPanelProps = {
  open: boolean;
  // The after-shot page's own mounted media box — same element Crop draws
  // its overlay on top of, same pattern TextPanel takes a containerRef for.
  containerRef: React.RefObject<HTMLDivElement | null>;
  // Owned by the after-shot page (from its own real <img onLoad>/<video
  // onLoadedMetadata>) and passed down — CropPanel no longer probes for
  // this itself.
  naturalSize: { w: number; h: number } | null;
  onClose: () => void;
};

export default function CropPanel({ open, containerRef, naturalSize, onClose }: CropPanelProps) {
  const { media, setMedia } = useAfterShotContext();

  // Position AND size of the media box in viewport coordinates. CropPanel renders
  // as a sibling of that box (not a child), so its controls can anchor to the
  // screen while the crop surface still lines up exactly with the media.
  const [boxRect, setBoxRect] = useState<{
    left: number;
    top: number;
    w: number;
    h: number;
  } | null>(null);
  // Deliberately read boxRect.w/.h at each use site rather than deriving a
  // { w, h } object: a fresh object every render would give every callback that
  // depends on it a new identity, re-subscribing the window pointer listeners on
  // every single frame of a drag.
  const [aspectId, setAspectId] = useState("free");
  const [rect, setRect] = useState<Rect | null>(null);

  const dragRef = useRef<
    | { mode: "move"; startX: number; startY: number; startRect: Rect }
    | { mode: "resize"; handle: Handle; startRect: Rect }
    | null
  >(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reads size off containerRef (the PARENT's media box) instead of a
  // box this component owns — same media element the whole after-shot
  // page shares, not a second copy rendered just for cropping.
  useEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBoxRect({ left: r.left, top: r.top, w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [open, containerRef]);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    if (!boxRect || rect) return;
    setRect(centeredRect(boxRect.w, boxRect.h, null));
  }, [open, boxRect, rect]);

  const applyAspect = useCallback(
    (id: string) => {
      setAspectId(id);
      if (!boxRect) return;
      const preset = ASPECT_PRESETS.find((p) => p.id === id);
      setRect(centeredRect(boxRect.w, boxRect.h, preset?.aspect ?? null));
    },
    [boxRect],
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      const el = containerRef.current;
      if (!drag || !el || !boxRect) return;
      const b = el.getBoundingClientRect();
      const px = clientX - b.left;
      const py = clientY - b.top;
      const aspect = ASPECT_PRESETS.find((p) => p.id === aspectId)?.aspect ?? null;

      if (drag.mode === "resize") {
        // Resize from the rect as it was when the gesture STARTED. Feeding the
        // live rect back in made every move compound the last one, so the crop
        // accelerated away from the finger.
        setRect(resizeRect(drag.startRect, drag.handle, px, py, aspect, boxRect.w, boxRect.h));
      } else {
        const dx = clientX - drag.startX;
        const dy = clientY - drag.startY;
        setRect({
          ...drag.startRect,
          x: Math.max(0, Math.min(boxRect.w - drag.startRect.w, drag.startRect.x + dx)),
          y: Math.max(0, Math.min(boxRect.h - drag.startRect.h, drag.startRect.y + dy)),
        });
      }
    },
    [containerRef, boxRect, aspectId],
  );

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX, e.clientY);
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [open, handlePointerMove]);

  const startMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!rect) return;
      e.stopPropagation();
      dragRef.current = { mode: "move", startX: e.clientX, startY: e.clientY, startRect: rect };
    },
    [rect],
  );

  const startResize = useCallback(
    (handle: Handle) => (e: ReactPointerEvent) => {
      if (!rect) return;
      e.stopPropagation();
      dragRef.current = { mode: "resize", handle, startRect: rect };
    },
    [rect],
  );

  const resetRect = useCallback(() => {
    if (!boxRect) return;
    const aspect = ASPECT_PRESETS.find((p) => p.id === aspectId)?.aspect ?? null;
    setRect(centeredRect(boxRect.w, boxRect.h, aspect));
  }, [boxRect, aspectId]);

  const handleCancel = useCallback(() => {
    setRect(null);
    setAspectId("free");
    setBusy(false);
    setProgress(0);
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    if (!rect || !boxRect || !naturalSize) return;
    setBusy(true);
    setProgress(0);
    try {
      // Scale per axis. A single width-derived scale silently assumed the media
      // box's aspect exactly equals the source's — true today, but it produced a
      // wrong crop the moment they diverged by even a rounding pixel.
      const scaleX = naturalSize.w / boxRect.w;
      const scaleY = naturalSize.h / boxRect.h;
      const natural: CropRect = {
        x: Math.round(rect.x * scaleX),
        y: Math.round(rect.y * scaleY),
        w: Math.round(rect.w * scaleX),
        h: Math.round(rect.h * scaleY),
      };
      const croppedBlob =
        media.type === "photo"
          ? await cropPhotoBlob(media.blob, natural)
          : await cropVideoBlob(media.blob, natural, setProgress);
      const url = URL.createObjectURL(croppedBlob);
      setMedia(
        media.type === "photo"
          ? { type: "photo", blob: croppedBlob, url }
          : { type: "video", blob: croppedBlob, url },
      );
      setRect(null);
      setAspectId("free");
      setBusy(false);
      onClose();
    } catch (err) {
      console.error("Crop failed:", err);
      setBusy(false);
    }
  }, [rect, boxRect, naturalSize, media, setMedia, onClose]);

  if (!open) return null;

  const corners: Handle[] = ["nw", "ne", "sw", "se"];
  const edges: Handle[] = ["n", "s", "w", "e"];

  return (
    <>
      {/* The crop surface is its own absolutely-positioned layer covering the
          media box exactly. It used to be a flex child BELOW the header, while
          the rect's numbers were measured against the full box — so the frame
          rendered offset downward and squashed, and its 9999px dimming shadow
          painted straight over the header buttons. Controls are now overlays on
          top of this surface rather than siblings that steal its height. */}
      <div
        className="oak-motion-fade absolute z-40"
        style={{
          left: boxRect?.left ?? 0,
          top: boxRect?.top ?? 0,
          width: boxRect?.w ?? 0,
          height: boxRect?.h ?? 0,
          touchAction: "none",
        }}
      >
        {rect && boxRect && (
          <div
            onPointerDown={startMove}
            className="absolute"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.h,
              outline: "1.5px solid #fff",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              cursor: "move",
              touchAction: "none",
            }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.45 }}>
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
            </div>

            {/* Edge handles — dragging a side is the most common crop gesture and
                there was no way to do it before. */}
            {edges.map((edge) => {
              const horizontal = edge === "n" || edge === "s";
              return (
                <div
                  key={edge}
                  onPointerDown={startResize(edge)}
                  aria-label={`Crop ${edge} edge`}
                  className="absolute"
                  style={{
                    left: horizontal ? EDGE_THICKNESS : edge === "w" ? -EDGE_THICKNESS / 2 : "auto",
                    right: horizontal
                      ? EDGE_THICKNESS
                      : edge === "e"
                        ? -EDGE_THICKNESS / 2
                        : "auto",
                    top: !horizontal ? EDGE_THICKNESS : edge === "n" ? -EDGE_THICKNESS / 2 : "auto",
                    bottom: !horizontal
                      ? EDGE_THICKNESS
                      : edge === "s"
                        ? -EDGE_THICKNESS / 2
                        : "auto",
                    height: horizontal ? EDGE_THICKNESS : "auto",
                    width: horizontal ? "auto" : EDGE_THICKNESS,
                    cursor: horizontal ? "ns-resize" : "ew-resize",
                    touchAction: "none",
                  }}
                />
              );
            })}

            {corners.map((corner) => (
              <div
                key={corner}
                onPointerDown={startResize(corner)}
                aria-label={`Crop ${corner} corner`}
                className="absolute flex items-center justify-center"
                style={{
                  width: CORNER_SIZE,
                  height: CORNER_SIZE,
                  top: corner[0] === "n" ? -CORNER_SIZE / 2 : "auto",
                  bottom: corner[0] === "s" ? -CORNER_SIZE / 2 : "auto",
                  left: corner[1] === "w" ? -CORNER_SIZE / 2 : "auto",
                  right: corner[1] === "e" ? -CORNER_SIZE / 2 : "auto",
                  cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
                  touchAction: "none",
                }}
              >
                {/* An L-bracket rather than a dot — it reads as a corner and
                    doesn't hide the pixels you're trying to frame. */}
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderTop: corner[0] === "n" ? "3px solid #fff" : "none",
                    borderBottom: corner[0] === "s" ? "3px solid #fff" : "none",
                    borderLeft: corner[1] === "w" ? "3px solid #fff" : "none",
                    borderRight: corner[1] === "e" ? "3px solid #fff" : "none",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {busy && (
          <div className="oak-motion-fade absolute inset-0 flex items-center justify-center bg-black/70 z-30">
            <span className="text-sm uppercase tracking-widest text-white">
              {media.type === "video" ? `Cropping… ${Math.round(progress * 100)}%` : "Cropping…"}
            </span>
          </div>
        )}
      </div>

      {/* Controls sit above the dimming, anchored to the SCREEN rather than to
          the media box, so they stay reachable on media of any shape. */}
      <div
        className="oak-motion-enter absolute left-0 right-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-50"
        style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
      >
        <button
          onClick={handleCancel}
          aria-label="Cancel crop"
          disabled={busy}
          className="oak-motion-control flex items-center justify-center w-10 h-10 rounded-full active:scale-90"
          style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)" }}
        >
          <X size={20} color="#fff" />
        </button>
        <button
          onClick={resetRect}
          aria-label="Reset crop"
          disabled={busy}
          className="oak-motion-control flex items-center justify-center w-10 h-10 rounded-full active:scale-90"
          style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)" }}
        >
          <RotateCcw size={18} color="#fff" />
        </button>
        <button
          onClick={handleConfirm}
          aria-label="Confirm crop"
          disabled={busy || !rect}
          className="oak-motion-control flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 active:scale-90"
          style={{ background: "#fff", color: "#000" }}
        >
          <Check size={20} />
        </button>
      </div>

      <div
        className="oak-motion-enter oak-crop-presets absolute left-0 right-0 bottom-0 flex items-center gap-3 overflow-x-auto px-5 z-50"
        style={{
          paddingTop: 16,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
          scrollbarWidth: "none",
          fontFamily: "'SF Pro', system-ui, sans-serif",
        }}
      >
        <style>{`.oak-crop-presets::-webkit-scrollbar { display: none; }`}</style>
        {ASPECT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyAspect(preset.id)}
            aria-pressed={aspectId === preset.id}
            className="oak-motion-control shrink-0 px-4 py-2 rounded-full text-xs font-medium active:scale-95"
            style={{
              background: aspectId === preset.id ? "#fff" : "rgba(255,255,255,0.15)",
              color: aspectId === preset.id ? "#000" : "#fff",
              backdropFilter: aspectId === preset.id ? undefined : "blur(12px)",
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </>
  );
}
