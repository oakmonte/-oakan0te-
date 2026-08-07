import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  X, RefreshCw, Timer as TimerIcon, Image as ImageIcon,
  ChevronUp, ChevronDown, LayoutGrid, Ratio as RatioIcon, Blend, Heart,
  Pause, Play, Square, Zap, ZapOff,
} from "lucide-react";

import {
  compileFilter,
  applyCompiledFilter,
  IDENTITY_FILTER,
} from "@/lib/canvas-filter";
import { setPendingCapture } from "@/lib/capture-handoff";

import RatioPanel, { type CameraRatio } from "@/components/camera/RatioPanel";
import TimerPanel, { type CameraTimer } from "@/components/camera/TimerPanel";
import FilterPanel from "@/components/camera/FilterPanel";
import LayoutPanel from "@/components/camera/LayoutPanel";
import { CAMERA_FILTERS } from "@/components/camera/filter-data";
import { CAMERA_LAYOUTS } from "@/components/camera/layout-data";

export const Route = createFileRoute("/create/")({
  head: () => ({ meta: [{ title: "Create — Oakmonte" }] }),
  component: CreatePage,
});

type Mode = "photo" | "video";
type Section = "shoot" | "compose";
type CapturePhase = "live" | "counting";
type PanelType = "ratio" | "timer" | "layout" | "filters";

const DEFAULT_FILTER_ID = "natural";
const DEFAULT_LAYOUT_ID = "fit-check";
// Numeric width/height for each ratio, used to size the preview box and to
// crop captured frames so what's shot matches what was framed.
const RATIO_ASPECT: Record<CameraRatio, number> = {
  "9:16": 9 / 16,
  "3:4": 3 / 4,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
};

