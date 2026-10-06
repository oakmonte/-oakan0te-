import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Music2,
  Plus,
  Volume2,
  VolumeX,
  Type as TypeIcon,
  Sparkles,
  Unlink,
  X,
} from "lucide-react";
import { tilesForRange, type FilmstripFrame } from "@/lib/studio/filmstrip";
import { peaksForRange } from "./use-timeline-media";
import {
  AUDIO_TRACK_H,
  CLIP_GAP,
  DEFAULT_PPS,
  HANDLE_W,
  LAYER_TRACK_H,
  LONG_PRESS_MS,
  MAX_PPS,
  MAX_TILES_PER_CLIP,
  MIN_PPS,
  MIN_TICK_PX,
  RULER_H,
  RULER_STEPS,
  TAP_SLOP,
  TILE_W,
  TIMELINE_HEIGHT,
  TRACK_GAP,
  TRACK_TOP_PAD,
  VIDEO_TRACK_CENTER,
  VIDEO_TRACK_H,
} from "@/lib/studio/layout";
import {
  audioDuration,
  clipDuration,
  clipStarts,
  formatTimecode,
  timelineExtent,
  type AudioClip,
  type SourceMap,
  type StudioProject,
  type StudioSelection,
  type TimedLayer,
  type VideoClip,
} from "@/lib/studio/types";

/** A clip's width while the track is in reorder mode: square, the track's
 *  own height, whatever the clip's duration. */
const SQUARE = VIDEO_TRACK_H;
/** Near either edge a held clip scrolls the strip. */
const EDGE_ZONE = 48;
const EDGE_SPEED = 7;

// The reference's timeline, rebuilt: a playhead welded to the centre of the
// screen with the tracks scrolling underneath it.
//
// That inversion is the whole reason this reads as an editor rather than a
// slider. Position is expressed as scrollLeft, so the browser's own momentum
// scrolling IS the scrub gesture — no pointer maths, no rubber-banding to
// reimplement — and the playhead never moves, which means playback re-renders
// nothing in this subtree. `ownerRef` arbitrates between the clock and the
// finger, because a programmatic scrollLeft fires exactly the event a swipe does.
//
// Every direct-manipulation gesture here captures the pointer on the element it
// started on. Without capture, a trim that wandered off the 150px-tall strip
// stopped receiving moves, never saw its pointerup, and left the timeline stuck
// in `touchAction: none` with a stale drag origin waiting for the next touch.

type Props = {
  project: StudioProject;
  sources: SourceMap;
  /** Individual stable handles rather than the PlaybackApi object: that object is
   *  rebuilt on every state change, which would defeat the memo below. */
  timeRef: React.RefObject<number>;
  subscribe: (fn: (time: number) => void) => () => void;
  seek: (time: number) => void;
  pause: () => void;
  selection: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
  filmstrips: Record<string, FilmstripFrame[]>;
  waveforms: Record<string, number[]>;
  /** Beat positions in TIMELINE seconds, already mapped by the route. */
  beats: number[];
  onTrim: (clipId: string, edge: "in" | "out", sourceTime: number) => void;
  onReorder: (clipId: string, toIndex: number) => void;
  onCloseGap: (clipId: string) => void;
  onMoveAudio: (audioId: string, timelineStart: number) => void;
  onTrimAudio: (audioId: string, edge: "in" | "out", sourceTime: number) => void;
  onAddClips: () => void;
  onToggleMasterMute: () => void;
  onOpenTransition: (clipId: string) => void;
  beginHistoryGroup: () => void;
  endHistoryGroup: () => void;
};

