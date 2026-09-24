import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type TouchEvent,
  type PointerEvent,
} from "react";
import {
  X,
  RefreshCw,
  Timer as TimerIcon,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  Ratio as RatioIcon,
  Blend,
  Heart,
  Zap,
  ZapOff,
  Grid3x3,
} from "lucide-react";

import { compileFilter, applyCompiledFilter, IDENTITY_FILTER } from "@/lib/canvas-filter";
import { setPendingCapture } from "@/lib/capture-handoff";
import { getLastNonCreateRoute } from "@/lib/last-visited-route";
import { useFilterThumbnail } from "@/lib/filter-thumbnail";
import { exportVideo } from "@/lib/after-shot-export";

import RatioPanel, { type CameraRatio } from "@/components/camera/RatioPanel";
import TimerPanel, { type CameraTimer } from "@/components/camera/TimerPanel";
import FilterPanel from "@/components/camera/FilterPanel";
import LayoutPanel from "@/components/camera/LayoutPanel";
import LayoutPreview from "@/components/camera/LayoutPreview";
import CreatePanel from "@/components/create/CreatePanel";
import { useDraftCount } from "@/hooks/use-draft-count";
import {
  CAMERA_FILTERS,
  compileGrade,
  previewCssAtIntensity,
  type CameraFilter,
} from "@/components/camera/filter-data";
import { CAMERA_LAYOUTS } from "@/components/camera/layout-data";
import type { CameraLayout, LayoutCell } from "@/components/camera/layout-data";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

export const Route = createFileRoute("/create/")({
  // `?tab=create` opens straight onto the CREATE panel instead of the camera.
  // The editors back out to it, and landing on the viewfinder after leaving
  // the photo editor is a jump to a screen you were never on.
  validateSearch: (search: Record<string, unknown>): { tab?: "create" } =>
    search.tab === "create" ? { tab: "create" } : {},
  head: () => ({ meta: [{ title: "Create — Oakmonte" }] }),
  component: CreatePage,
});

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

// `zoom` is a real MediaTrack constraint on Android/Chrome but isn't in
// TypeScript's DOM lib yet — extend the standard set rather than casting
// applyConstraints itself to `any`, which would also drop its Promise type.
type ZoomConstraintSet = MediaTrackConstraintSet & { zoom?: number };
// Torch constraint is not in the standard MediaTrackConstraintSet but is implemented by some browsers.
interface TorchConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
}

