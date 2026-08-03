import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  RefreshCw,
  Zap,
  ZapOff,
  Timer,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Ratio,
  Blend,
} from "lucide-react";

export const Route = createFileRoute("/create")({
  head: () => ({ meta: [{ title: "Create — Oakmonte" }] }),
  component: CreatePage,
});

const FILTERS = [
  { id: "none", label: "Original", css: "none" },
  { id: "warm", label: "Warm", css: "brightness(1.05) saturate(1.2) sepia(0.15)" },
  { id: "cool", label: "Cool", css: "brightness(1.02) saturate(1.1) hue-rotate(-8deg)" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.1)" },
  { id: "vivid", label: "Vivid", css: "saturate(1.6) contrast(1.08)" },
  { id: "fade", label: "Fade", css: "brightness(1.08) contrast(0.9) saturate(0.85)" },
];

type Mode = "photo" | "video";
type Section = "shoot" | "compose";

const ROTATE_SIZE = 48;
const CAPTURE_SIZE = 84;
const ROW_EDGE = 20;
const CAPTURE_ROW_BOTTOM = ROW_EDGE + 56;
const CAPTURE_ROW_TOP = CAPTURE_ROW_BOTTOM + CAPTURE_SIZE;

// Scattered order, deliberately not the order these were specified in.
const TOOLS = [
  { id: "ratio", label: "Ratio", icon: Ratio },
  { id: "filters", label: "Filters", icon: Blend },
  { id: "flash", label: "Flash", icon: null }, // rendered specially below (needs active state)
  { id: "layout", label: "Layout", icon: LayoutGrid },
  { id: "timer", label: "Timer", icon: Timer },
];

