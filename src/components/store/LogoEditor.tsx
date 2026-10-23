import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

/** Full-screen step between picking a store logo and uploading it: choose a
 *  frame (circle, rounded, square, wide for a wordmark, or "as is" -- no frame,
 *  the logo's own outline, for SVGs and transparent cut-outs), drag and zoom the
 *  picture inside it, set how round the corners are and what fills behind
 *  it. The result is baked into a transparent PNG, so the logo looks the way
 *  its owner framed it everywhere it appears -- the storefront header shows
 *  it as-is, with no chip of its own around it.
 *
 *  Hand-rolled like AvatarCropper (one gesture surface, one canvas draw);
 *  bunfig's release-age guard makes a crop dependency a conversation. */

type Shape = "circle" | "rounded" | "square" | "wide" | "free";
type Pt = { x: number; y: number };

const SHAPES: { id: Shape; label: string }[] = [
  { id: "circle", label: "Circle" },
  { id: "rounded", label: "Rounded" },
  { id: "square", label: "Square" },
  { id: "wide", label: "Wide" },
  // No container: the frame takes the picture's own proportions with square
  // corners, so a transparent PNG or an SVG keeps its own outline.
  { id: "free", label: "As is" },
];
const WIDE_RATIO = 2.5;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 6;
// Long side of the exported PNG.
const OUTPUT_PX = 900;
const BACKGROUNDS: { id: string; label: string }[] = [
  { id: "none", label: "None" },
  { id: "#ffffff", label: "White" },
  { id: "#000000", label: "Black" },
];

