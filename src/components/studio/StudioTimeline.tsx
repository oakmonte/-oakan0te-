import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Music2, Plus, Volume2, VolumeX, Type as TypeIcon, Sparkles } from "lucide-react";
import { tilesForRange, type FilmstripFrame } from "@/lib/studio/filmstrip";
import { peaksForRange } from "./use-timeline-media";
import {
  AUDIO_TRACK_H,
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
  const pressRef = useRef<{
    clipId: string;
    startX: number;
    startY: number;
    timer: number | null;
    active: boolean;
    moved: boolean;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

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
        setDraggingId(clip.id);
        beginHistoryGroup();
        navigator.vibrate?.(8);
      }, LONG_PRESS_MS);
      pressRef.current = {
        clipId: clip.id,
        startX: e.clientX,
        startY: e.clientY,
        timer,
        active: false,
        moved: false,
      };
    },
    [beginHistoryGroup],
  );

  const moveClipPress = useCallback(
    (e: ReactPointerEvent) => {
      const press = pressRef.current;
      if (!press) return;
      const dx = e.clientX - press.startX;

      if (!press.active) {
        // Movement before the hold completes means the user is scrubbing, not
        // rearranging — disarm rather than hijack the scroll.
        if (Math.abs(dx) > TAP_SLOP || Math.abs(e.clientY - press.startY) > TAP_SLOP) {
          press.moved = true;
          if (press.timer !== null) window.clearTimeout(press.timer);
          press.timer = null;
        }
        return;
      }

      e.stopPropagation();
      setDragOffset(dx);

      // Swap the moment the lifted chip's centre passes a neighbour's centre.
      const index = project.clips.findIndex((c) => c.id === press.clipId);
      if (index < 0) return;
      if (dx > 0 && index < project.clips.length - 1) {
        const next = clipDuration(project.clips[index + 1]) * pps;
        if (dx > next / 2) {
          onReorder(press.clipId, index + 1);
          press.startX += next;
          setDragOffset(0);
        }
      } else if (dx < 0 && index > 0) {
        const prev = clipDuration(project.clips[index - 1]) * pps;
        if (-dx > prev / 2) {
          onReorder(press.clipId, index - 1);
          press.startX -= prev;
          setDragOffset(0);
        }
      }
    },
    [onReorder, pps, project.clips],
  );

  const endClipPress = useCallback(
    (e: ReactPointerEvent) => {
      const press = pressRef.current;
      if (!press) return;
      if (press.timer !== null) window.clearTimeout(press.timer);
      if (press.active) {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
        gestureRef.current = false;
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
        className="absolute inset-0 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          overscrollBehaviorX: "contain",
          touchAction: lockScroll ? "none" : "pan-x",
        }}
      >
        <div style={{ paddingLeft: halfWidth, paddingRight: halfWidth, width: "max-content" }}>
          <div className="relative" style={{ width: contentWidth, paddingTop: TRACK_TOP_PAD }}>
            {/* ---------------- ruler ---------------- */}
            {/* Without a scale, a 23x zoom range leaves you with no idea where
                you are — and this editor asks you to land cuts on a beat. */}
            <div className="relative" style={{ height: RULER_H }}>
              {Array.from({ length: tickCount }, (_, i) => {
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
            {beats.map((t, i) => (
              <div
                key={i}
                className="absolute bottom-0 w-px pointer-events-none"
                style={{ left: t * pps, top: RULER_H, background: "rgba(255,255,255,0.16)" }}
              />
            ))}

            {/* ---------------- video track ---------------- */}
            <div className="relative" style={{ height: VIDEO_TRACK_H }}>
              {project.clips.map((clip, index) => {
                const source = sources[clip.sourceId];
                const width = Math.max(6, clipDuration(clip) * pps);
                const isSelected = selection?.kind === "clip" && selection.id === clip.id;
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
                      left: starts[index] * pps,
                      width,
                      height: VIDEO_TRACK_H,
                      borderRadius: 6,
                      transform: isDragging ? `translateX(${dragOffset}px) scale(1.04)` : undefined,
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

                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 px-1 pb-0.5">
                      {(clip.muted || project.masterMuted) && (
                        <Badge>
                          <VolumeX size={9} />
                        </Badge>
                      )}
                      {clip.audioDetached && <Badge>split</Badge>}
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
              {project.clips.slice(1).map((clip, i) => (
                <button
                  key={`cut-${clip.id}`}
                  onClick={() => onOpenTransition(clip.id)}
                  aria-label="Change transition"
                  className="absolute flex items-center justify-center rounded-[4px]"
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
              ))}
            </div>

            {/* ---------------- audio track ---------------- */}
            <div className="relative" style={{ height: AUDIO_TRACK_H, marginTop: TRACK_GAP }}>
              {project.audio.map((audio) => {
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
                    <span className="text-[10px] font-medium text-white truncate">
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
              {project.layers.map((layer) => (
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
        className="absolute flex items-center justify-center rounded-full"
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
        className="absolute flex items-center justify-center rounded-lg transition-transform active:scale-95"
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
          className="absolute left-0 right-0 flex items-center justify-center whitespace-nowrap text-[10px] pointer-events-none"
          style={{
            top: TRACK_TOP_PAD + RULER_H + VIDEO_TRACK_H + TRACK_GAP,
            height: AUDIO_TRACK_H,
            color: "rgba(255,255,255,0.26)",
            zIndex: 7,
          }}
        >
          Separate a clip&rsquo;s audio, or add a track, to edit sound on its own
        </div>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-semibold leading-[14px]"
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
      <TypeIcon size={10} className="shrink-0" />
      <span className="truncate text-[9px] font-medium">
        {layer.kind === "text" ? layer.content || "Text" : "Overlay"}
      </span>
    </button>
  );
}

/** Memoised on purpose: playback moves the tracks by writing scrollLeft, so this
 *  subtree only re-renders when the edit itself changes. */
export default memo(StudioTimeline);
