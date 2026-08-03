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

// Layout constants for the overlapping capture row (rotate | capture | filters-behind)
const ROTATE_SIZE = 48;
const CAPTURE_SIZE = 84; // bigger, per spec
const ROW_GAP = 16;
const ROW_EDGE = 20;

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

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flashOn, setFlashOn] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [section, setSection] = useState<Section>("shoot");
  const [activeFilter, setActiveFilter] = useState("none");
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

  // Back camera: try a real hardware torch. Silently no-ops where unsupported (most mobile Safari).
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

  const baseFilterCss = FILTERS.find((f) => f.id === activeFilter)?.css ?? "none";
  // Front camera + flash on: brighten the feed to simulate a screen ring light.
  const currentFilterCss =
    facing === "user" && flashOn ? `${baseFilterCss} brightness(1.25)` : baseFilterCss;

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

      {/* Front-camera screen flash: ambient glow, no hardware LED available on selfie cams */}
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

      {/* Top bar: back button + single chevron toggling the tools list */}
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

      {/* Vertical tools list — scattered order, not the order they were specified in */}
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

      {/* Photo / Video mode toggle — top of the bottom cluster, above everything else there */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6"
        style={{ bottom: ROW_EDGE + CAPTURE_SIZE + 40, zIndex: 5 }}
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

      {/* Capture row: rotate (left) — capture (center-left) — filters scrolling behind both */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: `calc(env(safe-area-inset-bottom) + ${ROW_EDGE + 56}px)`,
          height: CAPTURE_SIZE,
        }}
      >
        {/* Filter strip: full-width scroll layer, sits BEHIND rotate/capture (lower z-index) */}
        <div
          className="absolute inset-0 flex items-center gap-3 overflow-x-auto no-scrollbar"
          style={{
            zIndex: 1,
            paddingLeft: ROW_EDGE + ROTATE_SIZE + ROW_GAP + CAPTURE_SIZE + ROW_GAP,
            paddingRight: ROW_EDGE,
          }}
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <span
                className="w-11 h-11 rounded-full border-2 flex items-center justify-center overflow-hidden"
                style={{ borderColor: activeFilter === f.id ? "#fff" : "rgba(255,255,255,0.25)" }}
              >
                <span className="w-full h-full bg-neutral-500" style={{ filter: f.css }} />
              </span>
              <span className="text-[11px]" style={{ opacity: activeFilter === f.id ? 1 : 0.6 }}>
                {f.label}
              </span>
            </button>
          ))}
        </div>

        {/* Rotate button — opaque, above the filter strip */}
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          aria-label="Flip camera"
          className="absolute flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
          style={{
            zIndex: 2,
            left: ROW_EDGE,
            top: "50%",
            transform: "translateY(-50%)",
            width: ROTATE_SIZE,
            height: ROTATE_SIZE,
            background: "rgba(255,255,255,0.10)",
            backdropFilter: "blur(12px)",
          }}
        >
          <RefreshCw size={18} />
        </button>

        {/* Capture button — opaque, above the filter strip, bigger */}
        <button
          aria-label={mode === "photo" ? "Take photo" : "Record video"}
          className="absolute rounded-full"
          style={{
            zIndex: 2,
            left: ROW_EDGE + ROTATE_SIZE + ROW_GAP,
            top: "50%",
            transform: "translateY(-50%)",
            width: CAPTURE_SIZE,
            height: CAPTURE_SIZE,
            background: "#fff",
            border: "4px solid rgba(255,255,255,0.35)",
          }}
        />
      </div>

      {/* Bottom-most row: gallery import + Shoot / Compose */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center gap-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <button
          aria-label="Import from gallery"
          className="absolute w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ left: ROW_EDGE, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {/* Live latest-photo thumbnail deferred until the PWA install step exists */}
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