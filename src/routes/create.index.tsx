import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback, type ReactNode, type TouchEvent } from "react";
import {
  X, RefreshCw, Timer as TimerIcon, Image as ImageIcon,
  ChevronUp, ChevronDown, LayoutGrid, Ratio as RatioIcon, Blend, Heart,
  Pause, Play, Square, Zap, ZapOff, Grid3x3,
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
import LayoutPreview from "@/components/camera/LayoutPreview";
import LiquidGlassSegmented from "@/components/camera/LiquidGlassSegmented";
import { CAMERA_FILTERS } from "@/components/camera/filter-data";
import { CAMERA_LAYOUTS } from "@/components/camera/layout-data";
import type { CameraLayout, LayoutCell } from "@/components/camera/layout-data";

export const Route = createFileRoute("/create/")({
  head: () => ({ meta: [{ title: "Create — Oakmonte" }] }),
  component: CreatePage,
});

type Mode = "photo" | "video";
type Section = "shoot" | "create";
type CapturePhase = "live" | "counting";
type PanelType = "ratio" | "timer" | "layout" | "filters";

// A single captured, already-cropped/filtered/mirrored frame for one layout
// cell. Kept as a canvas (not a blob) since it still needs to be drawn onto
// the final composite canvas — converting to a blob is the very last step.
type CellCapture = { canvas: HTMLCanvasElement };

const DEFAULT_FILTER_ID = "natural";
const DEFAULT_LAYOUT_ID = "fit-check";
// Numeric width/height for each ratio — used both for the CSS aspect-ratio
// on the preview box and for cropping captured frames, so what's shot always
// matches what was framed.
const RATIO_ASPECT: Record<CameraRatio, number> = {
  "9:16": 9 / 16,
  "3:4": 3 / 4,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
};

// Output pixel width used for the final composite canvas AND, proportionally,
// for each individual cell capture's own canvas — shared so a cell's stored
// resolution lines up with how large it'll actually be drawn in the final
// composite instead of guessing at a size.
const COMPOSITE_WIDTH = 1080;

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
const FLASH_TOGGLE_SIZE = 47;
const GALLERY_ICON_SIZE = 40;
const CAPTURE_SIZE = 84;
const ROW_EDGE = 20;
// Pushed closer to the screen edge (was ROW_EDGE + 56) to free up clear space
// above the filter strip for the mode toggle to sit in.
const CAPTURE_ROW_BOTTOM = ROW_EDGE + 25;
const CAPTURE_ROW_TOP = CAPTURE_ROW_BOTTOM + CAPTURE_SIZE;

// Bottom-most of the three left-column icons (flash top, rotate middle,
// gallery bottom).
const GALLERY_ICON_BOTTOM = ROW_EDGE + 0;

// Gap between the mode toggle's bottom edge and the filter strip's top edge.
const MODE_PILL_GAP = 8;
const MODE_PILL_BOTTOM = CAPTURE_ROW_TOP + MODE_PILL_GAP;
const MODE_PILL_TAB_WIDTH = 92; // fatter than the previous 74px

const SWATCH_DIAMETER = CAPTURE_SIZE - 16;
const BARRIER_EDGE = ROW_EDGE + ROTATE_SIZE + 10;
const BARRIER_HEIGHT = SWATCH_DIAMETER + 12;

const TOOLS: { id: PanelType; label: string }[] = [
  { id: "ratio", label: "Ratio" },
  { id: "timer", label: "Timer" },
  { id: "layout", label: "Layout" },
  { id: "filters", label: "Filters" },
];

function AnimatedLabel({ visible, children }: { visible: boolean; children: ReactNode }) {
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
  // One live-preview <video> per empty layout cell during multi-cell
  // capture, all bound to the same MediaStream — see the streamVersion
  // effect below for why they need explicit rebinding on camera switch.
  const cellVideoRefsRef = useRef<(HTMLVideoElement | null)[]>([]);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [mode, setMode] = useState<Mode>("photo");
  const [section, setSection] = useState<Section>("shoot");
  const [labelsVisible, setLabelsVisible] = useState(false);

  // --- Camera panel architecture ---
  // CreatePage owns state; each panel owns its own UI/interaction.
  const [openPanel, setOpenPanel] = useState<PanelType | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [ratio, setRatio] = useState<CameraRatio>("9:16");
  const [timer, setTimer] = useState<CameraTimer>(0);
  const [selectedFilterId, setSelectedFilterId] = useState(DEFAULT_FILTER_ID);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());
  const [randomFillerIds, setRandomFillerIds] = useState<string[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState(DEFAULT_LAYOUT_ID);
  const [savedLayoutIds, setSavedLayoutIds] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(1);
  // What's actually applied to the video's CSS transform. Kept separate from
  // zoomLevel: zoomLevel tracks *effective* zoom so a pinch can resume from
  // the right place, but only the digital-fallback path should ever move
  // this above 1 — CSS-scaling a video the hardware already zoomed optically
  // double-applies it, which is what was dragging the back camera's frame.
  const [cssZoomScale, setCssZoomScale] = useState(1);
  const zoomCapabilitiesRef = useRef<{ min: number; max: number; step: number } | null>(null);
  const pinchStateRef = useRef<{ startDistance: number; startZoom: number } | null>(null);

  const [capturePhase, setCapturePhase] = useState<CapturePhase>("live");
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // --- Multi-cell layout capture ---
  // Keyed by layout id so progress isn't lost if the user switches to a
  // different layout mid-sequence and comes back.
  const [cellCapturesByLayout, setCellCapturesByLayout] = useState<Record<string, (CellCapture | null)[]>>({});
  const [activeCellIndex, setActiveCellIndex] = useState(0);
  // Bumped whenever a new camera stream is acquired (e.g. facing flip) so
  // the per-cell preview <video> elements — which hold their own srcObject
  // outside the effect that owns streamRef — know to rebind to it.
  const [streamVersion, setStreamVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        // No aspectRatio hint here on purpose — hinting the hardware to any
        // target shape makes it pick a pre-cropped, zoomed-in capture mode
        // instead of giving us the sensor's full native view. We always
        // request the widest natural capture and crop to the selected ratio
        // ourselves in getCropRect, which keeps the framing wide and lets
        // us control the crop precisely instead of trusting the hardware to.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: 1920 },
            frameRate: { ideal: 60 },
          },
          audio: mode === "video",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStreamVersion((v) => v + 1);

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & {
          zoom?: { min: number; max: number; step: number };
        }) | undefined;
        zoomCapabilitiesRef.current = caps?.zoom ?? null;
        setZoomLevel(1);
        setCssZoomScale(1);
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

  // Rebind every per-cell live-preview video to the current stream whenever
  // it changes — these elements set srcObject imperatively via ref callback
  // on mount, but a facing-flip swaps streamRef.current out from under them
  // without remounting them, so they'd otherwise keep showing a dead stream.
  useEffect(() => {
    cellVideoRefsRef.current.forEach((el) => {
      if (el && streamRef.current) el.srcObject = streamRef.current;
    });
  }, [streamVersion]);

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

  // Preview box aspect ratio — width/height, matching CSS aspect-ratio syntax.
  // No JS viewport measurement anymore: the box is width:100% with this
  // aspect-ratio applied, so the browser derives height natively on every
  // paint. This is what actually fixes the width bug — there's no longer a
  // JS measurement step that can race against hydration/load timing.
  const targetAspect = RATIO_ASPECT[ratio];
  const isFullBleedRatio = ratio === "9:16"; // your default/story ratio already fills the screen edge-to-edge

  const activeLayout =
    CAMERA_LAYOUTS.find((l) => l.id === selectedLayoutId) ?? CAMERA_LAYOUTS[0];

  // Multi-cell mode only ever applies to photo capture — video-cell
  // compositing is real scope (audio, mismatched durations, actual editing)
  // and deliberately not attempted here.
  const isMultiCellActive = mode === "photo" && activeLayout.cells.length > 1;
  const cellCaptures = cellCapturesByLayout[activeLayout.id] ?? [];

  // Lazily initialize this layout's cell slots the first time it's used.
  useEffect(() => {
    if (activeLayout.cells.length <= 1) return;
    setCellCapturesByLayout((prev) => {
      if (prev[activeLayout.id]) return prev;
      return { ...prev, [activeLayout.id]: new Array(activeLayout.cells.length).fill(null) };
    });
  }, [activeLayout.id, activeLayout.cells.length]);

  // Keep activeCellIndex pointed at the first empty cell for whichever
  // layout is currently selected — this is what makes switching layouts and
  // switching back "resume where you left off" instead of losing progress.
  useEffect(() => {
    if (activeLayout.cells.length <= 1) return;
    const captures = cellCapturesByLayout[activeLayout.id];
    if (!captures) return;
    const firstEmpty = captures.findIndex((c) => c === null);
    setActiveCellIndex(firstEmpty === -1 ? 0 : firstEmpty);
  }, [activeLayout.id, activeLayout.cells.length, cellCapturesByLayout]);

  // Front-camera screen flash, driven by the same flashOn toggle.
  const screenFlashActive = facing === "user" && flashOn;
  const currentFilterCss = screenFlashActive
    ? `${activeFilter.css} brightness(1.25)`
    : activeFilter.css;

  const applyZoom = useCallback((level: number) => {
    const caps = zoomCapabilitiesRef.current;
    const track = streamRef.current?.getVideoTracks()[0];
    // Real optical/hybrid zoom hardware only exists on the back camera.
    // Front cameras frequently report a zoom capability object anyway —
    // trusting that blindly was the actual bug: it silently sent
    // front-camera zoom through a no-op applyConstraints call, then clamped
    // it to whatever narrow range was reported (often exactly 1..1), which
    // is why zoom-out never worked there no matter what.
    if (facing === "environment" && caps && track) {
      // Hardware zoom — the camera itself changes what it captures. No CSS
      // scale on top of it, or it gets applied twice (this was the back-
      // camera "whole frame drags with it" bug).
      const clamped = Math.min(caps.max, Math.max(caps.min, level));
      (track.applyConstraints as any)({ advanced: [{ zoom: clamped }] }).catch(() => {});
      setZoomLevel(clamped);
      setCssZoomScale(1);
    } else {
      // Digital fallback — always used for the front camera, and for any
      // back camera without real zoom hardware. CSS-scale is the only zoom
      // that exists here, since nothing else is doing it for us.
      const clamped = Math.min(3, Math.max(1, level));
      setZoomLevel(clamped);
      setCssZoomScale(clamped);
    }
  }, [facing]);

  const handlePinchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchStateRef.current = { startDistance: distance, startZoom: zoomLevel };
  }, [zoomLevel]);

  const handlePinchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 2 || !pinchStateRef.current) return;
    e.preventDefault(); // stop the page/browser from also interpreting this as a page-zoom gesture
    const [a, b] = [e.touches[0], e.touches[1]];
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const { startDistance, startZoom } = pinchStateRef.current;
    const nextZoom = startZoom * (distance / startDistance);
    applyZoom(nextZoom);
  }, [applyZoom]);

  const handlePinchEnd = useCallback(() => {
    pinchStateRef.current = null;
  }, []);

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
  }, [facing, currentFilterCss, navigate, ratio]);

  // Captures one layout cell exactly the way capturePhoto captures a full
  // single shot: center-crop the WHOLE raw camera frame to a target aspect
  // ratio, mirror if needed, apply the filter. The only difference is the
  // target aspect is this cell's own shape (cell.w/h scaled by the overall
  // ratio), not the full composite's shape — so each cell gets a properly
  // framed, full-FOV subject instead of a positional fragment of one shared
  // frame. This is what makes it match the reference multi-cam apps.
  const captureCellFrame = useCallback((cell: LayoutCell) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      console.warn("Camera not ready yet", video?.readyState, video?.videoWidth);
      return null;
    }

    const cellAspect = (cell.w / cell.h) * targetAspect;
    const { sx, sy, sw, sh } = getCropRect(video.videoWidth, video.videoHeight, cellAspect);

    const outputW = Math.max(1, Math.round(cell.w * COMPOSITE_WIDTH));
    const outputH = Math.max(1, Math.round(outputW / cellAspect));
    const canvas = document.createElement("canvas");
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

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
    return canvas;
  }, [facing, currentFilterCss, targetAspect]);

  // Flattens every filled cell onto one output canvas at the layout's
  // fractional rects, then hands off exactly like a normal single photo —
  // AfterShotContext never has to know a layout was involved.
  const compositeAndHandoff = useCallback((layout: CameraLayout, captures: (CellCapture | null)[]) => {
    const W = COMPOSITE_WIDTH;
    const H = Math.round(W / targetAspect);
    const output = document.createElement("canvas");
    output.width = W;
    output.height = H;
    const ctx = output.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const gap = 4; // thin seam between cells, matching LayoutPreview's spirit
    layout.cells.forEach((cell, i) => {
      const capture = captures[i];
      if (!capture) return;
      const dx = cell.x * W + gap / 2;
      const dy = cell.y * H + gap / 2;
      const dw = cell.w * W - gap;
      const dh = cell.h * H - gap;
      ctx.drawImage(capture.canvas, dx, dy, dw, dh);
    });

    output.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPendingCapture({ type: "photo", blob, url });
        navigate({ to: "/create/after-shot" });
      },
      "image/jpeg",
      0.96,
    );
  }, [targetAspect, navigate]);

  const captureIntoActiveCell = useCallback(() => {
    const cell = activeLayout.cells[activeCellIndex];
    if (!cell) return;
    const canvas = captureCellFrame(cell);
    if (!canvas) return;

    setCellCapturesByLayout((prev) => {
      const existing = prev[activeLayout.id] ?? new Array(activeLayout.cells.length).fill(null);
      const next = [...existing];
      next[activeCellIndex] = { canvas };
      if (next.every((c) => c !== null)) {
        compositeAndHandoff(activeLayout, next);
      }
      return { ...prev, [activeLayout.id]: next };
    });
  }, [activeLayout, activeCellIndex, captureCellFrame, compositeAndHandoff]);

  // Tapping an empty cell jumps the active slot to it; tapping a filled
  // cell clears it and makes it active again — a retake, nothing more.
  const handleCellTap = useCallback((index: number) => {
    setCellCapturesByLayout((prev) => {
      const existing = prev[activeLayout.id];
      if (!existing) return prev;
      if (existing[index] === null) {
        setActiveCellIndex(index);
        return prev;
      }
      const next = [...existing];
      next[index] = null;
      return { ...prev, [activeLayout.id]: next };
    });
  }, [activeLayout.id]);

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
  }, [navigate, facing, currentFilterCss, stopMirrorDrawLoop, ratio]);

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
    if (mode === "photo") {
      if (isMultiCellActive) captureIntoActiveCell();
      else capturePhoto();
    } else {
      startRecording();
    }
  }, [mode, isMultiCellActive, captureIntoActiveCell, capturePhoto, startRecording]);

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
        onTouchStart={handlePinchStart}
        onTouchMove={handlePinchMove}
        onTouchEnd={handlePinchEnd}
        className="absolute overflow-hidden"
        style={{
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: "100%",
          aspectRatio: String(targetAspect),
          borderRadius: isFullBleedRatio ? 0 : 20,
          boxShadow: isFullBleedRatio ? "none" : "0 12px 40px rgba(0,0,0,0.55)",
          border: isFullBleedRatio ? "none" : "1px solid rgba(255,255,255,0.08)",
          transition: "border-radius 250ms ease-out, box-shadow 250ms ease-out",
          touchAction: "none", // prevents the browser's own pinch-to-zoom/pan from firing here
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
              filter: currentFilterCss,
              transform: facing === "user"
                ? `scaleX(-1) scale(${cssZoomScale})`
                : `scale(${cssZoomScale})`,
              transition: pinchStateRef.current ? "none" : "transform 100ms ease-out",
            }}
        />
        {gridVisible && (
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.35 }}>
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white" />
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
          </div>
        )}

        {isMultiCellActive && (
          <LayoutPreview
            layout={activeLayout}
            gap={2}
            activeCellIndex={activeCellIndex}
            className="absolute inset-0"
            renderCell={(_cell, i) => {
  const capture = cellCaptures[i];
  const isActive = i === activeCellIndex;
  return (
    <button
      type="button"
      onClick={() => handleCellTap(i)}
      aria-label={capture ? `Retake shot ${i + 1}` : `Cell ${i + 1}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        padding: 0,
        border: "none",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {capture ? (
        <img
          src={capture.canvas.toDataURL()}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : isActive ? (
        // Only the cell currently being shot gets a live pane — every
        // other empty cell falls through to the button's own black
        // background instead. Previously every empty cell showed a live
        // feed at once, which made it unclear which one you were about
        // to capture into.
        <video
          ref={(el) => {
            cellVideoRefsRef.current[i] = el;
            if (el && streamRef.current) el.srcObject = streamRef.current;
          }}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            // cssZoomScale added here too — this was the actual bug.
            // The main preview video applies zoom via this same
            // transform, but this per-cell video sits on top of it once
            // a layout is active, so it needed the same scale applied
            // directly or front-camera (CSS-only) zoom silently did
            // nothing while a layout was selected.
            transform: facing === "user"
              ? `scaleX(-1) scale(${cssZoomScale})`
              : `scale(${cssZoomScale})`,
          }}
        />
      ) : null}
    </button>
  );
}}
          />
        )}
      </div>

      {screenFlashActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
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
                <AnimatedLabel visible={labelsVisible}>
                  {isMultiCellActive
                    ? `${activeCellIndex + 1} of ${activeLayout.cells.length}`
                    : `Layout: ${activeLayout.name}`}
                </AnimatedLabel>
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

        <button
          onClick={() => setGridVisible((v) => !v)}
          aria-label={gridVisible ? "Hide grid" : "Show grid"}
          aria-pressed={gridVisible}
          className="flex items-center gap-2"
        >
          <AnimatedLabel visible={labelsVisible}>
            {gridVisible ? "Grid: On" : "Grid"}
          </AnimatedLabel>
          <Grid3x3 size={26} style={{ opacity: gridVisible ? 1 : 0.7 }} />
        </button>

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
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: `calc(env(safe-area-inset-bottom) + ${MODE_PILL_BOTTOM}px)`,
          zIndex: 5,
        }}
      >
        <LiquidGlassSegmented
          options={[
            { value: "photo", label: "Photo" },
            { value: "video", label: "Video" },
          ]}
          value={mode}
          onChange={setMode}
          disabled={isRecording}
          tabWidth={MODE_PILL_TAB_WIDTH}
        />
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

      <button
        aria-label="Import from gallery"
        onClick={() => galleryInputRef.current?.click()}
        className="absolute rounded-xl overflow-hidden flex items-center justify-center"
        style={{
          zIndex: 3,
          left: ROW_EDGE,
          bottom: `calc(env(safe-area-inset-bottom) + ${GALLERY_ICON_BOTTOM}px)`,
          width: GALLERY_ICON_SIZE,
          height: GALLERY_ICON_SIZE,
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
          onClick={() => setSection("shoot")}
          className="uppercase text-sm font-bold tracking-wide"
          style={{ opacity: section === "shoot" ? 1 : 0.5 }}
        >
          SHOOT
        </button>
        <button
          onClick={() => setSection("create")}
          className="uppercase text-sm font-bold tracking-wide"
          style={{ opacity: section === "create" ? 1 : 0.5 }}
        >
          CREATE
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