import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Full-screen "move and scale" step between picking a profile photo and
 *  uploading it. The photo sits behind a fixed circular frame; drag to
 *  reposition, pinch (or the slider) to zoom. What's inside the frame is
 *  exported as a square JPEG, so every avatar on the site is already framed
 *  the way its owner chose -- nothing downstream has to guess a crop.
 *
 *  Hand-rolled rather than a crop library: it's one gesture surface and one
 *  canvas draw, and bunfig's release-age guard makes new deps a conversation. */

const OUTPUT_PX = 720;
const MAX_ZOOM = 4;

type Pt = { x: number; y: number };

export function AvatarCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const measure = () => setFrame(Math.min(window.innerWidth - 48, 320));
    measure();
    window.addEventListener("resize", measure);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", measure);
      document.body.style.overflow = prev;
    };
  }, []);

  // "Cover" scale: at zoom 1 the photo's shorter side exactly fills the frame.
  const base = natural ? frame / Math.min(natural.w, natural.h) : 1;
  const dw = natural ? natural.w * base * zoom : frame;
  const dh = natural ? natural.h * base * zoom : frame;

  // Never let an edge of the photo come inside the frame.
  function clamp(o: Pt, w = dw, h = dh): Pt {
    const mx = Math.max(0, (w - frame) / 2);
    const my = Math.max(0, (h - frame) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  }

  function applyZoom(z: number) {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(next);
    if (natural) {
      setOffset((o) => clamp(o, natural.w * base * next, natural.h * base * next));
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 1) {
      setOffset((o) => clamp({ x: o.x + cur.x - prev.x, y: o.y + cur.y - prev.y }));
    } else if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      applyZoom((gesture.current.zoom * dist) / gesture.current.dist);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  }

  async function finish() {
    const img = imgRef.current;
    if (!img || !natural) return;
    setExporting(true);
    // The frame's top-left in displayed pixels, mapped back to the photo's own.
    const scale = base * zoom;
    const sx = (dw / 2 - frame / 2 - offset.x) / scale;
    const sy = (dh / 2 - frame / 2 - offset.y) / scale;
    const size = frame / scale;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setExporting(false);
      return;
    }
    ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT_PX, OUTPUT_PX);
    canvas.toBlob(
      (blob) => {
        setExporting(false);
        if (blob) onDone(blob);
      },
      "image/jpeg",
      0.9,
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[96] flex flex-col bg-black text-white">
      <div
        className="flex items-center justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}
      >
        <button type="button" onClick={onCancel} className="py-2 text-[15px] text-white/80">
          Cancel
        </button>
        <p className="text-[15px] font-semibold">Move and scale</p>
        <button
          type="button"
          onClick={finish}
          disabled={!natural || exporting}
          className="py-2 text-[15px] font-semibold disabled:opacity-40"
        >
          {exporting ? "Saving…" : "Done"}
        </button>
      </div>

      <div
        className="relative flex flex-1 touch-none select-none items-center justify-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
      >
        {failed ? (
          <p className="px-8 text-center text-sm text-white/60">
            This photo can&rsquo;t be opened here. Try a different one.
          </p>
        ) : (
          src && (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) =>
                setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
              onError={() => setFailed(true)}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: dw,
                height: dh,
                left: `calc(50% - ${dw / 2}px + ${offset.x}px)`,
                top: `calc(50% - ${dh / 2}px + ${offset.y}px)`,
                visibility: natural ? "visible" : "hidden",
              }}
            />
          )
        )}
        {/* The frame: a clear circle, everything around it dimmed. */}
        {!failed && (
          <div
            className="pointer-events-none absolute rounded-full border border-white/70"
            style={{ width: frame, height: frame, boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }}
          />
        )}
      </div>

      <div
        className="px-8 pt-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
      >
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="w-full accent-white"
          disabled={!natural}
        />
        <p className="mt-3 text-center text-xs text-white/50">Drag to reposition, pinch to zoom</p>
      </div>
    </div>,
    document.body,
  );
}