function CreatePage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const filterStripRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null); // add this line

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flashOn, setFlashOn] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [section, setSection] = useState<Section>("shoot");
  const [activeFilterIndex, setActiveFilterIndex] = useState(0);
  const [labelsVisible, setLabelsVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: mode === "video",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access failed:", err);
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing, mode]);

  useEffect(() => {
    if (facing !== "environment") return;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
    if (capabilities && "torch" in capabilities) {
      track.applyConstraints({ advanced: [{ torch: flashOn } as any] }).catch(() => {});
    }
  }, [flashOn, facing]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/home" });
  }, [navigate]);

  const handleFilterScroll = useCallback(() => {
    const el = filterStripRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / CAPTURE_SIZE);
    const clamped = Math.max(0, Math.min(FILTERS.length - 1, index));
    setActiveFilterIndex((prev) => (prev === clamped ? prev : clamped));
  }, []);

  // Tapping any filter (not just swiping) smooth-scrolls it into the ring.
  const scrollFilterIntoRing = useCallback((index: number) => {
    const el = filterStripRef.current;
    if (!el) return;
    el.scrollTo({ left: index * CAPTURE_SIZE, behavior: "smooth" });
    setActiveFilterIndex(index);
  }, []);

  const activeFilter = FILTERS[activeFilterIndex];
  const currentFilterCss =
    facing === "user" && flashOn ? `${activeFilter.css} brightness(1.25)` : activeFilter.css;

  const handleCapture = useCallback(() => {
    console.log(`${mode === "photo" ? "Capture photo" : "Start/stop recording"} with filter: ${activeFilter.id}`);
  }, [mode, activeFilter]);

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {/* Scoped scrollbar-hide rule — doesn't rely on a Tailwind utility that may not exist in this project */}
      <style>{`
        .oak-filter-strip::-webkit-scrollbar { display: none; }
      `}</style>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: currentFilterCss,
          transform: facing === "user" ? "scaleX(-1)" : "none",
        }}
      />

      {facing === "user" && flashOn && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0.05) 70%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {/* Top bar — just Back now. Tool icons live in their own always-visible stack below. */}
      <div className="absolute top-0 left-0 right-0 flex items-center px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          onClick={handleBack}
          aria-label="Back"
          className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Vertical tool stack — icons visible by default, bigger, labels toggle via the chevron at the BOTTOM of the stack */}
      <div
        className="absolute right-4 flex flex-col items-end gap-5"
        style={{ top: "calc(env(safe-area-inset-top) + 76px)", zIndex: 6 }}
      >
        {TOOLS.map((tool) => {
          if (tool.id === "flash") {
            return (
              <button
                key="flash"
                onClick={() => setFlashOn((f) => !f)}
                aria-label="Flash"
                className="flex items-center gap-2"
              >
                {labelsVisible && (
                  <span className="text-sm font-medium" style={{ opacity: flashOn ? 1 : 0.85 }}>
                    Flash
                  </span>
                )}
                {flashOn ? <Zap size={26} /> : <ZapOff size={26} />}
              </button>
            );
          }
          const Icon = tool.icon!;
          return (
            <button key={tool.id} aria-label={tool.label} className="flex items-center gap-2 opacity-90">
              {labelsVisible && <span className="text-sm font-medium">{tool.label}</span>}
              <Icon size={26} />
            </button>
          );
        })}

        {/* Toggle lives at the bottom of the stack, not a separate easy-to-miss button up top */}
        <button
          onClick={() => setLabelsVisible((v) => !v)}
          aria-label={labelsVisible ? "Hide labels" : "Show labels"}
          className="flex items-center justify-center w-8 h-8 mt-1"
        >
          {labelsVisible ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Photo / Video mode toggle */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6"
        style={{ bottom: CAPTURE_ROW_TOP + 24, zIndex: 5 }}
      >
        {(["photo", "video"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="uppercase text-xs font-semibold tracking-wide"
            style={{ opacity: mode === m ? 1 : 0.5 }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Rotate button — unchanged position */}
      <button
        onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
        aria-label="Flip camera"
        className="absolute flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
        style={{
          zIndex: 3,
          left: ROW_EDGE,
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM + (CAPTURE_SIZE - ROTATE_SIZE) / 2}px)`,
          width: ROTATE_SIZE,
          height: ROTATE_SIZE,
          background: "rgba(255,255,255,0.10)",
          backdropFilter: "blur(12px)",
        }}
      >
        <RefreshCw size={18} />
      </button>

      {/* Filter filmstrip — tap any swatch to smooth-scroll it into the ring, not just swipe */}
      <div
        ref={filterStripRef}
        onScroll={handleFilterScroll}
        className="oak-filter-strip absolute left-0 right-0 flex items-center overflow-x-auto"
        style={{
          zIndex: 1,
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM}px)`,
          height: CAPTURE_SIZE,
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingLeft: `calc(50% - ${CAPTURE_SIZE / 2}px)`,
          paddingRight: `calc(50% - ${CAPTURE_SIZE / 2}px)`,
        }}
      >
        {FILTERS.map((f, i) => (
          <button
            key={f.id}
            onClick={() => scrollFilterIntoRing(i)}
            className="shrink-0 flex items-center justify-center"
            style={{ width: CAPTURE_SIZE, scrollSnapAlign: "center" }}
          >
            <span
              className="rounded-full overflow-hidden block"
              style={{ width: CAPTURE_SIZE - 16, height: CAPTURE_SIZE - 16 }}
            >
              <span className="w-full h-full block bg-neutral-500" style={{ filter: f.css }} />
            </span>
          </button>
        ))}
      </div>

      {/* Shutter ring */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          zIndex: 2,
          left: "50%",
          transform: "translateX(-50%)",
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM}px)`,
          width: CAPTURE_SIZE,
          height: CAPTURE_SIZE,
          border: "4px solid rgba(255,255,255,0.9)",
        }}
      />

      {/* Tap layer for capture */}
      <button
        onClick={handleCapture}
        aria-label={mode === "photo" ? "Take photo" : "Record video"}
        className="absolute rounded-full"
        style={{
          zIndex: 4,
          left: "50%",
          transform: "translateX(-50%)",
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM}px)`,
          width: CAPTURE_SIZE,
          height: CAPTURE_SIZE,
          background: "transparent",
        }}
      />

      {/* Bottom-most row — unchanged */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center gap-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <button
          aria-label="Import from gallery"
          onClick={() => galleryInputRef.current?.click()}
          className="absolute w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ left: ROW_EDGE, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <ImageIcon size={16} className="opacity-80" />
        </button>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) console.log("Selected from gallery:", file.name, file.type);
            e.target.value = ""; // reset so picking the same file twice still fires onChange
          }}
        />

        <button
          onClick={() => setSection("shoot")}
          className="uppercase text-sm font-bold tracking-wide"
          style={{ opacity: section === "shoot" ? 1 : 0.5 }}
        >
          Shoot
        </button>
        <button
          onClick={() => setSection("compose")}
          className="uppercase text-sm font-bold tracking-wide"
          style={{ opacity: section === "compose" ? 1 : 0.5 }}
        >
          Compose
        </button>
      </div>
    </div>
  );
}