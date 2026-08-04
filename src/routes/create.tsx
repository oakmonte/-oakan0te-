import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, RefreshCw, Zap, ZapOff, Timer, Image as ImageIcon,
  ChevronUp, ChevronDown, LayoutGrid, Ratio, Blend, Heart,
  Pause, Play, Square,
} from "lucide-react";

import { setPendingCapture } from "@/lib/capture-handoff";

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

const TIMER_OPTIONS = [0, 3, 10] as const;

type Mode = "photo" | "video";
type Section = "shoot" | "compose";
type CapturePhase = "live" | "counting";

const ROTATE_SIZE = 48;
const CAPTURE_SIZE = 84;
const ROW_EDGE = 20;
const CAPTURE_ROW_BOTTOM = ROW_EDGE + 56;
const CAPTURE_ROW_TOP = CAPTURE_ROW_BOTTOM + CAPTURE_SIZE;

const SWATCH_DIAMETER = CAPTURE_SIZE - 16;
const BARRIER_EDGE = ROW_EDGE + ROTATE_SIZE + 10;
const BARRIER_HEIGHT = SWATCH_DIAMETER + 12;

const TOOLS = [
  { id: "ratio", label: "Ratio", icon: Ratio },
  { id: "timer", label: "Timer", icon: Timer },
  { id: "flash", label: "Flash", icon: null },
  { id: "layout", label: "Layout", icon: LayoutGrid },
  { id: "filters", label: "Filters", icon: Blend },
];

function AnimatedLabel({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <span
      className="overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-300 ease-out"
      style={{
        maxWidth: visible ? 160 : 0,
        opacity: visible ? 1 : 0,
        marginRight: visible ? 2 : 0,
      }}
    >
      {children}
    </span>
  );
}