// Centered crop rect (in source pixel coords) that matches what object-cover
// would render inside a box of targetAspect — used identically for the live
// preview box and for both capture paths, so they stay in sync.
function getCropRect(sourceWidth: number, sourceHeight: number, targetAspect: number) {
  const sourceAspect = sourceWidth / sourceHeight;
  let sx = 0,
    sy = 0,
    sw = sourceWidth,
    sh = sourceHeight;
  if (sourceAspect > targetAspect) {
    sw = sourceHeight * targetAspect;
    sx = (sourceWidth - sw) / 2;
  } else if (sourceAspect < targetAspect) {
    sh = sourceWidth / targetAspect;
    sy = (sourceHeight - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

// Narrows a centered crop rect by the current CSS-only zoom factor, keeping
// it centered — this is what makes captured photos/videos/cells actually
// reflect what was visually zoomed in on screen. Hardware zoom (back
// camera, where supported) is already baked into the raw frame by the time
// we get here, which is exactly why cssZoomScale sits at 1 in that case —
// multiplying by 1 correctly does nothing.
function applyZoomToCrop(crop: { sx: number; sy: number; sw: number; sh: number }, zoom: number) {
  const zsw = crop.sw / zoom;
  const zsh = crop.sh / zoom;
  return {
    sx: crop.sx + (crop.sw - zsw) / 2,
    sy: crop.sy + (crop.sh - zsh) / 2,
    sw: zsw,
    sh: zsh,
  };
}

// A real baked preview of the filter's grade instead of a flat color circle —
// see filter-thumbnail.ts. The swatch color still shows as a skeleton for the
// instant before the bake resolves, so the strip never flashes empty.
function FilterSwatchThumb({ filter, diameter }: { filter: CameraFilter; diameter: number }) {
  const thumb = useFilterThumbnail(filter);
  return (
    <span
      className="rounded-full overflow-hidden block bg-cover bg-center"
      style={{
        width: diameter,
        height: diameter,
        backgroundColor: filter.thumbnailColor,
        backgroundImage: thumb ? `url(${thumb})` : undefined,
      }}
    />
  );
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

// All three left-column icons (flip, flash, gallery) share this CENTER x —
// not ROW_EDGE as a shared left edge, which is what they used to share. Their
// widths differ (48/47/40), so a shared left edge put their visual centers up
// to 13px apart: to a designer's eye they visibly didn't line up in a column.
// Anchored on the widest icon (flip camera) so its position is unchanged.
const ICON_COLUMN_CENTER_X = ROW_EDGE + ROTATE_SIZE / 2;
const iconColumnLeft = (size: number) => ICON_COLUMN_CENTER_X - size / 2;
// Pushed closer to the screen edge (was ROW_EDGE + 56). The space above the
// strip used to hold the Photo/Video toggle; it now holds the recording timer.
const CAPTURE_ROW_BOTTOM = ROW_EDGE + 25;
const CAPTURE_ROW_TOP = CAPTURE_ROW_BOTTOM + CAPTURE_SIZE;

// The three left-column icons, stacked bottom-to-top as gallery, rotate,
// flash — spaced by one shared gap regardless of their differing heights.
// Lifted a small amount off the row's base offset — enough that gallery, the
// lowest of the three, isn't flush against the very bottom edge, but still
// well under the top of the capture row so the column doesn't float
// independently of it.
const ICON_COLUMN_GAP = 12;
const ICON_COLUMN_LIFT = 6;
const ROTATE_BOTTOM = CAPTURE_ROW_BOTTOM + (CAPTURE_SIZE - ROTATE_SIZE) / 2 + ICON_COLUMN_LIFT;
const FLASH_TOGGLE_BOTTOM = ROTATE_BOTTOM + ROTATE_SIZE + ICON_COLUMN_GAP;
const GALLERY_ICON_BOTTOM = ROTATE_BOTTOM - ICON_COLUMN_GAP - GALLERY_ICON_SIZE;

// Snapchat-style shutter: tap for a photo, hold to record, slide up while
// holding to zoom. There is no Photo/Video toggle — the gesture is the mode.
//
// 250ms: a deliberate tap lifts well inside it, and a hold starts recording
// before it registers as a wait.
const HOLD_TO_RECORD_MS = 250;
// Past this many pixels before recording starts, the gesture is a filter
// swipe, not a press.
const HOLD_SLOP_PX = 10;
const MAX_RECORD_SECONDS = 60;
// A MediaRecorder stopped a few frames in can hand back a clip nothing will
// decode. Letting go sooner than this still stops — just this late.
const MIN_RECORD_MS = 600;
// Finger travel upward (px) per 1x of zoom while recording.
const ZOOM_DRAG_PX_PER_X = 90;
// While recording the shutter grows, like Snapchat's, so the red progress ring
// is visible past the thumb holding it.
const RECORDING_RING_SCALE = 1.3;
// Recording timer sits where the Photo/Video toggle used to.
const RECORD_TIMER_BOTTOM = CAPTURE_ROW_TOP + 8 + (CAPTURE_SIZE * (RECORDING_RING_SCALE - 1)) / 2;

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
  const rootRef = useRef<HTMLDivElement>(null);
  useLockedViewport();
  const navigate = useNavigate();
  const draftCount = useDraftCount();
  const search = Route.useSearch();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const filterStripRef = useRef<HTMLDivElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mirrorDrawLoopRef = useRef<number | null>(null);
  const mirrorCanvasStreamRef = useRef<MediaStream | null>(null);
  // `applyConstraints` replaces the whole `advanced` set rather than merging
  // it, so the torch effect and applyZoom's hardware-zoom branch — two
  // independent call sites on the same track — would silently clobber each
  // other's setting (e.g. pinch-zooming turned the torch back off with no
  // explicit torch-off call). This tracks the last-known value of every key
  // we control so every applyConstraints call re-asserts all of them together.
  const advancedConstraintsRef = useRef<{ zoom?: number; torch?: boolean }>({});
  // One live-preview <video> per empty layout cell during multi-cell
  // capture, all bound to the same MediaStream — see the streamVersion
  // effect below for why they need explicit rebinding on camera switch.
  const cellVideoRefsRef = useRef<(HTMLVideoElement | null)[]>([]);

  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [section, setSection] = useState<Section>(search.tab === "create" ? "create" : "shoot");
  const [labelsVisible, setLabelsVisible] = useState(false);

  // --- Camera panel architecture ---
  // CreatePage owns state; each panel owns its own UI/interaction.
  const [openPanel, setOpenPanel] = useState<PanelType | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [gridVisible, setGridVisible] = useState(false);
  const [ratio, setRatio] = useState<CameraRatio>("9:16");
  const [timer, setTimer] = useState<CameraTimer>(0);
  const [selectedFilterId, setSelectedFilterId] = useState(DEFAULT_FILTER_ID);
  // Reset to the newly-picked filter's own default (100) whenever the id
  // changes via the swipe strip; FilterPanel sets both together explicitly
  // when the user drags its own intensity slider instead.
  const [filterIntensity, setFilterIntensity] = useState(100);
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
  // The recording draw loop reads zoom per frame through this, so sliding up
  // to zoom mid-recording lands in the file and not just on the preview.
  const cssZoomRef = useRef(1);
  useEffect(() => {
    cssZoomRef.current = cssZoomScale;
  }, [cssZoomScale]);
  const zoomCapabilitiesRef = useRef<{ min: number; max: number; step: number } | null>(null);
  const pinchStateRef = useRef<{ startDistance: number; startZoom: number } | null>(null);

  const [capturePhase, setCapturePhase] = useState<CapturePhase>("live");
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  // Seconds recorded so far, for the timer above the shutter.
  const [recordSeconds, setRecordSeconds] = useState(0);
  // True only while a recording that used a true-LUT filter is being
  // re-graded post-recording — see startRecording's needsPostGrade. Every
  // other capture (photo, or a video whose filter is matrix-only) never
  // touches this; it stays false and navigates on immediately.
  const [isGradingVideo, setIsGradingVideo] = useState(false);
  const [gradingProgress, setGradingProgress] = useState(0);

  // --- Multi-cell layout capture ---
  // Keyed by layout id so progress isn't lost if the user switches to a
  // different layout mid-sequence and comes back.
  const [cellCapturesByLayout, setCellCapturesByLayout] = useState<
    Record<string, (CellCapture | null)[]>
  >({});
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
        const video = {
          facingMode: facing,
          width: { ideal: 1920 },
          frameRate: { ideal: 30 },
        };
        // Audio is opened up front, not when a hold starts: asking for the mic
        // mid-hold would put a permission sheet (and on iOS a stall) between
        // the finger going down and the recording starting. A refused mic
        // still leaves a working camera — it just records silent.
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        } catch (err) {
          console.warn("Microphone unavailable, recording without sound:", err);
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // A new track means the old advanced-constraint values (zoom/torch)
        // are stale for it — the torch effect re-pushes flashOn's current
        // value itself once this new track is ready, so it doesn't need a
        // carried-over value here.
        advancedConstraintsRef.current = {};
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStreamVersion((v) => v + 1);

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & {
              zoom?: { min: number; max: number; step: number };
            })
          | undefined;
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
  }, [facing]);

  // Rebind every per-cell live-preview video to the current stream whenever
  // it changes — these elements set srcObject imperatively via ref callback
  // on mount, but a facing-flip swaps streamRef.current out from under them
  // without remounting them, so they'd otherwise keep showing a dead stream.
  useEffect(() => {
    cellVideoRefsRef.current.forEach((el) => {
      if (el && streamRef.current) el.srcObject = streamRef.current;
    });
  }, [streamVersion]);

  // Rear-camera torch
  // getCapabilities() doesn't reliably reflect torch support the instant the
  // track exists — how long it takes to settle varies by device, so a single
  // fixed delay was still missing it on some phones. Retry a few times with
  // backoff instead of gambling on one timeout, and stop as soon as the
  // capability check succeeds (or we run out of attempts).
  useEffect(() => {
    if (facing !== "environment" || !streamRef.current) return;

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 6;

    const tryApply = () => {
      if (cancelled) return;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;

      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
        torch?: boolean;
      };

      if (capabilities && capabilities.torch) {
        // Re-assert zoom alongside torch — applyConstraints replaces the
        // whole `advanced` set, so writing torch alone would silently drop
        // whatever zoom value the hardware-zoom branch last set.
        advancedConstraintsRef.current = { ...advancedConstraintsRef.current, torch: flashOn };
        track
          .applyConstraints({ advanced: [advancedConstraintsRef.current as TorchConstraintSet] })
          .catch((err) => console.error("Torch constraint failed:", err));
        return;
      }

      attempt += 1;
      if (attempt < maxAttempts) {
        timer = setTimeout(tryApply, 150 * attempt);
      }
    };

    // Give the sensor a beat to mount before the first check.
    let timer = setTimeout(tryApply, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [flashOn, facing, streamVersion]);

  // A direct navigate to wherever the seller actually came from (tracked in
  // last-visited-route.ts), not window.history.back() — this is opened from
  // an in-app "+" tab (BottomNav), often inside a third-party in-app browser
  // (Instagram/TikTok webviews, when reached via a bio link) where native
  // history.back() behavior is inconsistent and can feel sluggish or
  // unresponsive, since it competes with the host app's own back handling
  // instead of being a plain client-side route change we control.
  const handleBack = useCallback(() => {
    navigate({ to: getLastNonCreateRoute() });
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
    if (next && next.id !== selectedFilterId) {
      setSelectedFilterId(next.id);
      setFilterIntensity(next.intensity);
    }
  }, [quickStripFilters, selectedFilterId]);

  const scrollFilterIntoRing = useCallback(
    (index: number) => {
      filterStripRef.current?.scrollTo({ left: index * CAPTURE_SIZE, behavior: "smooth" });
      const next = quickStripFilters[index];
      if (next) {
        setSelectedFilterId(next.id);
        setFilterIntensity(next.intensity);
      }
    },
    [quickStripFilters],
  );

  const activeFilter = CAMERA_FILTERS.find((f) => f.id === selectedFilterId) ?? CAMERA_FILTERS[0];
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

  const activeLayout = CAMERA_LAYOUTS.find((l) => l.id === selectedLayoutId) ?? CAMERA_LAYOUTS[0];

  // Multi-cell mode only ever applies to photo capture — video-cell
  // compositing is real scope (audio, mismatched durations, actual editing)
  // and deliberately not attempted here, so holding the shutter in a layout
  // does nothing but take the cell's photo.
  const isMultiCellActive = activeLayout.cells.length > 1;
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
  const previewFilterCssAtIntensity = previewCssAtIntensity(activeFilter, filterIntensity);
  const currentFilterCss = screenFlashActive
    ? `${previewFilterCssAtIntensity} brightness(1.25)`
    : previewFilterCssAtIntensity;

  // The true grade (LUT included) for one-shot bakes — shutter press, layout
  // cell capture. Screen-flash's brightness boost is a capture-time-only
  // simulation, so it's appended as an extra matrix op rather than folded
  // into the filter itself. Deliberately NOT used by the live preview
  // (currentFilterCss, above) or the recording draw loop (which stays on the
  // cheap matrix path) — see canvas-filter.ts's CompiledFilter doc.
  const resolveCaptureFilter = useCallback(() => {
    const graded = compileGrade(activeFilter, filterIntensity);
    if (!screenFlashActive) return graded;
    return { ops: [...graded.ops, ...compileFilter("brightness(1.25)").ops] };
  }, [activeFilter, filterIntensity, screenFlashActive]);

  const applyZoom = useCallback(
    (level: number) => {
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
        // Re-assert torch alongside zoom — see advancedConstraintsRef's doc.
        advancedConstraintsRef.current = { ...advancedConstraintsRef.current, zoom: clamped };
        track
          .applyConstraints({ advanced: [advancedConstraintsRef.current] as ZoomConstraintSet[] })
          .catch(() => {});
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
    },
    [facing],
  );

  const handlePinchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const [a, b] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStateRef.current = { startDistance: distance, startZoom: zoomLevel };
    },
    [zoomLevel],
  );

  const handlePinchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchStateRef.current) return;
      e.preventDefault(); // stop the page/browser from also interpreting this as a page-zoom gesture
      const [a, b] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const { startDistance, startZoom } = pinchStateRef.current;
      const nextZoom = startZoom * (distance / startDistance);
      applyZoom(nextZoom);
    },
    [applyZoom],
  );

  const handlePinchEnd = useCallback(() => {
    pinchStateRef.current = null;
  }, []);

  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);

  const handlePreviewTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setFocusPoint({ x, y });

    // Optional haptic tap response
    if (navigator.vibrate) navigator.vibrate(8);

    // Auto-hide the ring after 1.8 seconds
    setTimeout(() => setFocusPoint(null), 1800);
  };

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState < 2 || video.videoWidth === 0) {
      console.warn("Camera not ready yet", video.readyState, video.videoWidth);
      return;
    }
    const { sx, sy, sw, sh } = applyZoomToCrop(
      getCropRect(video.videoWidth, video.videoHeight, RATIO_ASPECT[ratio]),
      cssZoomScale,
    );
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const compiled = resolveCaptureFilter();
    if (compiled !== IDENTITY_FILTER) {
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
  }, [facing, resolveCaptureFilter, navigate, ratio, cssZoomScale]);

  // Captures one layout cell exactly the way capturePhoto captures a full
  // single shot: center-crop the WHOLE raw camera frame to a target aspect
  // ratio, mirror if needed, apply the filter. The only difference is the
  // target aspect is this cell's own shape (cell.w/h scaled by the overall
  // ratio), not the full composite's shape — so each cell gets a properly
  // framed, full-FOV subject instead of a positional fragment of one shared
  // frame. This is what makes it match the reference multi-cam apps.
  const captureCellFrame = useCallback(
    (cell: LayoutCell) => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        console.warn("Camera not ready yet", video?.readyState, video?.videoWidth);
        return null;
      }

      const cellAspect = (cell.w / cell.h) * targetAspect;
      const { sx, sy, sw, sh } = applyZoomToCrop(
        getCropRect(video.videoWidth, video.videoHeight, cellAspect),
        cssZoomScale,
      );

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

      const compiled = resolveCaptureFilter();
      if (compiled !== IDENTITY_FILTER) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyCompiledFilter(imgData, compiled);
        ctx.putImageData(imgData, 0, 0);
      }
      return canvas;
    },
    [facing, resolveCaptureFilter, targetAspect, cssZoomScale],
  );

  // Flattens every filled cell onto one output canvas at the layout's
  // fractional rects, then hands off exactly like a normal single photo —
  // AfterShotContext never has to know a layout was involved.
  const compositeAndHandoff = useCallback(
    (layout: CameraLayout, captures: (CellCapture | null)[]) => {
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
    },
    [targetAspect, navigate],
  );

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
  const handleCellTap = useCallback(
    (index: number) => {
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
    },
    [activeLayout.id],
  );

  const stopMirrorDrawLoop = useCallback(() => {
    if (mirrorDrawLoopRef.current !== null) {
      cancelAnimationFrame(mirrorDrawLoopRef.current);
      mirrorDrawLoopRef.current = null;
    }
    mirrorCanvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    mirrorCanvasStreamRef.current = null;
  }, []);

  const recordStartedAtRef = useRef(0);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return;
    recordedChunksRef.current = [];

    let recordingStream: MediaStream = stream;

    // A filter with a true LUT grade is deliberately NOT baked live below
    // (see resolveCaptureFilter's doc) — recording stays raw/unfiltered at
    // 30fps, and recorder.onstop further down runs the true grade once as a
    // post-process instead. A filter without a grade already IS its own
    // matrix at full accuracy, so those still bake live exactly as before:
    // no post-process, no extra encode generation, no change.
    const needsPostGrade = !!activeFilter.grade && filterIntensity > 0;
    const gradeFilter = activeFilter;
    const gradeIntensity = filterIntensity;

    if (video.videoWidth > 0) {
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      // The canvas is sized to the unzoomed crop; each frame samples the
      // crop narrowed by the zoom at that moment and scales it up to fill.
      const baseCrop = getCropRect(sourceWidth, sourceHeight, RATIO_ASPECT[ratio]);
      const { sx, sy, sw, sh } = baseCrop;
      const compiledFilterAtStart = needsPostGrade
        ? IDENTITY_FILTER
        : compileFilter(currentFilterCss);
      const shouldMirror = facing === "user";
      const cropIsNoop = sx === 0 && sy === 0 && sw === sourceWidth && sh === sourceHeight;
      // Digital zoom is a crop, so it needs the canvas. Only the back camera
      // with zoom hardware (applyZoom's first branch) zooms the stream itself.
      const zoomIsHardware = facing === "environment" && zoomCapabilitiesRef.current !== null;
      const canUseNativeStream =
        cropIsNoop && zoomIsHardware && !shouldMirror && compiledFilterAtStart === IDENTITY_FILTER;

      if (!canUseNativeStream) {
        const recordCanvas = document.createElement("canvas");
        recordCanvas.width = sw;
        recordCanvas.height = sh;
        const rctx = recordCanvas.getContext("2d");

        if (rctx) {
          const drawFrame = () => {
            rctx.save();
            if (shouldMirror) {
              rctx.translate(recordCanvas.width, 0);
              rctx.scale(-1, 1);
            }
            const z = applyZoomToCrop(baseCrop, cssZoomRef.current);
            rctx.drawImage(
              video,
              z.sx,
              z.sy,
              z.sw,
              z.sh,
              0,
              0,
              recordCanvas.width,
              recordCanvas.height,
            );
            if (compiledFilterAtStart !== IDENTITY_FILTER) {
              const frame = rctx.getImageData(0, 0, recordCanvas.width, recordCanvas.height);
              applyCompiledFilter(frame, compiledFilterAtStart);
              rctx.putImageData(frame, 0, 0);
            }
            rctx.restore();
            mirrorDrawLoopRef.current = requestAnimationFrame(drawFrame);
          };
          drawFrame();

          const canvasStream = recordCanvas.captureStream();
          stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));

          mirrorCanvasStreamRef.current = canvasStream;
          recordingStream = canvasStream;
        }
      }
    }

    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorder = new MediaRecorder(
      recordingStream,
      mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : { videoBitsPerSecond: 8_000_000 },
    );

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      stopMirrorDrawLoop();
      const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType || "video/webm" });

      let finalBlob = rawBlob;
      if (needsPostGrade) {
        setIsGradingVideo(true);
        setGradingProgress(0);
        try {
          // Same true-grade bake exportVideo already does for after-shot's
          // export step — reused here instead of duplicated, with no layers
          // (there aren't any yet at capture time).
          finalBlob = await exportVideo(
            rawBlob,
            gradeFilter,
            gradeIntensity,
            [],
            null,
            setGradingProgress,
          );
        } catch (err) {
          console.error("Post-recording grade failed, keeping the unfiltered capture:", err);
        } finally {
          setIsGradingVideo(false);
        }
      }

      const url = URL.createObjectURL(finalBlob);
      setPendingCapture({ type: "video", blob: finalBlob, url });
      navigate({ to: "/create/after-shot" });
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    recordStartedAtRef.current = performance.now();
    setRecordSeconds(0);
    setIsRecording(true);
    if (navigator.vibrate) navigator.vibrate(12);

    // Same ceiling the progress ring fills to — the ring running out is the
    // recording ending, not a separate warning.
    window.setTimeout(() => {
      if (mediaRecorderRef.current === recorder && recorder.state !== "inactive") {
        recorder.stop();
        setIsRecording(false);
      }
    }, MAX_RECORD_SECONDS * 1000);
  }, [
    navigate,
    facing,
    currentFilterCss,
    activeFilter,
    filterIntensity,
    stopMirrorDrawLoop,
    ratio,
  ]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    const wait = MIN_RECORD_MS - (performance.now() - recordStartedAtRef.current);
    // The UI lets go at once either way; only the recorder is held open.
    setIsRecording(false);
    if (wait > 0) {
      window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, wait);
    } else {
      recorder.stop();
    }
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    const id = window.setInterval(() => {
      setRecordSeconds(Math.floor((performance.now() - recordStartedAtRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [isRecording]);

  // A tap, or the end of a timer countdown, is always a photo. Video only
  // comes from holding.
  const performCapture = useCallback(() => {
    setCapturePhase("live");
    setCountdownRemaining(null);
    if (isMultiCellActive) captureIntoActiveCell();
    else capturePhoto();
  }, [isMultiCellActive, captureIntoActiveCell, capturePhoto]);

  useEffect(() => {
    if (capturePhase !== "counting" || countdownRemaining === null) return;
    if (countdownRemaining <= 0) {
      performCapture();
      return;
    }
    const t = setTimeout(() => setCountdownRemaining((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [capturePhase, countdownRemaining, performCapture]);

  // Hold the shutter to record, let go to stop — Snapchat's gesture.
  const holdTimerRef = useRef<number | null>(null);
  // True from the moment a hold turns into a recording until the finger lifts.
  const holdRecordingRef = useRef(false);
  // A hold ends with a click event too. Without this the tap handler would
  // fire straight after the hold ended and take a still on top of the clip.
  const suppressClickRef = useRef(false);
  // Where the finger landed, and the zoom at the moment recording began, so
  // sliding up can zoom relative to both.
  const shutterOriginRef = useRef<{ x: number; y: number } | null>(null);
  const zoomAtHoldRef = useRef(1);
  const zoomLevelRef = useRef(zoomLevel);
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const canHoldToRecord = !isMultiCellActive && timer === 0 && capturePhase !== "counting";

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearHoldTimer, [clearHoldTimer]);

  const endHold = useCallback(() => {
    shutterOriginRef.current = null;
    clearHoldTimer();
    if (!holdRecordingRef.current) return;
    holdRecordingRef.current = false;
    stopRecording();
  }, [clearHoldTimer, stopRecording]);

  const handleShutterDown = useCallback(
    (e: PointerEvent) => {
      shutterOriginRef.current = { x: e.clientX, y: e.clientY };
      // Left over if the last hold ran into MAX_RECORD_SECONDS: the recorder
      // stopped itself and the lift that would have cleared this never came.
      holdRecordingRef.current = false;
      suppressClickRef.current = false;
      if (!canHoldToRecord) return;
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        holdRecordingRef.current = true;
        suppressClickRef.current = true;
        zoomAtHoldRef.current = zoomLevelRef.current;
        startRecording();
      }, HOLD_TO_RECORD_MS);
    },
    [canHoldToRecord, startRecording],
  );

  // Before recording starts, movement past the slop means a filter swipe and
  // cancels the hold — the strip scrolls under the finger by itself, but
  // `pointercancel` only arrives once the browser has committed to the
  // scroll, which can be after the hold would already have fired.
  const handleShutterMove = useCallback(
    (e: PointerEvent) => {
      const origin = shutterOriginRef.current;
      if (!origin || holdTimerRef.current === null) return;
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > HOLD_SLOP_PX) {
        clearHoldTimer();
      }
    },
    [clearHoldTimer],
  );

  // Before recording, a cancel is the strip taking the gesture: drop the hold.
  // During recording it is ignored, and the window listeners below own the
  // gesture instead.
  const handleShutterCancel = useCallback(() => {
    if (!holdRecordingRef.current) endHold();
  }, [endHold]);

  // Once recording, the gesture is followed on the WINDOW, through touch
  // events as well as pointer events. The shutter lives inside a horizontal
  // scroller, and a thumb sliding up to zoom drifts sideways: the moment the
  // browser reads that as a pan it sends `pointercancel` and no further
  // pointer events at all — no move, and no up to say the finger has lifted.
  // Touch events keep coming through a pan and still end in `touchend`.
  useEffect(() => {
    if (!isRecording) return;
    const zoomTo = (clientY: number) => {
      const origin = shutterOriginRef.current;
      if (!origin || !holdRecordingRef.current) return;
      const up = Math.max(0, origin.y - clientY);
      applyZoom(zoomAtHoldRef.current + up / ZOOM_DRAG_PX_PER_X);
    };
    const onPointerMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "touch") zoomTo(e.clientY);
    };
    const onTouchMove = (e: globalThis.TouchEvent) => {
      const t = e.touches[0];
      if (t) zoomTo(t.clientY);
    };
    const onPointerUp = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "touch") endHold();
    };
    const onTouchEnd = (e: globalThis.TouchEvent) => {
      if (e.touches.length === 0) endHold();
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isRecording, applyZoom, endHold]);

  // Leaving the screen mid-hold (tab switch, app backgrounded) never delivers
  // a touchend — stop rather than record up to the ceiling.
  useEffect(() => {
    if (!isRecording) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") endHold();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [isRecording, endHold]);

  const handleCaptureTap = useCallback(() => {
    // Swallow the click that closes a hold. Keyboard activation still reaches
    // here, because it never went through the pointer handlers.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (capturePhase === "counting") {
      setCapturePhase("live");
      setCountdownRemaining(null);
      return;
    }
    if (timer > 0) {
      setCapturePhase("counting");
      setCountdownRemaining(timer);
    } else {
      performCapture();
    }
  }, [capturePhase, timer, performCapture]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <style>{`
        .oak-filter-strip::-webkit-scrollbar { display: none; }
        @keyframes oak-record-progress { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
        @keyframes oak-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .oak-filter-strip {
          -webkit-mask-image: linear-gradient(to right, transparent ${BARRIER_EDGE}px, black ${BARRIER_EDGE}px);
          mask-image: linear-gradient(to right, transparent ${BARRIER_EDGE}px, black ${BARRIER_EDGE}px);
        }
        #focus-reticle {
          transition: all 0.15s ease-out;
          animation: oak-reticle-pulse 2s ease-in-out infinite;
        }
        @keyframes oak-reticle-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(0.75); opacity: 0.5; }
        }

        @keyframes oak-focus-pulse { 
          0% { transform: scale(1.4); opacity: 1; } 
          20% { transform: scale(1); opacity: 1; } 
          80% { opacity: 1; } 
          100% { opacity: 0; transform: scale(0.9); } 
}
      `}</style>

      <canvas ref={canvasRef} className="hidden" />

      <div
        onTouchStart={handlePinchStart}
        onTouchMove={handlePinchMove}
        onTouchEnd={handlePinchEnd}
        onClick={handlePreviewTap}
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
          touchAction: "none",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: currentFilterCss,
            transform:
              facing === "user" ? `scaleX(-1) scale(${cssZoomScale})` : `scale(${cssZoomScale})`,
            transition: pinchStateRef.current ? "none" : "transform 100ms ease-out",
          }}
        />

        {focusPoint && (
          <div
            className="pointer-events-none absolute h-14 w-14 rounded-full border-[1.5px] border-yellow-400"
            style={{
              left: focusPoint.x - 28,
              top: focusPoint.y - 28,
              animation: "oak-focus-pulse 1.8s ease-out forwards",
              zIndex: 10,
            }}
          />
        )}

        {gridVisible && (
          <div
            className="oak-motion-fade pointer-events-none absolute inset-0"
            style={{ opacity: 0.35 }}
          >
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
            className="oak-motion-fade absolute inset-0"
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
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
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
                      disablePictureInPicture
                      disableRemotePlayback
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
                        transform:
                          facing === "user"
                            ? `scaleX(-1) scale(${cssZoomScale})`
                            : `scale(${cssZoomScale})`,
                      }}
                    />
                  ) : (
                    // Cells not yet reached: frosted glass instead of flat black, so
                    // the live scene still shows through, just softened — matches the
                    // liquid-glass language LiquidGlassSegmented already uses. No live
                    // video here on purpose; a sharp feed would bring back the
                    // "which cell is active" confusion this was meant to fix.
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background: "rgba(255,255,255,0.08)",
                        backdropFilter: "blur(20px) saturate(160%)",
                        WebkitBackdropFilter: "blur(20px) saturate(160%)",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }}
                    />
                  )}
                </button>
              );
            }}
          />
        )}
      </div>

      {/* Fade the light UP and leave it up. screenFlashActive is a sustained
          state — front camera plus flash on means the screen IS the light source
          for as long as it is set, which is why currentFilterCss carries a
          matching brightness(1.25) the whole time. A blink-and-decay animation
          here leaves the preview brightened with nothing lighting the subject. */}
      {screenFlashActive && (
        <div
          className="oak-motion-fade absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, transparent 0%, transparent 38%, rgba(255,255,255,0.55) 70%, rgba(255,255,255,0.95) 100%)",
            mixBlendMode: "screen",
          }}
        />
      )}

      {capturePhase === "counting" && countdownRemaining !== null && countdownRemaining > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <span
            key={countdownRemaining}
            className="oak-motion-pop text-8xl font-bold"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
          >
            {countdownRemaining}
          </span>
        </div>
      )}

      {isGradingVideo && (
        <div
          className="oak-motion-fade absolute inset-0 flex items-center justify-center z-30"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <span className="text-sm uppercase tracking-widest">
            Grading… {Math.round(gradingProgress * 100)}%
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
                className="oak-motion-control flex items-center gap-2 relative active:scale-95"
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
                className="oak-motion-control flex items-center gap-2 active:scale-95"
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
                className="oak-motion-control flex items-center gap-2 active:scale-95"
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
              className="oak-motion-control flex items-center gap-2 opacity-90 active:scale-95"
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
          className="oak-motion-control flex items-center gap-2 active:scale-95"
        >
          <AnimatedLabel visible={labelsVisible}>{gridVisible ? "Grid: On" : "Grid"}</AnimatedLabel>
          <Grid3x3 size={26} style={{ opacity: gridVisible ? 1 : 0.7 }} />
        </button>

        {isNonDefaultFilterActive && (
          <button
            onClick={() => toggleFilterFavorite(selectedFilterId)}
            aria-label={isCurrentFilterFavorited ? "Remove from favorites" : "Favorite this filter"}
            className="oak-motion-control flex items-center gap-2 active:scale-95"
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
          className="oak-motion-control flex items-center justify-center w-8 h-8 mt-1 active:scale-90"
        >
          {labelsVisible ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isRecording && (
        <div
          className="oak-motion-fade absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-2.5 py-1 pointer-events-none"
          style={{
            zIndex: 5,
            bottom: `calc(env(safe-area-inset-bottom) + ${RECORD_TIMER_BOTTOM}px)`,
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(12px)",
            fontVariantNumeric: "tabular-nums",
          }}
          role="timer"
          aria-live="off"
        >
          <span className="block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[13px] font-semibold">
            0:{String(Math.min(recordSeconds, MAX_RECORD_SECONDS)).padStart(2, "0")}
          </span>
        </div>
      )}

      <div
        ref={filterStripRef}
        onScroll={handleFilterScroll}
        className="oak-filter-strip absolute left-0 right-0 flex items-center overflow-x-auto"
        style={{
          zIndex: 1,
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM}px)`,
          height: CAPTURE_SIZE,
          // Frozen while recording: the filter was fixed when recording began,
          // and a thumb sliding up to zoom must not drag the strip with it.
          overflowX: isRecording ? "hidden" : undefined,
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingLeft: `calc(50% - ${CAPTURE_SIZE / 2}px)`,
          paddingRight: `calc(50% - ${CAPTURE_SIZE / 2}px)`,
        }}
      >
        {/* The shutter ring lives INSIDE the scroller, not on top of it.
         *
         * A browser only pans a scroll container when the touch starts on that
         * container or one of its descendants. While the shutter was a sibling
         * sitting over the middle of the strip, a swipe that began on the big
         * centre circle — the natural place to put your thumb — hit the button
         * instead and the filters did not move at all. Swipes that started off
         * to either side worked, which is what made it feel arbitrary.
         *
         * Sticky, zero-width, and FIRST in flow: a sticky `left` offset can
         * only push a box further right than where it already sits, so it has
         * to start at the content-box edge. Being first also means it would
         * paint under the swatches, hence the z-index.
         *
         * `left: 0` is the whole offset, and it is not a placeholder. A sticky
         * inset is measured from the scrollport's CONTENT edge — after
         * `padding-left` — and this strip's padding-left is already
         * `50% - half a ring`, which is the centre. So zero means "stay where
         * the padding put you", which is exactly what is wanted.
         *
         * Measured, after getting it wrong twice. On a 375px viewport the
         * padding is 145.5px; `left: calc(50vw - 42px)` renders the ring at
         * 291px — the offset added to the padding, then clamped to the content
         * box — and it stays there at every scroll position, which is the ring
         * jammed against the right-hand edge. `left: 0` renders it at 145.5px
         * and holds there at scrollLeft 0, 168 and 504. */}
        {/* Stays mounted while recording, and must: touch events keep going to
            the element the touch started on, so removing the button mid-hold
            would stop the window from ever hearing the finger lift. */}
        <div
          className="sticky shrink-0 pointer-events-none"
          style={{
            zIndex: 2,
            left: 0,
            width: 0,
            height: CAPTURE_SIZE,
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              top: 0,
              left: 0,
              width: CAPTURE_SIZE,
              height: CAPTURE_SIZE,
              border: "4px solid rgba(255,255,255,0.9)",
              // Handed over to the recording ring outside the strip, which
              // can grow past the strip's box without being clipped by it.
              opacity: isRecording ? 0 : 1,
              transition: "opacity 120ms ease-out",
            }}
          />
          <button
            onClick={handleCaptureTap}
            onPointerDown={handleShutterDown}
            onPointerMove={handleShutterMove}
            onPointerUp={endHold}
            onPointerCancel={handleShutterCancel}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Take photo, or hold to record video"
            className="absolute rounded-full pointer-events-auto"
            style={{
              top: 0,
              left: 0,
              width: CAPTURE_SIZE,
              height: CAPTURE_SIZE,
              background: "transparent",
              // A long press must not start a text selection or the iOS
              // callout — either one ends the touch and the recording.
              WebkitUserSelect: "none",
              userSelect: "none",
              WebkitTouchCallout: "none",
            }}
          />
        </div>
        {quickStripFilters.map((f, i) => (
          <button
            key={f.id}
            onClick={() => scrollFilterIntoRing(i)}
            className="shrink-0 flex items-center justify-center"
            style={{
              width: CAPTURE_SIZE,
              scrollSnapAlign: "center",
              opacity: isRecording ? 0 : 1,
              transition: "opacity 200ms ease-out",
            }}
          >
            <FilterSwatchThumb filter={f} diameter={SWATCH_DIAMETER} />
          </button>
        ))}
      </div>

      <button
        onClick={() => !isRecording && setFacing((f) => (f === "user" ? "environment" : "user"))}
        aria-label="Flip camera"
        className="absolute flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
        style={{
          zIndex: 3,
          left: iconColumnLeft(ROTATE_SIZE),
          bottom: `calc(env(safe-area-inset-bottom) + ${ROTATE_BOTTOM}px)`,
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
          left: iconColumnLeft(FLASH_TOGGLE_SIZE),
          bottom: `calc(env(safe-area-inset-bottom) + ${FLASH_TOGGLE_BOTTOM}px)`,
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
        className="oak-motion-control absolute rounded-xl overflow-hidden flex items-center justify-center active:scale-95"
        style={{
          zIndex: 3,
          left: iconColumnLeft(GALLERY_ICON_SIZE),
          bottom: `calc(env(safe-area-inset-bottom) + ${GALLERY_ICON_BOTTOM}px)`,
          width: GALLERY_ICON_SIZE,
          height: GALLERY_ICON_SIZE,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <ImageIcon size={16} />
      </button>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
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

      {/* The recording shutter, Snapchat's: the ring grows out from under the
       * thumb and a red arc fills it over MAX_RECORD_SECONDS. Outside the
       * strip because `overflow-x: auto` clips the other axis too, and a
       * grown ring is taller than the strip. Pointer-events none — the touch
       * still belongs to the shutter button underneath. */}
      <div
        className="absolute pointer-events-none"
        style={{
          zIndex: 4,
          left: "50%",
          bottom: `calc(env(safe-area-inset-bottom) + ${CAPTURE_ROW_BOTTOM}px)`,
          width: CAPTURE_SIZE,
          height: CAPTURE_SIZE,
          marginLeft: -CAPTURE_SIZE / 2,
          opacity: isRecording ? 1 : 0,
          transform: `scale(${isRecording ? RECORDING_RING_SCALE : 1})`,
          transition: "transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 120ms ease-out",
        }}
      >
        <svg width={CAPTURE_SIZE} height={CAPTURE_SIZE} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,0.14)" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="3.5"
          />
          {isRecording && (
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#ef4444"
              strokeWidth="4"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              transform="rotate(-90 50 50)"
              style={{ animation: `oak-record-progress ${MAX_RECORD_SECONDS}s linear forwards` }}
            />
          )}
        </svg>
      </div>

      {section === "create" && (
        <CreatePanel
          onClose={handleBack}
          draftCount={draftCount}
          onPhotoEditor={() => navigate({ to: "/create/photo-editor" })}
          onNewVideo={() => navigate({ to: "/create/video-editor" })}
          onDrafts={() => navigate({ to: "/create/drafts" })}
        />
      )}

      <div
        className="absolute left-0 right-0 flex items-center justify-center gap-8"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)", zIndex: 20 }}
      >
        <button
          onClick={() => setSection("shoot")}
          aria-pressed={section === "shoot"}
          className="uppercase text-sm font-bold tracking-wide"
          style={{ opacity: section === "shoot" ? 1 : 0.5 }}
        >
          SHOOT
        </button>
        <button
          onClick={() => setSection("create")}
          aria-pressed={section === "create"}
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
        intensity={filterIntensity}
        favoriteIds={favoritedFilterIds}
        onClose={() => setOpenPanel(null)}
        onPreview={(id, intensity) => {
          setSelectedFilterId(id);
          setFilterIntensity(intensity);
        }}
        onApply={(id, intensity) => {
          setSelectedFilterId(id);
          setFilterIntensity(intensity);
        }}
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