function StudioTimeline({
  project,
  sources,
  timeRef,
  subscribe,
  seek,
  pause,
  selection,
  onSelect,
  filmstrips,
  waveforms,
  beats,
  onTrim,
  onReorder,
  onCloseGap,
  onMoveAudio,
  onTrimAudio,
  onAddClips,
  onToggleMasterMute,
  onOpenTransition,
  beginHistoryGroup,
  endHistoryGroup,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState(DEFAULT_PPS);
  const [halfWidth, setHalfWidth] = useState(0);
  const ownerRef = useRef<"engine" | "user">("engine");
  const idleTimer = useRef<number | null>(null);
  /** True while any direct-manipulation gesture owns the pointer, so scroll
   *  events it incidentally causes must not be read as scrubbing. */
  const gestureRef = useRef(false);

  const starts = useMemo(() => clipStarts(project.clips), [project.clips]);
  const extent = useMemo(() => timelineExtent(project), [project]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setHalfWidth(el.clientWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Clock -> scroll.
  useEffect(() => {
    return subscribe((t) => {
      const el = scrollRef.current;
      if (!el || ownerRef.current === "user") return;
      const target = t * pps;
      if (Math.abs(el.scrollLeft - target) > 0.5) el.scrollLeft = target;
    });
  }, [subscribe, pps]);

  // --- pinch zoom ----------------------------------------------------------
  const pinchRef = useRef<{ distance: number; pps: number; anchorTime: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Zooming holds the playhead's MOMENT still, not the scroll offset. This has
  // to bypass the ownership guard: a pinch is two pointerdowns, so ownership is
  // already "user" for its whole duration, and without the override the content
  // grew under a fixed scrollLeft and the playhead slid to a different second on
  // every zoom — the exact opposite of what "zoom in on this bit" means.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pinch = pinchRef.current;
    if (pinch) {
      el.scrollLeft = pinch.anchorTime * pps;
      return;
    }
    if (ownerRef.current !== "user") el.scrollLeft = timeRef.current * pps;
  }, [pps, timeRef, halfWidth]);

  const armIdleRelease = useCallback(() => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    // Ownership goes back to the clock only once the scroller has come to rest —
    // iOS momentum keeps firing events long after the finger is gone, and
    // handing back early makes the engine fight the fling.
    idleTimer.current = window.setTimeout(() => {
      ownerRef.current = "engine";
    }, 180);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || ownerRef.current !== "user") return;
    // A pinch or a drag moves the content for its own reasons; reading that as a
    // scrub would drag the playhead along with it.
    if (pinchRef.current || gestureRef.current) return;
    seek(el.scrollLeft / pps);
    armIdleRelease();
  }, [armIdleRelease, seek, pps]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      ownerRef.current = "user";
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      pause();
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinchRef.current = {
          distance: Math.hypot(b.x - a.x, b.y - a.y),
          pps,
          anchorTime: timeRef.current,
        };
      }
    },
    [pause, pps, timeRef],
  );

  const onPointerMoveZoom = useCallback((e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pinch = pinchRef.current;
    if (!pinch || pointers.current.size < 2 || pinch.distance <= 0) return;
    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    setPps(Math.min(MAX_PPS, Math.max(MIN_PPS, pinch.pps * (distance / pinch.distance))));
  }, []);

  const onPointerUpZoom = useCallback(
    (e: ReactPointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinchRef.current = null;
      if (pointers.current.size === 0) armIdleRelease();
    },
    [armIdleRelease],
  );

  // --- clip trim -----------------------------------------------------------
  const trimRef = useRef<{
    clipId: string;
    edge: "in" | "out";
    startX: number;
    startValue: number;
    speed: number;
  } | null>(null);

  const startTrim = useCallback(
    (clip: VideoClip, edge: "in" | "out") => (e: ReactPointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      gestureRef.current = true;
      beginHistoryGroup();
      trimRef.current = {
        clipId: clip.id,
        edge,
        startX: e.clientX,
        startValue: edge === "in" ? clip.inPoint : clip.outPoint,
        speed: clip.speed,
      };
    },
    [beginHistoryGroup],
  );

  const moveTrim = useCallback(
    (e: ReactPointerEvent) => {
      const trim = trimRef.current;
      if (!trim) return;
      e.stopPropagation();
      // Screen pixels are timeline seconds; a trim consumes SOURCE seconds, which
      // is timeline seconds times the clip's speed.
      const delta = ((e.clientX - trim.startX) / pps) * trim.speed;
      onTrim(trim.clipId, trim.edge, trim.startValue + delta);
    },
    [onTrim, pps],
  );

  const endTrim = useCallback(
    (e: ReactPointerEvent) => {
      if (!trimRef.current) return;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      trimRef.current = null;
      gestureRef.current = false;
      endHistoryGroup();
    },
    [endHistoryGroup],
  );

  // --- clip select + long-press reorder ------------------------------------
  //
  // Holding a clip collapses the video track into equal squares and hides the
  // other tracks. At timeline scale a long clip is wider than the screen, so
  // moving one past another meant dragging further than a thumb can reach;
  // as squares the edit fits on screen and every swap is the same short step.
  // `startX` is the screen x of the held clip's square centre, and the clip
  // is drawn `lastX - startX` away from it, so it stays under the finger.
  //
  // Opening a gap by pulling a clip away belonged to the old full-scale drag
  // and doesn't survive the squares; gaps a project already has are kept on
  // the clips they belong to.
  const pressRef = useRef<{
    clipId: string;
    startX: number;
    startY: number;
    lastX: number;
    timer: number | null;
    active: boolean;
    moved: boolean;
    /** A swap has been asked for and not rendered yet. */
    swapPending: boolean;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const compact = draggingId !== null;
  const clipsRef = useRef(project.clips);
  clipsRef.current = project.clips;
  /** Where the strip scrolls to as it turns into squares. */
  const enterLeft = useRef<number | null>(null);
  /** The clip just let go of, whose new start the playhead returns to. */
  const settleId = useRef<string | null>(null);

  useEffect(() => {
    if (pressRef.current) pressRef.current.swapPending = false;
  }, [project.clips]);

  const stepSquares = useCallback(() => {
    const press = pressRef.current;
    if (!press || !press.active) return;
    if (!press.swapPending) {
      const clips = clipsRef.current;
      const index = clips.findIndex((c) => c.id === press.clipId);
      const dx = press.lastX - press.startX;
      if (index >= 0 && dx > SQUARE / 2 && index < clips.length - 1) {
        press.swapPending = true;
        press.startX += SQUARE;
        onReorder(press.clipId, index + 1);
        navigator.vibrate?.(6);
      } else if (index > 0 && -dx > SQUARE / 2) {
        press.swapPending = true;
        press.startX -= SQUARE;
        onReorder(press.clipId, index - 1);
        navigator.vibrate?.(6);
      }
    }
    setDragOffset(press.lastX - press.startX);
  }, [onReorder]);

  const startClipPress = useCallback(
    (clip: VideoClip) => (e: ReactPointerEvent) => {
      const target = e.currentTarget as HTMLElement;
      const timer = window.setTimeout(() => {
        const press = pressRef.current;
        if (!press || press.moved) return;
        press.active = true;
        // Capture only once the hold has actually armed a reorder. Capturing on
        // pointerdown would steal every scrub that merely began on a clip.
        target.setPointerCapture?.(e.pointerId);
        gestureRef.current = true;
        // Scroll so the held clip's square lands under the finger. Written by
        // the layout effect once the squares exist: a strip of short clips
        // can be narrower than its squares, and writing now would clamp.
        const el = scrollRef.current;
        const index = clipsRef.current.findIndex((c) => c.id === clip.id);
        if (el && index >= 0) {
          const rect = el.getBoundingClientRect();
          const centre = el.clientWidth / 2 + index * SQUARE + SQUARE / 2;
          const left = Math.min(
            clipsRef.current.length * SQUARE,
            Math.max(0, centre - (press.lastX - rect.left)),
          );
          enterLeft.current = left;
          press.startX = rect.left + centre - left;
          setDragOffset(press.lastX - press.startX);
        }
        setDraggingId(clip.id);
        beginHistoryGroup();
        navigator.vibrate?.(8);
      }, LONG_PRESS_MS);
      pressRef.current = {
        clipId: clip.id,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        timer,
        active: false,
        moved: false,
        swapPending: false,
      };
    },
    [beginHistoryGroup],
  );

  const moveClipPress = useCallback(
    (e: ReactPointerEvent) => {
      const press = pressRef.current;
      if (!press) return;
      press.lastX = e.clientX;

      if (!press.active) {
        // Movement before the hold completes means the user is scrubbing, not
        // rearranging — disarm rather than hijack the scroll.
        if (
          Math.abs(e.clientX - press.startX) > TAP_SLOP ||
          Math.abs(e.clientY - press.startY) > TAP_SLOP
        ) {
          press.moved = true;
          if (press.timer !== null) window.clearTimeout(press.timer);
          press.timer = null;
        }
        return;
      }

      e.stopPropagation();

      stepSquares();
    },
    [stepSquares],
  );

  // Edge scroll while a clip is held, so a long edit can be reordered in one
  // gesture. Moving the strip moves the held clip's square on screen by the
  // same amount, so its origin follows and it stays under the finger while
  // its neighbours stream past.
  useEffect(() => {
    if (!draggingId) return;
    let frame = requestAnimationFrame(function tick() {
      const press = pressRef.current;
      const el = scrollRef.current;
      if (press?.active && el) {
        const r = el.getBoundingClientRect();
        const v =
          press.lastX < r.left + EDGE_ZONE
            ? -EDGE_SPEED
            : press.lastX > r.right - EDGE_ZONE
              ? EDGE_SPEED
              : 0;
        if (v !== 0) {
          const before = el.scrollLeft;
          el.scrollLeft = before + v;
          const moved = el.scrollLeft - before;
          if (moved !== 0) {
            press.startX -= moved;
            stepSquares();
          }
        }
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [draggingId, stepSquares]);

  // Into squares: scroll the held clip under the finger. Out of squares: the
  // scroll position from square-land means nothing, so put the playhead on
  // the start of the clip that was moved.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (draggingId) {
      if (enterLeft.current !== null) el.scrollLeft = enterLeft.current;
      enterLeft.current = null;
      return;
    }
    const id = settleId.current;
    settleId.current = null;
    if (!id) return;
    const index = project.clips.findIndex((c) => c.id === id);
    if (index < 0) return;
    const t = starts[index];
    el.scrollLeft = t * pps;
    seek(t);
    // Only on entering and leaving a hold; the rest change for other reasons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId]);

  const endClipPress = useCallback(
    (e: ReactPointerEvent) => {
      const press = pressRef.current;
      if (!press) return;
      if (press.timer !== null) window.clearTimeout(press.timer);
      if (press.active) {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
        gestureRef.current = false;
        settleId.current = press.clipId;
        endHistoryGroup();
      } else if (!press.moved) {
        // Selection happens on RELEASE. On pointerdown it meant that resting a
        // thumb on the track to scrub swapped the whole bottom toolbar out from
        // under it — the primary tools flickering away on every scrub.
        onSelect({ kind: "clip", id: press.clipId });
      }
      pressRef.current = null;
      setDraggingId(null);
      setDragOffset(0);
    },
    [endHistoryGroup, onSelect],
  );

  // --- audio move + trim ---------------------------------------------------
  const audioRef = useRef<{
    id: string;
    mode: "move" | "in" | "out";
    startX: number;
    startValue: number;
    speed: number;
    moved: boolean;
  } | null>(null);

  const startAudio = useCallback(
    (audio: AudioClip, mode: "move" | "in" | "out") => (e: ReactPointerEvent) => {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      gestureRef.current = true;
      beginHistoryGroup();
      audioRef.current = {
        id: audio.id,
        mode,
        startX: e.clientX,
        startValue:
          mode === "move" ? audio.timelineStart : mode === "in" ? audio.inPoint : audio.outPoint,
        speed: audio.speed,
        moved: false,
      };
    },
    [beginHistoryGroup],
  );

  const moveAudio = useCallback(
    (e: ReactPointerEvent) => {
      const drag = audioRef.current;
      if (!drag) return;
      e.stopPropagation();
      const dxPx = e.clientX - drag.startX;
      if (Math.abs(dxPx) > TAP_SLOP) drag.moved = true;
      if (drag.mode === "move") {
        onMoveAudio(drag.id, Math.max(0, drag.startValue + dxPx / pps));
      } else {
        onTrimAudio(drag.id, drag.mode, drag.startValue + (dxPx / pps) * drag.speed);
      }
    },
    [onMoveAudio, onTrimAudio, pps],
  );

  const endAudio = useCallback(
    (audioId: string) => (e: ReactPointerEvent) => {
      const drag = audioRef.current;
      if (!drag) return;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      gestureRef.current = false;
      audioRef.current = null;
      endHistoryGroup();
      if (!drag.moved) onSelect({ kind: "audio", id: audioId });
    },
    [endHistoryGroup, onSelect],
  );

  // Stop the strip panning under a held clip. `touchAction` can't: a browser
  // latches it when the touch STARTS, so flipping it to "none" when the hold
  // fires 280ms in applies to the next touch, never this one — the pan won,
  // pointercancel fired, and the clip dropped the moment it moved. Nor can a
  // touchmove listener added at that point: Chrome and WebKit decide at
  // touchstart whether a sequence's touchmoves may be cancelled at all, and
  // with no blocking listener under the finger then, they can't. So the
  // listener is permanent and decides late, from the press itself.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (pressRef.current?.active && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  const contentWidth = Math.max(extent * pps, 1);
  const lockScroll = draggingId !== null;
  const tickStep = useMemo(
    () =>
      RULER_STEPS.find((step) => step * pps >= MIN_TICK_PX) ?? RULER_STEPS[RULER_STEPS.length - 1],
    [pps],
  );
  const tickCount = Math.max(1, Math.ceil(extent / tickStep) + 1);

  return (
    <div className="relative w-full select-none" style={{ height: TIMELINE_HEIGHT }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMoveZoom}
        onPointerUp={onPointerUpZoom}
        onPointerCancel={onPointerUpZoom}
        // A long press is how a clip is picked up, and both browsers have
        // their own idea of what one means: Android opens an image menu, iOS a
        // Save/Share callout over the frames. Neither belongs on a timeline.
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        style={{
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          scrollbarWidth: "none",
          overscrollBehaviorX: "contain",
          touchAction: lockScroll ? "none" : "pan-x",
        }}
      >
        <div style={{ paddingLeft: halfWidth, paddingRight: halfWidth, width: "max-content" }}>
          <div
            className="relative"
            style={{
              width: compact ? project.clips.length * SQUARE : contentWidth,
              paddingTop: TRACK_TOP_PAD,
            }}
          >
            {/* ---------------- ruler ---------------- */}
            {/* Without a scale, a 23x zoom range leaves you with no idea where
                you are — and this editor asks you to land cuts on a beat. */}
            <div className="relative" style={{ height: RULER_H }}>
              {Array.from({ length: compact ? 0 : tickCount }, (_, i) => {
                const t = i * tickStep;
                return (
                  <div
                    key={i}
                    className="absolute top-0 flex items-start gap-1"
                    style={{ left: t * pps }}
                  >
                    <span style={{ width: 1, height: 5, background: "rgba(255,255,255,0.28)" }} />
                    <span
                      className="text-[8px] leading-none"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {formatTimecode(t, tickStep < 1)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Beat markers sit under everything, so they read as a grid rather
                than as another object competing with the clips. */}
            {(compact ? [] : beats).map((t, i) => (
              <div
                key={i}
                className="absolute bottom-0 w-px pointer-events-none"
                style={{ left: t * pps, top: RULER_H, background: "rgba(255,255,255,0.16)" }}
              />
            ))}

            {/* ---------------- video track ---------------- */}
            <div className="relative" style={{ height: VIDEO_TRACK_H }}>
              {/* Empty space between clips. Black in the finished video, so
                  drawn as a dark hole rather than left see-through. */}
              {project.clips.map((clip, index) => {
                const gap = clip.gapBefore ?? 0;
                if (gap <= 0 || compact) return null;
                const width = gap * pps - CLIP_GAP;
                if (width <= 0) return null;
                return (
                  <div
                    key={`gap-${clip.id}`}
                    className="absolute top-0 flex items-center justify-center"
                    style={{
                      left: (starts[index] - gap) * pps + CLIP_GAP / 2,
                      width,
                      height: VIDEO_TRACK_H,
                      borderRadius: 6,
                      background: "#050505",
                      border: "1px dashed rgba(255,255,255,0.16)",
                      zIndex: 0,
                    }}
                  >
                    {width > 30 && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onCloseGap(clip.id)}
                        aria-label="Close gap"
                        className="oak-hit flex h-7 w-7 items-center justify-center rounded-full active:scale-90"
                        style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}

              {project.clips.map((clip, index) => {
                const source = sources[clip.sourceId];
                const duration = clipDuration(clip);
                // Inset by half the gap on each side — see CLIP_GAP. Only the
                // drawing moves; starts[] and the cut buttons stay on the
                // true timeline positions.
                const width = compact ? SQUARE - CLIP_GAP : Math.max(6, duration * pps - CLIP_GAP);
                const isSelected =
                  !compact && selection?.kind === "clip" && selection.id === clip.id;
                const isDragging = draggingId === clip.id;
                return (
                  <div
                    key={clip.id}
                    onPointerDown={startClipPress(clip)}
                    onPointerMove={moveClipPress}
                    onPointerUp={endClipPress}
                    onPointerCancel={endClipPress}
                    className="absolute top-0 overflow-hidden"
                    style={{
                      left: (compact ? index * SQUARE : starts[index] * pps) + CLIP_GAP / 2,
                      width,
                      height: VIDEO_TRACK_H,
                      borderRadius: 6,
                      transform: isDragging ? `translateX(${dragOffset}px) scale(1.08)` : undefined,
                      zIndex: isDragging ? 5 : isSelected ? 3 : 1,
                      boxShadow: isDragging ? "0 8px 22px rgba(0,0,0,0.55)" : undefined,
                      outline: isSelected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.10)",
                      outlineOffset: -1,
                      background: "#151515",
                    }}
                  >
                    <ClipTiles
                      frames={source ? filmstrips[source.id] : undefined}
                      fallbackUrl={source?.kind === "image" ? source.url : undefined}
                      inPoint={clip.inPoint}
                      outPoint={clip.outPoint}
                      width={width}
                    />

                    {/* Live length of the selected clip, so a trim can be
                        judged in seconds rather than by eye. */}
                    {isSelected && width > 40 && (
                      <span
                        className="pointer-events-none absolute top-0.5 rounded px-1 text-[11px] font-semibold leading-[15px] tabular-nums"
                        style={{
                          left: HANDLE_W + 2,
                          background: "rgba(0,0,0,0.68)",
                          color: "#fff",
                          zIndex: 5,
                        }}
                      >
                        {duration < 10 ? duration.toFixed(1) : Math.round(duration)}s
                      </span>
                    )}

                    <div
                      className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-1 pb-0.5"
                      hidden={compact}
                    >
                      {(clip.muted || project.masterMuted) && (
                        <Badge>
                          <VolumeX size={10} aria-label="Muted" />
                        </Badge>
                      )}
                      {/* The same glyph as Detach audio in the toolbar. It used to
                          say "split", the name of a different tool. */}
                      {clip.audioDetached && (
                        <Badge>
                          <Unlink size={10} aria-label="Audio detached" />
                        </Badge>
                      )}
                      {clip.speed !== 1 && <Badge>{clip.speed}x</Badge>}
                    </div>

                    {isSelected && (
                      <>
                        <TrimHandle
                          side="left"
                          onPointerDown={startTrim(clip, "in")}
                          onPointerMove={moveTrim}
                          onPointerUp={endTrim}
                        />
                        <TrimHandle
                          side="right"
                          onPointerDown={startTrim(clip, "out")}
                          onPointerMove={moveTrim}
                          onPointerUp={endTrim}
                        />
                      </>
                    )}
                  </div>
                );
              })}

              {/* Transition buttons live ON the cut — the cut is the thing being
                  changed, not either clip. */}
              {project.clips.slice(1).map((clip, i) =>
                compact ||
                (clip.gapBefore ?? 0) > 0 ||
                // Steps aside while either neighbour is selected: that is
                // when the trim handles need these same pixels, and a 44px
                // target sitting on the cut would swallow both of them. The
                // clip toolbar's Transition button covers the selected clip.
                (selection?.kind === "clip" &&
                  (selection.id === clip.id || selection.id === project.clips[i].id)) ? null : (
                  <button
                    key={`cut-${clip.id}`}
                    onClick={() => onOpenTransition(clip.id)}
                    aria-label="Change transition"
                    className="oak-hit absolute flex items-center justify-center rounded-[4px]"
                    style={{
                      left: starts[i + 1] * pps - 9,
                      top: VIDEO_TRACK_H / 2 - 9,
                      width: 18,
                      height: 18,
                      zIndex: 6,
                      background: clip.transitionIn.kind === "none" ? "rgba(0,0,0,0.72)" : "#fff",
                      color: clip.transitionIn.kind === "none" ? "#fff" : "#000",
                      border: "1px solid rgba(255,255,255,0.5)",
                    }}
                  >
                    <Sparkles size={10} />
                  </button>
                ),
              )}
            </div>

            {/* ---------------- audio track ---------------- */}
            <div className="relative" style={{ height: AUDIO_TRACK_H, marginTop: TRACK_GAP }}>
              {(compact ? [] : project.audio).map((audio) => {
                const source = sources[audio.sourceId];
                const width = Math.max(24, audioDuration(audio) * pps);
                const isSelected = selection?.kind === "audio" && selection.id === audio.id;
                return (
                  <div
                    key={audio.id}
                    onPointerDown={startAudio(audio, "move")}
                    onPointerMove={moveAudio}
                    onPointerUp={endAudio(audio.id)}
                    onPointerCancel={endAudio(audio.id)}
                    className="absolute top-0 flex items-center gap-1 overflow-hidden px-1.5"
                    style={{
                      left: audio.timelineStart * pps,
                      width,
                      height: AUDIO_TRACK_H,
                      borderRadius: 6,
                      background: audio.muted ? "rgba(99,102,241,0.35)" : "#6366F1",
                      outline: isSelected ? "2px solid #fff" : "none",
                      outlineOffset: -1,
                      touchAction: "none",
                    }}
                  >
                    <Music2 size={11} className="shrink-0 text-white" />
                    <span className="text-[11px] font-medium text-white truncate">
                      {audio.label}
                    </span>
                    <Waveform
                      peaks={peaksForRange(
                        source ? waveforms[source.id] : undefined,
                        source?.duration ?? 0,
                        audio.inPoint,
                        audio.outPoint,
                        Math.max(4, Math.floor(width / 3)),
                      )}
                    />
                    {isSelected && (
                      <>
                        <TrimHandle
                          side="left"
                          compact
                          onPointerDown={startAudio(audio, "in")}
                          onPointerMove={moveAudio}
                          onPointerUp={endAudio(audio.id)}
                        />
                        <TrimHandle
                          side="right"
                          compact
                          onPointerDown={startAudio(audio, "out")}
                          onPointerMove={moveAudio}
                          onPointerUp={endAudio(audio.id)}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ---------------- caption / tag track ---------------- */}
            <div className="relative" style={{ height: LAYER_TRACK_H, marginTop: TRACK_GAP }}>
              {(compact ? [] : project.layers).map((layer) => (
                <LayerChip
                  key={layer.id}
                  layer={layer}
                  pps={pps}
                  selected={selection?.kind === "layer" && selection.id === layer.id}
                  onSelect={() => onSelect({ kind: "layer", id: layer.id })}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed playhead. Never moves, never re-renders. */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{ left: "50%", width: 2, marginLeft: -1, background: "#fff", zIndex: 8 }}
      />

      {/* Pinned to the SCREEN, not the scrolling content — exactly as the
          reference shows, and so the empty-track hint below doesn't slide out of
          sight the moment you scrub. */}
      <button
        onClick={onToggleMasterMute}
        aria-label={project.masterMuted ? "Unmute timeline" : "Mute timeline"}
        aria-pressed={project.masterMuted}
        className="oak-hit absolute flex items-center justify-center rounded-full"
        style={{
          left: 10,
          top: VIDEO_TRACK_CENTER - 16,
          width: 32,
          height: 32,
          background: "rgba(0,0,0,0.6)",
          zIndex: 9,
        }}
      >
        {project.masterMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>

      <button
        onClick={onAddClips}
        aria-label="Add clips from gallery"
        className="oak-hit absolute flex items-center justify-center rounded-lg transition-transform active:scale-95"
        style={{
          right: 10,
          top: VIDEO_TRACK_CENTER - 16,
          width: 32,
          height: 32,
          background: "#fff",
          color: "#000",
          zIndex: 9,
        }}
      >
        <Plus size={19} />
      </button>

      {project.audio.length === 0 && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center whitespace-nowrap text-[11px] pointer-events-none"
          style={{
            top: TRACK_TOP_PAD + RULER_H + VIDEO_TRACK_H + TRACK_GAP,
            height: AUDIO_TRACK_H,
            color: "rgba(255,255,255,0.5)",
            zIndex: 7,
          }}
        >
          Detach a clip&rsquo;s audio, or add a track, to edit sound on its own
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-semibold leading-[15px]"
      style={{ background: "rgba(0,0,0,0.68)", color: "#fff" }}
    >
      {children}
    </span>
  );
}

function TrimHandle({
  side,
  compact,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  side: "left" | "right";
  compact?: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute top-0 bottom-0 flex items-center justify-center"
      style={{
        [side]: 0,
        width: compact ? HANDLE_W - 3 : HANDLE_W,
        background: "#fff",
        borderRadius: side === "left" ? "6px 0 0 6px" : "0 6px 6px 0",
        cursor: "ew-resize",
        touchAction: "none",
        zIndex: 4,
      }}
    >
      <span style={{ width: 2, height: 14, borderRadius: 1, background: "rgba(0,0,0,0.55)" }} />
      {/* The grab area reaches inward past the drawn 14px bar — into the clip,
          never outward over its neighbour, and never outside the clip's own
          overflow clip, which would cut it off anyway. */}
      <span
        aria-hidden
        className="absolute inset-y-0"
        style={{ [side]: 0, width: compact ? 24 : 30 }}
      />
    </div>
  );
}

const ClipTiles = memo(function ClipTiles({
  frames,
  fallbackUrl,
  inPoint,
  outPoint,
  width,
}: {
  frames: FilmstripFrame[] | undefined;
  fallbackUrl: string | undefined;
  inPoint: number;
  outPoint: number;
  width: number;
}) {
  // Tiles get wider rather than more numerous past the cap — see MAX_TILES_PER_CLIP.
  const tileW = Math.max(TILE_W, width / MAX_TILES_PER_CLIP);
  const count = Math.max(1, Math.ceil(width / tileW));
  const tiles = frames ? tilesForRange(frames, inPoint, outPoint, count) : [];
  if (tiles.length === 0) {
    return fallbackUrl ? (
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `url(${fallbackUrl})`, backgroundSize: "cover" }}
      />
    ) : null;
  }
  return (
    <div className="absolute inset-0 flex">
      {tiles.map((url, i) => (
        <div
          key={i}
          className="h-full shrink-0"
          style={{ width: tileW, backgroundImage: `url(${url})`, backgroundSize: "cover" }}
        />
      ))}
    </div>
  );
});

function Waveform({ peaks }: { peaks: number[] }) {
  if (peaks.length === 0) return null;
  return (
    <div className="flex h-full flex-1 items-center gap-px overflow-hidden opacity-70">
      {peaks.map((p, i) => (
        <span
          key={i}
          style={{
            width: 2,
            height: `${Math.max(8, p * 78)}%`,
            background: "#fff",
            borderRadius: 1,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function LayerChip({
  layer,
  pps,
  selected,
  onSelect,
}: {
  layer: TimedLayer;
  pps: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="absolute top-0 flex items-center gap-1 overflow-hidden px-1.5"
      style={{
        left: layer.startTime * pps,
        width: Math.max(28, (layer.endTime - layer.startTime) * pps),
        height: LAYER_TRACK_H,
        borderRadius: 5,
        background: selected ? "#fff" : "rgba(255,255,255,0.16)",
        color: selected ? "#000" : "#fff",
      }}
    >
      <TypeIcon size={11} className="shrink-0" />
      <span className="truncate text-[11px] font-medium">
        {layer.kind === "text" ? layer.content || "Text" : "Overlay"}
      </span>
    </button>
  );
}

/** Memoised on purpose: playback moves the tracks by writing scrollLeft, so this
 *  subtree only re-renders when the edit itself changes. */
export default memo(StudioTimeline);