function CreatePage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const filterStripRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flashOn, setFlashOn] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [section, setSection] = useState<Section>("shoot");
  const [activeFilterIndex, setActiveFilterIndex] = useState(0);
  const [labelsVisible, setLabelsVisible] = useState(false);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());

  const [timerSeconds, setTimerSeconds] = useState<(typeof TIMER_OPTIONS)[number]>(0);
  const [capturePhase, setCapturePhase] = useState<CapturePhase>("live");
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

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
      const constraints = {
        advanced: [{ torch: flashOn }],
      } as unknown as MediaTrackConstraints;
      track.applyConstraints(constraints).catch(() => {});
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

  const scrollFilterIntoRing = useCallback((index: number) => {
    filterStripRef.current?.scrollTo({ left: index * CAPTURE_SIZE, behavior: "smooth" });
    setActiveFilterIndex(index);
  }, []);

  const activeFilter = FILTERS[activeFilterIndex];
  const isNonDefaultFilterActive = activeFilterIndex !== 0;
  const isCurrentFilterFavorited = favoritedFilterIds.has(activeFilter.id);

  const toggleFavoriteCurrentFilter = useCallback(() => {
    setFavoritedFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(activeFilter.id)) next.delete(activeFilter.id);
      else next.add(activeFilter.id);
      return next;
    });
  }, [activeFilter]);

  const currentFilterCss =
    facing === "user" && flashOn ? `${activeFilter.css} brightness(1.25)` : activeFilter.css;

  const cycleTimer = useCallback(() => {
    setTimerSeconds((prev) => {
      const idx = TIMER_OPTIONS.indexOf(prev);
      return TIMER_OPTIONS[(idx + 1) % TIMER_OPTIONS.length];
    });
  }, []);

  const capturePhoto = useCallback(() => {
  console.log("capturePhoto called");
  const video = videoRef.current;
  const canvas = canvasRef.current;
  if (!video || !canvas) {
    console.log("missing video/canvas ref");
    return;
  }
  if (video.readyState < 2 || video.videoWidth === 0) {
    console.warn("Camera not ready yet", video.readyState, video.videoWidth);
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (facing === "user") {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.filter = currentFilterCss;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(
    (blob) => {
      console.log("toBlob result:", blob);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setPendingCapture({ type: "photo", blob, url });
      console.log("about to navigate to after-shot");
      navigate({ to: "/create/after-shot" });
    },
    "image/jpeg",
    0.92,
  );
}, [facing, currentFilterCss, navigate]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    recordedChunksRef.current = [];
    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      console.log("onstop fired, chunks:", recordedChunksRef.current.length);
      const blob = new Blob(recordedChunksRef.current, { type: mimeType || "video/webm" });
      console.log("blob size:", blob.size);
      const url = URL.createObjectURL(blob);
      setPendingCapture({ type: "video", blob, url });
      navigate({ to: "/create/after-shot" });
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setIsPaused(false);

    // Hard stop at 60s regardless of anything else, per the flat cap decision.
    window.setTimeout(() => {
      if (mediaRecorderRef.current === recorder && recorder.state !== "inactive") {
        recorder.stop();
        setIsRecording(false);
        setIsPaused(false);
      }
    }, 60_000);
  }, [navigate]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
    }
  }, []);

  const performCapture = useCallback(() => {
    setCapturePhase("live");
    setCountdownRemaining(null);
    if (mode === "photo") capturePhoto();
    else startRecording();
  }, [mode, capturePhoto, startRecording]);

  useEffect(() => {
    if (capturePhase !== "counting" || countdownRemaining === null) return;
    if (countdownRemaining <= 0) {
      performCapture();
      return;
    }
    const t = setTimeout(() => setCountdownRemaining((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [capturePhase, countdownRemaining, performCapture]);

  const handleCaptureTap = useCallback(() => {
    if (capturePhase === "counting") {
      setCapturePhase("live");
      setCountdownRemaining(null);
      return;
    }
    if (mode === "video" && isRecording) {
      stopRecording();
      return;
    }
    if (timerSeconds > 0) {
      setCapturePhase("counting");
      setCountdownRemaining(timerSeconds);
    } else {
      performCapture();
    }
  }, [capturePhase, mode, isRecording, timerSeconds, performCapture, stopRecording]);

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <style>{`
        .oak-filter-strip::-webkit-scrollbar { display: none; }
        @keyframes oak-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .oak-filter-strip {
          -webkit-mask-image: linear-gradient(to right, transparent ${BARRIER_EDGE}px, black ${BARRIER_EDGE}px);
          mask-image: linear-gradient(to right, transparent ${BARRIER_EDGE}px, black ${BARRIER_EDGE}px);
        }
      `}</style>

      <canvas ref={canvasRef} className="hidden" />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: currentFilterCss, transform: facing === "user" ? "scaleX(-1)" : "none" }}
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

      {capturePhase === "counting" && countdownRemaining !== null && countdownRemaining > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <span className="text-8xl font-bold" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            {countdownRemaining}
          </span>
        </div>
      )}

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
                <AnimatedLabel visible={labelsVisible}>Flash</AnimatedLabel>
                {flashOn ? <Zap size={26} /> : <ZapOff size={26} />}
              </button>
            );
          }
          if (tool.id === "timer") {
            return (
              <button
                key="timer"
                onClick={cycleTimer}
                aria-label="Timer"
                className="flex items-center gap-2 relative"
              >
                <AnimatedLabel visible={labelsVisible}>
                  {timerSeconds === 0 ? "Timer" : `Timer: ${timerSeconds}s`}
                </AnimatedLabel>
                <span className="relative flex items-center justify-center">
                  <Timer size={26} />
                  {timerSeconds > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, background: "#fff", color: "#000" }}
                    >
                      {timerSeconds}
                    </span>
                  )}
                </span>
              </button>
            );
          }
          if (tool.id === "filters") {
            return (
              <button
                key="filters"
                aria-label={isNonDefaultFilterActive ? "More filters" : "Filters"}
                className="flex items-center gap-2 opacity-90"
              >
                <AnimatedLabel visible={labelsVisible}>
                  {isNonDefaultFilterActive ? "More Filters" : "Filters"}
                </AnimatedLabel>
                <span
                  className="flex items-center justify-center transition-transform duration-200 ease-out"
                  style={{ transform: isNonDefaultFilterActive ? "scale(1.3)" : "scale(1)" }}
                >
                  <Blend size={26} />
                </span>
              </button>
            );
          }
          const Icon = tool.icon!;
          return (
            <button
              key={tool.id}
              aria-label={tool.label}
              className="flex items-center gap-2 opacity-90"
            >
              <AnimatedLabel visible={labelsVisible}>{tool.label}</AnimatedLabel>
              <Icon size={26} />
            </button>
          );
        })}

        {isNonDefaultFilterActive && (
          <button
            onClick={toggleFavoriteCurrentFilter}
            aria-label={isCurrentFilterFavorited ? "Remove from favorites" : "Favorite this filter"}
            className="flex items-center gap-2"
            style={{ animation: "oak-fade-in 220ms ease-out" }}
          >
            <AnimatedLabel visible={labelsVisible}>
              {isCurrentFilterFavorited ? "Favorited" : "Favorite"}
            </AnimatedLabel>
            <Heart size={22} fill={isCurrentFilterFavorited ? "currentColor" : "none"} />
          </button>
        )}

        <button
          onClick={() => setLabelsVisible((v) => !v)}
          aria-label={labelsVisible ? "Hide labels" : "Show labels"}
          className="flex items-center justify-center w-8 h-8 mt-1"
        >
          {labelsVisible ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6"
        style={{ bottom: CAPTURE_ROW_TOP + 24, zIndex: 5 }}
      >
        {(["photo", "video"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => !isRecording && setMode(m)}
            className="uppercase text-xs font-semibold tracking-wide"
            style={{ opacity: mode === m ? 1 : 0.5 }}
          >
            {m}
          </button>
        ))}
      </div>

      <div
        ref={filterStripRef}
        onScroll={handleFilterScroll}
        className="oak-filter-strip absolute left-0 right-0 flex items-center overflow-x-auto"
        style={{
          zIndex: 1,
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM}px)`,
          height: CAPTURE_SIZE,
          opacity: mode === "video" && isRecording ? 0 : 1,
          pointerEvents: mode === "video" && isRecording ? "none" : "auto",
          transition: "opacity 200ms ease-out",
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
              style={{ width: SWATCH_DIAMETER, height: SWATCH_DIAMETER }}
            >
              <span className="w-full h-full block bg-neutral-500" style={{ filter: f.css }} />
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => !isRecording && setFacing((f) => (f === "user" ? "environment" : "user"))}
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
          opacity: isRecording ? 0.4 : 1,
        }}
      >
        <RefreshCw size={18} />
      </button>

      {mode === "video" && isRecording ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6"
          style={{ zIndex: 4, bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM}px)` }}
        >
          <button
            onClick={togglePause}
            aria-label={isPaused ? "Resume recording" : "Pause recording"}
            className="flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
            style={{
              width: CAPTURE_SIZE,
              height: CAPTURE_SIZE,
              border: "4px solid rgba(255,255,255,0.9)",
              background: "rgba(255,255,255,0.10)",
              backdropFilter: "blur(12px)",
            }}
          >
            {isPaused ? <Play size={28} /> : <Pause size={28} />}
          </button>
          <button
            onClick={stopRecording}
            aria-label="Stop recording"
            className="flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
            style={{
              width: CAPTURE_SIZE,
              height: CAPTURE_SIZE,
              border: "4px solid #ef4444",
              background: "rgba(255,255,255,0.10)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Square size={24} fill="#ef4444" color="#ef4444" />
          </button>
        </div>
      ) : (
        <>
          <div
            className="absolute pointer-events-none rounded-full transition-colors duration-200"
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
          <button
            onClick={handleCaptureTap}
            aria-label={mode === "photo" ? "Take photo" : "Start recording"}
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
        </>
      )}

      <div
        className="absolute left-0 right-0 flex items-center justify-center gap-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <button
          aria-label="Import from gallery"
          onClick={() => galleryInputRef.current?.click()}
          className="absolute w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center"
          style={{
            left: ROW_EDGE,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
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
            if (file) {
              const url = URL.createObjectURL(file);
              setPendingCapture({
                type: file.type.startsWith("video") ? "video" : "photo",
                blob: file,
                url,
              });
              navigate({ to: "/create/after-shot" }).catch((err) => {
                console.error("navigate() rejected:", err);
              });
            }
            e.target.value = "";
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