export function LogoEditor({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  /** The framed logo, as a PNG file ready for the normal upload path. */
  onDone: (file: File) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stage, setStage] = useState(300);
  const [shape, setShape] = useState<Shape>("rounded");
  // Corner roundness for Rounded and Wide, as a share of the short side.
  const [corners, setCorners] = useState(0.22);
  const [background, setBackground] = useState("none");
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
    const measure = () => setStage(Math.min(window.innerWidth - 48, 340));
    measure();
    window.addEventListener("resize", measure);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", measure);
      document.body.style.overflow = prev;
    };
  }, []);

  // The frame on screen.
  const aspect = natural ? natural.w / natural.h : 1;
  const fw = shape === "free" && aspect < 1 ? Math.round(stage * aspect) : stage;
  const fh =
    shape === "wide"
      ? Math.round(stage / WIDE_RATIO)
      : shape === "free" && aspect >= 1
        ? Math.round(stage / aspect)
        : stage;
  const radius =
    shape === "circle"
      ? Math.min(fw, fh) / 2
      : shape === "square" || shape === "free"
        ? 0
        : corners * Math.min(fw, fh);

  // Zoom 1 = the whole picture fits inside the frame ("contain").
  const base = natural ? Math.min(fw / natural.w, fh / natural.h) : 1;
  const dw = natural ? natural.w * base * zoom : fw;
  const dh = natural ? natural.h * base * zoom : fh;
  // The zoom at which the picture just covers the frame.
  const coverZoom = natural ? Math.max(fw / natural.w, fh / natural.h) / base : 1;

  // Keep the picture's centre inside the frame so it can't be lost off-stage.
  function clamp(o: Pt, w = dw, h = dh): Pt {
    const mx = Math.max(fw, w) / 2;
    const my = Math.max(fh, h) / 2;
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  }

  function applyZoom(z: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    setZoom(next);
    if (natural) setOffset((o) => clamp(o, natural.w * base * next, natural.h * base * next));
  }

  function chooseShape(next: Shape) {
    setShape(next);
    setOffset({ x: 0, y: 0 });
    // As is: the whole picture, edge to edge in its own outline.
    if (next === "free") setZoom(1);
  }

  function onLoad(w: number, h: number) {
    setNatural({ w, h });
    // An SVG is almost always a logo drawn on nothing: it starts As is, so
    // its own shape shows. A wordmark (much wider than tall) starts Wide and
    // whole; anything squarer starts Rounded, filling the frame.
    if (file.type === "image/svg+xml") {
      setShape("free");
      setZoom(1);
    } else if (w / h >= 2) {
      setShape("wide");
      setZoom(1);
    } else {
      setShape("rounded");
      const b = Math.min(stage / w, stage / h);
      setZoom(Math.max(stage / w, stage / h) / b);
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

  function finish() {
    const img = imgRef.current;
    if (!img || !natural) return;
    setExporting(true);
    const k = OUTPUT_PX / Math.max(fw, fh);
    const W = Math.round(fw * k);
    const H = Math.round(fh * k);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setExporting(false);
      return;
    }
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, radius * k);
    ctx.clip();
    if (background !== "none") {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      (fw / 2 - dw / 2 + offset.x) * k,
      (fh / 2 - dh / 2 + offset.y) * k,
      dw * k,
      dh * k,
    );
    canvas.toBlob((blob) => {
      setExporting(false);
      if (blob) onDone(new File([blob], "logo.png", { type: "image/png" }));
    }, "image/png");
  }

  // The framed logo at a given scale: the stage's frame and the header
  // previews below draw the same thing, so what you see is what's saved.
  function framed(scale: number, extra?: CSSProperties) {
    return (
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          width: fw * scale,
          height: fh * scale,
          borderRadius: radius * scale,
          background: background === "none" ? undefined : background,
          ...extra,
        }}
      >
        {src && natural && (
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              width: dw * scale,
              height: dh * scale,
              left: (fw / 2 - dw / 2 + offset.x) * scale,
              top: (fh / 2 - dh / 2 + offset.y) * scale,
            }}
          />
        )}
      </div>
    );
  }

  if (typeof document === "undefined") return null;
  const previewScale = 44 / fh;
  const showCorners = shape === "rounded" || shape === "wide";

  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col bg-[#0b0b0c] text-white">
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 14px)" }}
      >
        <button type="button" onClick={onCancel} className="py-2 text-[15px] text-white/75">
          Cancel
        </button>
        <p className="text-[15px] font-semibold">Store logo</p>
        <button
          type="button"
          onClick={finish}
          disabled={!natural || exporting}
          className="rounded-full bg-white px-4 py-1.5 text-[14px] font-semibold text-black disabled:opacity-40"
        >
          {exporting ? "Saving…" : "Done"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Stage: drag to move, pinch / wheel / slider to zoom. The picture
            shows faintly outside the frame so there's something to aim with. */}
        <div
          className="relative flex shrink-0 touch-none select-none items-center justify-center overflow-hidden"
          style={{ height: stage + 40 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        >
          {failed ? (
            <p className="px-8 text-center text-sm text-white/60">
              This picture can&rsquo;t be opened here. Try a different one.
            </p>
          ) : (
            src && (
              <>
                <img
                  ref={imgRef}
                  src={src}
                  alt=""
                  draggable={false}
                  onLoad={(e) =>
                    onLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                  }
                  onError={() => setFailed(true)}
                  className="pointer-events-none absolute max-w-none opacity-25"
                  style={{
                    width: dw,
                    height: dh,
                    left: `calc(50% - ${dw / 2}px + ${offset.x}px)`,
                    top: `calc(50% - ${dh / 2}px + ${offset.y}px)`,
                    visibility: natural ? "visible" : "hidden",
                  }}
                />
                {framed(1, { boxShadow: "0 0 0 1.5px rgba(255,255,255,0.8)" })}
              </>
            )
          )}
        </div>

        <div
          className="mx-auto w-full max-w-md px-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
        >
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-full accent-white"
            disabled={!natural}
          />
          <div className="mt-2 flex justify-between text-[12px] text-white/50">
            <button
              type="button"
              onClick={() => applyZoom(1)}
              className="underline-offset-2 hover:underline"
            >
              Fit whole logo
            </button>
            <button
              type="button"
              onClick={() => applyZoom(coverZoom)}
              className="underline-offset-2 hover:underline"
            >
              Fill the frame
            </button>
          </div>

          <p className="mt-6 text-[13px] font-semibold text-white/80">Frame</p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => chooseShape(s.id)}
                aria-pressed={shape === s.id}
                className={`flex flex-col items-center gap-2 rounded-xl border py-3 text-[12px] transition-colors active:scale-[0.97] ${
                  shape === s.id ? "border-white bg-white/10" : "border-white/20 text-white/70"
                }`}
              >
                <span
                  className={`block border-2 border-current ${s.id === "free" ? "border-dashed" : ""}`}
                  style={{
                    width: s.id === "wide" ? 34 : 22,
                    height: s.id === "wide" ? 14 : 22,
                    borderRadius: s.id === "circle" ? 999 : s.id === "square" ? 2 : 6,
                  }}
                />
                {s.label}
              </button>
            ))}
          </div>

          {showCorners && (
            <label className="mt-4 block">
              <span className="text-[12px] text-white/60">Corners</span>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={corners}
                onChange={(e) => setCorners(Number(e.target.value))}
                className="mt-1 w-full accent-white"
              />
            </label>
          )}

          <p className="mt-6 text-[13px] font-semibold text-white/80">Background</p>
          <p className="text-[12px] text-white/45">
            Fills behind the logo, where it&rsquo;s transparent or doesn&rsquo;t reach the edges.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBackground(b.id)}
                aria-pressed={background === b.id}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${
                  background === b.id ? "border-white bg-white/10" : "border-white/20 text-white/70"
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full border border-white/40"
                  style={{
                    background:
                      b.id === "none"
                        ? "repeating-conic-gradient(#777 0 25%, #333 0 50%) 50% / 8px 8px"
                        : b.id,
                  }}
                />
                {b.label}
                {background === b.id && <Check size={13} />}
              </button>
            ))}
            {/* Any colour: the native picker, behind a swatch. */}
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] ${
                !BACKGROUNDS.some((b) => b.id === background)
                  ? "border-white bg-white/10"
                  : "border-white/20 text-white/70"
              }`}
            >
              <span
                className="h-4 w-4 rounded-full border border-white/40"
                style={{
                  background: BACKGROUNDS.some((b) => b.id === background)
                    ? "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)"
                    : background,
                }}
              />
              Custom
              <input
                type="color"
                className="sr-only"
                value={BACKGROUNDS.some((b) => b.id === background) ? "#c8a96a" : background}
                onChange={(e) => setBackground(e.target.value)}
              />
            </label>
          </div>

          {/* How it reads in a storefront header, on a light and a dark page. */}
          <p className="mt-6 text-[13px] font-semibold text-white/80">On your storefront</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["#f4f4f5", "#0f0f10"] as const).map((ground) => (
              <div
                key={ground}
                className="flex h-16 items-center rounded-xl border border-white/10 px-3"
                style={{ background: ground }}
              >
                {natural && framed(previewScale)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
