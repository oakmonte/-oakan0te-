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
const CAPTURE_SIZE = 84; // ring diameter — filter swatches share this exact size
const ROW_EDGE = 20;
const CAPTURE_ROW_BOTTOM = ROW_EDGE + 56; // distance from screen bottom to the capture row
const CAPTURE_ROW_TOP = CAPTURE_ROW_BOTTOM + CAPTURE_SIZE; // top edge of the capture row, from bottom

function ToolRow({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center gap-2 transition-opacity duration-150"
      style={{ opacity: active ? 1 : 0.85 }}
    >
      <span className="text-xs font-medium whitespace-nowrap">{label}</span>
      {icon}
    </button>
  );
}

function CreatePage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const filterStripRef = useRef<HTMLDivElement>(null);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flashOn, setFlashOn] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [section, setSection] = useState<Section>("shoot");
  const [activeFilterIndex, setActiveFilterIndex] = useState(0);
  const [toolsExpanded, setToolsExpanded] = useState(false);

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

  // Whichever filter is scroll-snapped to center becomes the live preview —
  // no tap required, matches the reference's "slides into the ring" behavior.
  const handleFilterScroll = useCallback(() => {
    const el = filterStripRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / CAPTURE_SIZE);
    const clamped = Math.max(0, Math.min(FILTERS.length - 1, index));
    setActiveFilterIndex((prev) => (prev === clamped ? prev : clamped));
  }, []);

  const activeFilter = FILTERS[activeFilterIndex];
  const currentFilterCss =
    facing === "user" && flashOn ? `${activeFilter.css} brightness(1.25)` : activeFilter.css;

  const handleCapture = useCallback(() => {
    // Tapping the ring captures using whichever filter is currently centered —
    // this tap layer is separate from the scroll strip beneath it.
    console.log(`${mode === "photo" ? "Capture photo" : "Start/stop recording"} with filter: ${activeFilter.id}`);
  }, [mode, activeFilter]);

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
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

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          onClick={handleBack}
          aria-label="Back"
          className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          <X size={20} />
        </button>

        <button
          onClick={() => setToolsExpanded((e) => !e)}
          aria-label="More tools"
          className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          {toolsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {toolsExpanded && (
        <div
          className="absolute top-16 right-4 flex flex-col items-end gap-4 px-4 py-3 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <ToolRow label="Layout" icon={<LayoutGrid size={18} />} onClick={() => {}} />
          <ToolRow
            label="Flash"
            icon={flashOn ? <Zap size={18} /> : <ZapOff size={18} />}
            active={flashOn}
            onClick={() => setFlashOn((f) => !f)}
          />
          <ToolRow label="Ratio" icon={<Ratio size={18} />} onClick={() => {}} />
          <ToolRow label="Timer" icon={<Timer size={18} />} onClick={() => {}} />
        </div>
      )}

      {/* Photo / Video mode toggle — raised clear above the capture row's top edge */}
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

      {/* Rotate button — unchanged position, fixed left */}
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

      {/* Filter filmstrip: scroll-snaps each swatch through the shutter ring, centered on screen */}
      <div
        ref={filterStripRef}
        onScroll={handleFilterScroll}
        className="absolute left-0 right-0 flex items-center overflow-x-auto no-scrollbar"
        style={{
          zIndex: 1,
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM}px)`,
          height: CAPTURE_SIZE,
          scrollSnapType: "x mandatory",
          paddingLeft: `calc(50% - ${CAPTURE_SIZE / 2}px)`,
          paddingRight: `calc(50% - ${CAPTURE_SIZE / 2}px)`,
        }}
      >
        {FILTERS.map((f) => (
          <div
            key={f.id}
            className="shrink-0 flex flex-col items-center justify-center gap-1"
            style={{ width: CAPTURE_SIZE, scrollSnapAlign: "center" }}
          >
            <span
              className="rounded-full overflow-hidden"
              style={{ width: CAPTURE_SIZE - 16, height: CAPTURE_SIZE - 16 }}
            >
              <span className="w-full h-full block bg-neutral-500" style={{ filter: f.css }} />
            </span>
          </div>
        ))}
      </div>

      {/* Shutter ring — hollow outline, dead-center, drawn on top of the filmstrip */}
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

      {/* Invisible tap layer over the ring — capturing, independent of the scroll strip beneath it */}
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

      {/* Bottom-most row: gallery import + Shoot / Compose — unchanged */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center gap-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <button
          aria-label="Import from gallery"
          className="absolute w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ left: ROW_EDGE, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <ImageIcon size={16} className="opacity-80" />
        </button>

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