// Centered crop rect (in source pixel coords) that matches what object-cover
// would render inside a box of targetAspect — used identically for the live
// preview box and for both capture paths, so they stay in sync.
function getCropRect(sourceWidth: number, sourceHeight: number, targetAspect: number) {
  const sourceAspect = sourceWidth / sourceHeight;
  let sx = 0, sy = 0, sw = sourceWidth, sh = sourceHeight;
  if (sourceAspect > targetAspect) {
    sw = sourceHeight * targetAspect;
    sx = (sourceWidth - sw) / 2;
  } else if (sourceAspect < targetAspect) {
    sh = sourceWidth / targetAspect;
    sy = (sourceHeight - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

// Quick filter strip: Natural is pinned, favorites fill in, and up to this
// many random non-favorite filters backfill the rest so new users aren't
// staring at just one swatch. Strip never exceeds STRIP_SIZE total.
const STRIP_SIZE = 10;
const RANDOM_FILLER_COUNT = 6;

const ROTATE_SIZE = 48;
const FLASH_TOGGLE_SIZE = 40;
const CAPTURE_SIZE = 84;
const ROW_EDGE = 20;
const CAPTURE_ROW_BOTTOM = ROW_EDGE + 56;
const CAPTURE_ROW_TOP = CAPTURE_ROW_BOTTOM + CAPTURE_SIZE;

const SWATCH_DIAMETER = CAPTURE_SIZE - 16;
const BARRIER_EDGE = ROW_EDGE + ROTATE_SIZE + 10;
const BARRIER_HEIGHT = SWATCH_DIAMETER + 12;

const TOOLS: { id: PanelType; label: string }[] = [
  { id: "ratio", label: "Ratio" },
  { id: "timer", label: "Timer" },
  { id: "layout", label: "Layout" },
  { id: "filters", label: "Filters" },
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
  const mirrorDrawLoopRef = useRef<number | null>(null);
  const mirrorCanvasStreamRef = useRef<MediaStream | null>(null);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [mode, setMode] = useState<Mode>("photo");
  const [section, setSection] = useState<Section>("shoot");
  const [labelsVisible, setLabelsVisible] = useState(false);

  // --- Camera panel architecture ---
  // CreatePage owns state; each panel owns its own UI/interaction.
  const [openPanel, setOpenPanel] = useState<PanelType | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [ratio, setRatio] = useState<CameraRatio>("9:16");
  const [timer, setTimer] = useState<CameraTimer>(0);
  const [selectedFilterId, setSelectedFilterId] = useState(DEFAULT_FILTER_ID);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());
  const [randomFillerIds, setRandomFillerIds] = useState<string[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState(DEFAULT_LAYOUT_ID); // state only — no capture-flow consumer yet
  const [savedLayoutIds, setSavedLayoutIds] = useState<Set<string>>(new Set());

  const [capturePhase, setCapturePhase] = useState<CapturePhase>("live");
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        const videoConstraints: MediaTrackConstraints = {
          facingMode: facing,
          width: { ideal: 1920 },
          frameRate: { ideal: 60 },
        };
        // 9:16 already matches the sensor's natural portrait output closely —
        // hinting it explicitly forces an extra hardware-level zoom we don't want.
        // Only push the hint for ratios that genuinely need it.
        if (ratio !== "9:16") {
          videoConstraints.aspectRatio = { ideal: RATIO_ASPECT[ratio] };
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
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
  }, [facing, mode, ratio]);

  // Rear-camera torch, driven by the simple flashOn toggle.
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

  // Quick strip: Natural pinned + favorites + random fillers, capped at
  // STRIP_SIZE. Fillers are seeded once and only reshuffled/evicted when
  // favorites change, so the strip doesn't jitter on unrelated re-renders.
  useEffect(() => {
    setRandomFillerIds((prev) => {
      let next = prev.filter((id) => !favoritedFilterIds.has(id) && id !== DEFAULT_FILTER_ID);
      const allowedFillers = Math.max(
        0,
        Math.min(RANDOM_FILLER_COUNT, STRIP_SIZE - 1 - favoritedFilterIds.size),
      );
      if (next.length > allowedFillers) {
        // evict oldest fillers first (front of array = oldest)
        next = next.slice(next.length - allowedFillers);
      } else if (next.length < allowedFillers) {
        const used = new Set([DEFAULT_FILTER_ID, ...favoritedFilterIds, ...next]);
        const pool = CAMERA_FILTERS.filter((f) => !used.has(f.id));
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        const needed = allowedFillers - next.length;
        next = [...next, ...shuffled.slice(0, needed).map((f) => f.id)];
      }
      return next;
    });
  }, [favoritedFilterIds]);

  const quickStripFilters = [DEFAULT_FILTER_ID, ...favoritedFilterIds, ...randomFillerIds]
    .map((id) => CAMERA_FILTERS.find((f) => f.id === id))
    .filter((f): f is (typeof CAMERA_FILTERS)[number] => Boolean(f))
    .slice(0, STRIP_SIZE);

  const handleFilterScroll = useCallback(() => {
    const el = filterStripRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / CAPTURE_SIZE);
    const clamped = Math.max(0, Math.min(quickStripFilters.length - 1, index));
    const next = quickStripFilters[clamped];
    if (next && next.id !== selectedFilterId) setSelectedFilterId(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickStripFilters, selectedFilterId]);

  const scrollFilterIntoRing = useCallback((index: number) => {
    filterStripRef.current?.scrollTo({ left: index * CAPTURE_SIZE, behavior: "smooth" });
    const next = quickStripFilters[index];
    if (next) setSelectedFilterId(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickStripFilters]);

  const activeFilter =
    CAMERA_FILTERS.find((f) => f.id === selectedFilterId) ?? CAMERA_FILTERS[0];
  const isNonDefaultFilterActive = selectedFilterId !== DEFAULT_FILTER_ID;
  const isCurrentFilterFavorited = favoritedFilterIds.has(selectedFilterId);

  const toggleFilterFavorite = useCallback((id: string) => {
    setFavoritedFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleLayoutSaved = useCallback((id: string) => {
    setSavedLayoutIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [viewportSize, setViewportSize] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 390,
    h: typeof window !== "undefined" ? window.innerHeight : 844,
  }));

  useEffect(() => {
    const onResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Largest box matching the selected ratio that fits the viewport. Root is
  // already bg-black, so whatever doesn't fill this box just shows as bars.
  const targetAspect = RATIO_ASPECT[ratio];
  let previewWidth = viewportSize.w;
  let previewHeight = viewportSize.w / targetAspect;
  if (previewHeight > viewportSize.h) {
    previewHeight = viewportSize.h;
    previewWidth = viewportSize.h * targetAspect;
  }

  const activeLayout =
    CAMERA_LAYOUTS.find((l) => l.id === selectedLayoutId) ?? CAMERA_LAYOUTS[0];

  // Front-camera screen flash, driven by the same flashOn toggle.
  const screenFlashActive = facing === "user" && flashOn;
  const currentFilterCss = screenFlashActive
    ? `${activeFilter.css} brightness(1.25)`
    : activeFilter.css;

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2 || video.videoWidth === 0) {
      console.warn("Camera not ready yet", video.readyState, video.videoWidth);
      return;
    }
    const { sx, sy, sw, sh } = getCropRect(video.videoWidth, video.videoHeight, RATIO_ASPECT[ratio]);
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const compiled = compileFilter(currentFilterCss);
    if (compiled !== (IDENTITY_FILTER as any)) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyCompiledFilter(imgData, compiled);
      ctx.putImageData(imgData, 0, 0);
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPendingCapture({ type: "photo", blob, url });
        navigate({ to: "/create/after-shot" });
      },
      "image/jpeg",
      0.96,
    );
  }, [facing, currentFilterCss, navigate]);

  const stopMirrorDrawLoop = useCallback(() => {
    if (mirrorDrawLoopRef.current !== null) {
      cancelAnimationFrame(mirrorDrawLoopRef.current);
      mirrorDrawLoopRef.current = null;
    }
    mirrorCanvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    mirrorCanvasStreamRef.current = null;
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return;
    recordedChunksRef.current = [];

    let recordingStream: MediaStream = stream;

    if (video.videoWidth > 0) {
      const { sx, sy, sw, sh } = getCropRect(video.videoWidth, video.videoHeight, RATIO_ASPECT[ratio]);
      const recordCanvas = document.createElement("canvas");
      recordCanvas.width = sw;
      recordCanvas.height = sh;
      const rctx = recordCanvas.getContext("2d");

      if (rctx) {
        const compiledFilterAtStart = compileFilter(currentFilterCss);
        const shouldMirror = facing === "user";

        const drawFrame = () => {
          rctx.save();
          if (shouldMirror) {
            rctx.translate(recordCanvas.width, 0);
            rctx.scale(-1, 1);
          }
          rctx.drawImage(video, sx, sy, sw, sh, 0, 0, recordCanvas.width, recordCanvas.height);
          const frame = rctx.getImageData(0, 0, recordCanvas.width, recordCanvas.height);
          applyCompiledFilter(frame, compiledFilterAtStart);
          rctx.putImageData(frame, 0, 0);
          rctx.restore();
          mirrorDrawLoopRef.current = requestAnimationFrame(drawFrame);
        };
        drawFrame();

        const canvasStream = recordCanvas.captureStream(60);
        stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));

        mirrorCanvasStreamRef.current = canvasStream;
        recordingStream = canvasStream;
      }
    }

    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stopMirrorDrawLoop();
      const blob = new Blob(recordedChunksRef.current, { type: mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      setPendingCapture({ type: "video", blob, url });
      navigate({ to: "/create/after-shot" });
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setIsPaused(false);

    window.setTimeout(() => {
      if (mediaRecorderRef.current === recorder && recorder.state !== "inactive") {
        recorder.stop();
        setIsRecording(false);
        setIsPaused(false);
      }
    }, 60_000);
  }, [navigate, facing, currentFilterCss, stopMirrorDrawLoop]);

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
    if (timer > 0) {
      setCapturePhase("counting");
      setCountdownRemaining(timer);
    } else {
      performCapture();
    }
  }, [capturePhase, mode, isRecording, timer, performCapture, stopRecording]);

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

      <div
        className="absolute overflow-hidden"
        style={{
          left: "50%",
          top: "50%",
          width: previewWidth,
          height: previewHeight,
          transform: "translate(-50%, -50%)",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: currentFilterCss, transform: facing === "user" ? "scaleX(-1)" : "none" }}
        />
      </div>

      {screenFlashActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            // was: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.35), rgba(255,255,255,0.05) 70%)"
            // now: transparent center (keeps framing visible) fading into a fat, near-opaque white ring at the edges
            background:
              "radial-gradient(ellipse at 50% 40%, transparent 0%, transparent 38%, rgba(255,255,255,0.55) 70%, rgba(255,255,255,0.95) 100%)",
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
          if (tool.id === "timer") {
            return (
              <button
                key="timer"
                onClick={() => setOpenPanel("timer")}
                aria-label="Timer"
                className="flex items-center gap-2 relative"
              >
                <AnimatedLabel visible={labelsVisible}>
                  {timer === 0 ? "Timer" : `Timer: ${timer}s`}
                </AnimatedLabel>
                <span className="relative flex items-center justify-center">
                  <TimerIcon size={26} />
                  {timer > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 text-[10px] font-bold rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, background: "#fff", color: "#000" }}
                    >
                      {timer}
                    </span>
                  )}
                </span>
              </button>
            );
          }
          if (tool.id === "ratio") {
            return (
              <button
                key="ratio"
                onClick={() => setOpenPanel("ratio")}
                aria-label="Ratio"
                className="flex items-center gap-2"
              >
                <AnimatedLabel visible={labelsVisible}>{`Ratio: ${ratio}`}</AnimatedLabel>
                <RatioIcon size={26} />
              </button>
            );
          }
          if (tool.id === "layout") {
            return (
              <button
                key="layout"
                onClick={() => setOpenPanel("layout")}
                aria-label="Layout"
                className="flex items-center gap-2"
              >
                <AnimatedLabel visible={labelsVisible}>{`Layout: ${activeLayout.name}`}</AnimatedLabel>
                <LayoutGrid size={26} />
              </button>
            );
          }
          // filters
          return (
            <button
              key="filters"
              onClick={() => setOpenPanel("filters")}
              aria-label={isNonDefaultFilterActive ? "More filters" : "Filters"}
              className="flex items-center gap-2 opacity-90"
            >
              <AnimatedLabel visible={labelsVisible}>
                {isNonDefaultFilterActive ? activeFilter.name : "Filters"}
              </AnimatedLabel>
              <span
                className="flex items-center justify-center transition-transform duration-200 ease-out"
                style={{ transform: isNonDefaultFilterActive ? "scale(1.3)" : "scale(1)" }}
              >
                <Blend size={26} />
              </span>
            </button>
          );
        })}

        {isNonDefaultFilterActive && (
          <button
            onClick={() => toggleFilterFavorite(selectedFilterId)}
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
        {quickStripFilters.map((f, i) => (
          <button
            key={f.id}
            onClick={() => scrollFilterIntoRing(i)}
            className="shrink-0 flex items-center justify-center"
            style={{ width: CAPTURE_SIZE, scrollSnapAlign: "center" }}
          >
            <span
              className="rounded-full overflow-hidden block"
              style={{ width: SWATCH_DIAMETER, height: SWATCH_DIAMETER, background: f.thumbnailColor }}
            />
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

      <button
        onClick={() => setFlashOn((v) => !v)}
        aria-label={flashOn ? "Turn flash off" : "Turn flash on"}
        aria-pressed={flashOn}
        className="absolute flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
        style={{
          zIndex: 3,
          left: ROW_EDGE,
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM + (CAPTURE_SIZE - ROTATE_SIZE) / 2 + ROTATE_SIZE + 12}px)`,
          width: FLASH_TOGGLE_SIZE,
          height: FLASH_TOGGLE_SIZE,
          background: flashOn ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.10)",
          color: flashOn ? "#000" : "#fff",
          backdropFilter: "blur(12px)",
        }}
      >
        {flashOn ? <Zap size={16} /> : <ZapOff size={16} />}
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

      <RatioPanel
        open={openPanel === "ratio"}
        value={ratio}
        onChange={setRatio}
        onClose={() => setOpenPanel(null)}
      />
      <TimerPanel
        open={openPanel === "timer"}
        value={timer}
        onChange={setTimer}
        onClose={() => setOpenPanel(null)}
      />
      <FilterPanel
        open={openPanel === "filters"}
        selectedId={selectedFilterId}
        favoriteIds={favoritedFilterIds}
        onClose={() => setOpenPanel(null)}
        onPreview={setSelectedFilterId}
        onApply={setSelectedFilterId}
        onToggleFavorite={toggleFilterFavorite}
      />
      <LayoutPanel
        open={openPanel === "layout"}
        value={selectedLayoutId}
        savedIds={savedLayoutIds}
        onClose={() => setOpenPanel(null)}
        onChange={setSelectedLayoutId}
        onToggleSave={toggleLayoutSaved}
      />
    </div>
  );
  
}