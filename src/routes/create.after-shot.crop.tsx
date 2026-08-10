import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { X, Check } from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import { cropPhotoBlob, cropVideoBlob, type CropRect } from "@/lib/crop-media";

export const Route = createFileRoute("/create/after-shot/crop")({
  head: () => ({ meta: [{ title: "Crop — Oakmonte" }] }),
  component: CropPage,
});

type Corner = "nw" | "ne" | "sw" | "se";

const ASPECT_PRESETS: { id: string; label: string; aspect: number | null }[] = [
  { id: "free", label: "Free", aspect: null },
  { id: "1:1", label: "1:1", aspect: 1 },
  { id: "4:5", label: "4:5", aspect: 4 / 5 },
  { id: "3:4", label: "3:4", aspect: 3 / 4 },
  { id: "9:16", label: "9:16", aspect: 9 / 16 },
  { id: "16:9", label: "16:9", aspect: 16 / 9 },
];

const HANDLE_SIZE = 22;
const MIN_CROP = 48; // px, in displayed (not natural) coordinates

function centeredRect(boxW: number, boxH: number, aspect: number | null) {
  if (boxW <= 0 || boxH <= 0) return { x: 0, y: 0, w: boxW, h: boxH };
  if (aspect === null) return { x: 0, y: 0, w: boxW, h: boxH };
  const boxAspect = boxW / boxH;
  let w: number, h: number;
  if (aspect > boxAspect) {
    w = boxW;
    h = w / aspect;
  } else {
    h = boxH;
    w = h * aspect;
  }
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

// Resizes from one corner while the opposite corner stays fixed as the
// anchor. When `aspect` is set, width leads and height follows, then both
// get clamped back down if there isn't enough room between the anchor and
// the image edge.
function resizeFromCorner(
  rect: { x: number; y: number; w: number; h: number },
  corner: Corner,
  px: number,
  py: number,
  aspect: number | null,
  boxW: number,
  boxH: number,
) {
  const vertical = corner[0] as "n" | "s";
  const horizontal = corner[1] as "w" | "e";

  const anchorX = horizontal === "w" ? rect.x + rect.w : rect.x;
  const anchorY = vertical === "n" ? rect.y + rect.h : rect.y;

  const clampedPx = Math.max(0, Math.min(boxW, px));
  const clampedPy = Math.max(0, Math.min(boxH, py));

  let w = Math.max(MIN_CROP, Math.abs(clampedPx - anchorX));
  let h = Math.max(MIN_CROP, Math.abs(clampedPy - anchorY));

  if (aspect !== null) h = w / aspect;

  const maxW = horizontal === "w" ? anchorX : boxW - anchorX;
  const maxH = vertical === "n" ? anchorY : boxH - anchorY;
  if (w > maxW) {
    w = maxW;
    if (aspect !== null) h = w / aspect;
  }
  if (h > maxH) {
    h = maxH;
    if (aspect !== null) w = h * aspect;
  }

  const x = horizontal === "w" ? anchorX - w : anchorX;
  const y = vertical === "n" ? anchorY - h : anchorY;

  return { x, y, w, h };
}

function CropPage() {
  const navigate = useNavigate();
  const { media, setMedia } = useAfterShotContext();
  const boxRef = useRef<HTMLDivElement>(null);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null);
  const [aspectId, setAspectId] = useState("free");
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const dragRef = useRef<
    | { mode: "move"; startX: number; startY: number; startRect: { x: number; y: number; w: number; h: number } }
    | { mode: "resize"; corner: Corner }
    | null
  >(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // Seeds the crop rect at "Free" (the full frame) as soon as the box has a
  // real size — nothing is cropped until the user actually adjusts something.
  useEffect(() => {
    if (!boxSize || rect) return;
    setRect(centeredRect(boxSize.w, boxSize.h, null));
  }, [boxSize, rect]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setBoxSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyAspect = useCallback(
    (id: string) => {
      setAspectId(id);
      if (!boxSize) return;
      const preset = ASPECT_PRESETS.find((p) => p.id === id);
      setRect(centeredRect(boxSize.w, boxSize.h, preset?.aspect ?? null));
    },
    [boxSize],
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      const el = boxRef.current;
      if (!drag || !el || !rect || !boxSize) return;
      const b = el.getBoundingClientRect();
      const px = clientX - b.left;
      const py = clientY - b.top;
      const preset = ASPECT_PRESETS.find((p) => p.id === aspectId);
      const aspect = preset?.aspect ?? null;

      if (drag.mode === "resize") {
        setRect(resizeFromCorner(rect, drag.corner, px, py, aspect, boxSize.w, boxSize.h));
      } else {
        const dx = clientX - drag.startX;
        const dy = clientY - drag.startY;
        const x = Math.max(0, Math.min(boxSize.w - drag.startRect.w, drag.startRect.x + dx));
        const y = Math.max(0, Math.min(boxSize.h - drag.startRect.h, drag.startRect.y + dy));
        setRect({ ...drag.startRect, x, y });
      }
    },
    [rect, boxSize, aspectId],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX, e.clientY);
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [handlePointerMove]);

  const startMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!rect) return;
      dragRef.current = { mode: "move", startX: e.clientX, startY: e.clientY, startRect: rect };
    },
    [rect],
  );

  const startResize = useCallback(
    (corner: Corner) => (e: ReactPointerEvent) => {
      e.stopPropagation();
      dragRef.current = { mode: "resize", corner };
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (!rect || !boxSize || !naturalSize) return;
    setBusy(true);
    setProgress(0);
    try {
      const scale = naturalSize.w / boxSize.w;
      const natural: CropRect = {
        x: rect.x * scale,
        y: rect.y * scale,
        w: rect.w * scale,
        h: rect.h * scale,
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
      navigate({ to: "/create/after-shot" });
    } catch (err) {
      console.error("Crop failed:", err);
      setBusy(false);
    }
  }, [rect, boxSize, naturalSize, media, setMedia, navigate]);

  const corners: Corner[] = ["nw", "ne", "sw", "se"];

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-20">
        <button
          onClick={() => navigate({ to: "/create/after-shot" })}
          aria-label="Cancel crop"
          disabled={busy}
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          <X size={20} />
        </button>
        <button
          onClick={handleConfirm}
          aria-label="Confirm crop"
          disabled={busy || !rect}
          className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 transition-transform duration-150 active:scale-90"
          style={{ background: "#fff", color: "#000" }}
        >
          <Check size={20} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-5">
        <div
          ref={boxRef}
          className="relative overflow-hidden"
          style={{
            width: "100%",
            maxHeight: "100%",
            aspectRatio: naturalSize ? String(naturalSize.w / naturalSize.h) : "9/16",
          }}
        >
          {media.type === "photo" ? (
            <img
              src={media.url}
              alt="Captured"
              onLoad={(e) => setNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <video
              src={media.url}
              autoPlay
              loop
              muted
              playsInline
              onLoadedMetadata={(e) =>
                setNaturalSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
              }
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {rect && (
            <div
              onPointerDown={startMove}
              className="absolute"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                outline: "2px solid #fff",
                // The huge spread is what dims everything OUTSIDE the crop
                // box — no second media element needed, just one shadow.
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                cursor: "move",
                touchAction: "none",
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.5 }}>
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
              </div>

              {corners.map((corner) => (
                <div
                  key={corner}
                  onPointerDown={startResize(corner)}
                  className="absolute"
                  style={{
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    top: corner[0] === "n" ? -HANDLE_SIZE / 2 : "auto",
                    bottom: corner[0] === "s" ? -HANDLE_SIZE / 2 : "auto",
                    left: corner[1] === "w" ? -HANDLE_SIZE / 2 : "auto",
                    right: corner[1] === "e" ? -HANDLE_SIZE / 2 : "auto",
                    cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
                    touchAction: "none",
                  }}
                >
                  <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#fff", border: "2px solid #000" }} />
                </div>
              ))}
            </div>
          )}

          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
              <span className="text-sm uppercase tracking-widest">
                {media.type === "video" ? `Cropping… ${Math.round(progress * 100)}%` : "Cropping…"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-3 overflow-x-auto px-5"
        style={{ paddingTop: 16, paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        {ASPECT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyAspect(preset.id)}
            className="shrink-0 px-4 py-2 rounded-full text-xs font-medium"
            style={{
              background: aspectId === preset.id ? "#fff" : "rgba(255,255,255,0.10)",
              color: aspectId === preset.id ? "#000" : "#fff",
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}