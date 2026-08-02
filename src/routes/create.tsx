import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, RefreshCw, Zap, ZapOff, Timer, Image as ImageIcon, ChevronUp, ChevronDown } from "lucide-react";

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

function CreatePage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flash, setFlash] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
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

  const handleBack = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/home" });
  }, [navigate]);

  const currentFilterCss = FILTERS.find((f) => f.id === activeFilter)?.css ?? "none";

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
        style={{ filter: currentFilterCss, transform: facing === "user" ? "scaleX(-1)" : "none" }}
      />

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFlash((f) => !f)}
            aria-label="Flash"
            className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
            style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
          >
            {flash ? <Zap size={18} /> : <ZapOff size={18} />}
          </button>
          <button
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            aria-label="Flip camera"
            className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
            style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
          >
            <RefreshCw size={18} />
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
      </div>

      {toolsExpanded && (
        <div
          className="absolute top-16 right-4 flex flex-col items-center gap-3 px-3 py-3 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <button aria-label="Timer" className="flex flex-col items-center gap-1 opacity-80">
            <Timer size={18} />
          </button>
        </div>
      )}

      {/* Filter strip */}
      <div className="absolute left-0 right-0 flex gap-3 overflow-x-auto no-scrollbar px-5 pb-1" style={{ bottom: 132 }}>
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setActiveFilter(f.id)} className="flex flex-col items-center gap-1 shrink-0">
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

      {/* Photo / Video toggle */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6" style={{ bottom: 100 }}>
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

      {/* Capture row */}
      <div
        className="absolute left-0 right-0 flex items-center justify-between px-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <button
          aria-label="Import from gallery"
          className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <ImageIcon size={18} className="opacity-80" />
        </button>

        <button
          aria-label={mode === "photo" ? "Take photo" : "Record video"}
          className="rounded-full"
          style={{ width: 72, height: 72, background: "#fff", border: "4px solid rgba(255,255,255,0.35)" }}
        />

        <div style={{ width: 44 }} />
      </div>
    </div>
  );
}