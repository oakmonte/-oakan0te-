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
  MIN_PPS,
  TILE_W,
  TIMELINE_HEIGHT,
  TRACK_GAP,
  TRACK_TOP_PAD,
  VIDEO_TRACK_H,
} from "@/lib/studio/layout";
import {
  audioDuration,
  clipDuration,
  clipStarts,
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
// nothing in this subtree. The clock writes scrollLeft imperatively through
// playback.subscribe(), and ownerRef arbitrates between clock and finger,
// because a programmatic scrollLeft fires exactly the same event a swipe does.

type Props = {
  project: StudioProject;
  sources: SourceMap;
  /** Individual stable handles rather than the PlaybackApi object: that object is
   *  rebuilt every frame (it carries `time`), which would defeat the memo below. */
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

  const starts = useMemo(() => clipStarts(project.clips), [project.clips]);
  const totalDuration = useMemo(() => {
    const clips = project.clips;
    let end = clips.length ? starts[clips.length - 1] + clipDuration(clips[clips.length - 1]) : 0;
    for (const a of project.audio) end = Math.max(end, a.timelineStart + audioDuration(a));
    return end;
  }, [starts, project.clips, project.audio]);

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

  // Zooming holds the playhead's moment still rather than the scroll offset,
  // which is what "zoom in on this bit" has to mean.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && ownerRef.current !== "user") el.scrollLeft = timeRef.current * pps;
  }, [pps, timeRef, halfWidth]);

  const armIdleRelease = useCallback(() => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    // Ownership goes back to the clock only once the scroller has actually come
    // to rest — iOS momentum keeps firing events long after the finger is gone,
    // and handing back early makes the engine fight the fling.
    idleTimer.current = window.setTimeout(() => {
      ownerRef.current = "engine";
    }, 180);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || ownerRef.current !== "user") return;
    seek(el.scrollLeft / pps);
    armIdleRelease();
  }, [armIdleRelease, seek, pps]);

  // --- pinch zoom + scroll ownership ---------------------------------------
  const pinchRef = useRef<{ distance: number; pps: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      ownerRef.current = "user";
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      pause();
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinchRef.current = { distance: Math.hypot(b.x - a.x, b.y - a.y), pps };
      }
    },
    [pause, pps],
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

  // --- trim handles ---------------------------------------------------------
  const trimRef = useRef<{
    clipId: string;
    edge: "in" | "out";
    startX: number;
    startValue: number;
    speed: number;
  } | null>(null);
  const [trimming, setTrimming] = useState(false);

  const startTrim = useCallback(
    (clip: VideoClip, edge: "in" | "out") => (e: ReactPointerEvent) => {
      e.stopPropagation();
      beginHistoryGroup();
      setTrimming(true);
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
      // Screen pixels are timeline seconds; a trim consumes SOURCE seconds, which
      // is timeline seconds times the clip's speed.
      const delta = ((e.clientX - trim.startX) / pps) * trim.speed;
      onTrim(trim.clipId, trim.edge, trim.startValue + delta);
    },
    [onTrim, pps],
  );

  const endTrim = useCallback(() => {
    if (!trimRef.current) return;
    trimRef.current = null;
    setTrimming(false);
    endHistoryGroup();
  }, [endHistoryGroup]);

  // --- long-press reorder ---------------------------------------------------
  const dragRef = useRef<{
    clipId: string;
    startX: number;
    timer: number | null;
    active: boolean;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const startClipPress = useCallback(
    (clip: VideoClip) => (e: ReactPointerEvent) => {
      onSelect({ kind: "clip", id: clip.id });
      const timer = window.setTimeout(() => {
        if (!dragRef.current) return;
        dragRef.current.active = true;
        setDraggingId(clip.id);
        beginHistoryGroup();
        navigator.vibrate?.(8);
      }, LONG_PRESS_MS);
      dragRef.current = { clipId: clip.id, startX: e.clientX, timer, active: false };
    },
    [beginHistoryGroup, onSelect],
  );

  const moveClipPress = useCallback(
    (e: ReactPointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;

      if (!drag.active) {
        // Moving before the hold completes means the user is scrubbing, not
        // rearranging — disarm rather than hijack the scroll.
        if (Math.abs(dx) > 8 && drag.timer !== null) {
          window.clearTimeout(drag.timer);
          dragRef.current = null;
        }
        return;
      }

      e.stopPropagation();
      setDragOffset(dx);

      // Swap the moment the lifted chip's centre passes a neighbour's centre.
      const index = project.clips.findIndex((c) => c.id === drag.clipId);
      if (index < 0) return;
      if (dx > 0 && index < project.clips.length - 1) {
        const next = clipDuration(project.clips[index + 1]) * pps;
        if (dx > next / 2) {
          onReorder(drag.clipId, index + 1);
          drag.startX += next;
          setDragOffset(0);
        }
      } else if (dx < 0 && index > 0) {
        const prev = clipDuration(project.clips[index - 1]) * pps;
        if (-dx > prev / 2) {
          onReorder(drag.clipId, index - 1);
          drag.startX -= prev;
          setDragOffset(0);
        }
      }
    },
    [onReorder, pps, project.clips],
  );

  const endClipPress = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.timer !== null) window.clearTimeout(drag.timer);
    if (drag.active) endHistoryGroup();
    dragRef.current = null;
    setDraggingId(null);
    setDragOffset(0);
  }, [endHistoryGroup]);

  const contentWidth = Math.max(totalDuration * pps, 1);
  const lockScroll = trimming || draggingId !== null;

  return (
    <div className="relative w-full select-none" style={{ height: TIMELINE_HEIGHT }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          onPointerMoveZoom(e);
          moveTrim(e);
          moveClipPress(e);
        }}
        onPointerUp={(e) => {
          onPointerUpZoom(e);
          endTrim();
          endClipPress();
        }}
        onPointerCancel={(e) => {
          onPointerUpZoom(e);
          endTrim();
          endClipPress();
        }}
        className="absolute inset-0 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          overscrollBehaviorX: "contain",
          touchAction: lockScroll ? "none" : "pan-x",
        }}
      >
        <div style={{ paddingLeft: halfWidth, paddingRight: halfWidth, width: "max-content" }}>
          <div className="relative" style={{ width: contentWidth, paddingTop: TRACK_TOP_PAD }}>
            {/* Beat markers sit under everything, so they read as a grid rather
                than as another object competing with the clips. */}
            {beats.map((t, i) => (
              <div
                key={i}
                className="absolute bottom-0 w-px pointer-events-none"
                style={{ left: t * pps, top: 6, background: "rgba(255,255,255,0.16)" }}
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
                      {(clip.muted || clip.audioDetached || project.masterMuted) && (
                        <Badge>
                          <VolumeX size={9} />
                        </Badge>
                      )}
                      {clip.speed !== 1 && <Badge>{clip.speed}x</Badge>}
                    </div>

                    {isSelected && (
                      <>
                        <TrimHandle side="left" onPointerDown={startTrim(clip, "in")} />
                        <TrimHandle side="right" onPointerDown={startTrim(clip, "out")} />
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
                const width = Math.max(18, audioDuration(audio) * pps);
                const isSelected = selection?.kind === "audio" && selection.id === audio.id;
                return (
                  <button
                    key={audio.id}
                    onClick={() => onSelect({ kind: "audio", id: audio.id })}
                    className="absolute top-0 flex items-center gap-1 overflow-hidden px-1.5"
                    style={{
                      left: audio.timelineStart * pps,
                      width,
                      height: AUDIO_TRACK_H,
                      borderRadius: 6,
                      background: audio.muted ? "rgba(99,102,241,0.35)" : "#6366F1",
                      outline: isSelected ? "2px solid #fff" : "none",
                      outlineOffset: -1,
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
                  </button>
                );
              })}
              {project.audio.length === 0 && (
                <div
                  className="absolute top-0 left-0 flex items-center whitespace-nowrap text-[10px]"
                  style={{ height: AUDIO_TRACK_H, color: "rgba(255,255,255,0.26)" }}
                >
                  Detach a clip or add a track to edit sound separately
                </div>
              )}
            </div>

            {/* ---------------- caption / sticker track ---------------- */}
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

      {/* Edge controls, pinned to the screen exactly as the reference shows. */}
      <button
        onClick={onToggleMasterMute}
        aria-label={project.masterMuted ? "Unmute timeline" : "Mute timeline"}
        aria-pressed={project.masterMuted}
        className="absolute flex items-center justify-center rounded-full"
        style={{
          left: 10,
          top: TRACK_TOP_PAD + VIDEO_TRACK_H / 2 - 16,
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
          top: TRACK_TOP_PAD + VIDEO_TRACK_H / 2 - 16,
          width: 32,
          height: 32,
          background: "#fff",
          color: "#000",
          zIndex: 9,
        }}
      >
        <Plus size={19} />
      </button>
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
  onPointerDown,
}: {
  side: "left" | "right";
  onPointerDown: (e: ReactPointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute top-0 bottom-0 flex items-center justify-center"
      style={{
        [side]: 0,
        width: HANDLE_W,
        background: "#fff",
        borderRadius: side === "left" ? "6px 0 0 6px" : "0 6px 6px 0",
        cursor: "ew-resize",
        touchAction: "none",
        zIndex: 4,
      }}
    >
      <span style={{ width: 2, height: 16, borderRadius: 1, background: "rgba(0,0,0,0.55)" }} />
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
  const count = Math.max(1, Math.ceil(width / TILE_W));
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
          style={{ width: TILE_W, backgroundImage: `url(${url})`, backgroundSize: "cover" }}
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
  const label =
    layer.kind === "text" ? layer.content || "Text" : layer.kind === "sticker" ? "Sticker" : "Draw";
  return (
    <button
      onClick={onSelect}
      className="absolute top-0 flex items-center gap-1 overflow-hidden px-1.5"
      style={{
        left: layer.startTime * pps,
        width: Math.max(24, (layer.endTime - layer.startTime) * pps),
        height: LAYER_TRACK_H,
        borderRadius: 5,
        background: selected ? "#fff" : "rgba(255,255,255,0.16)",
        color: selected ? "#000" : "#fff",
      }}
    >
      <TypeIcon size={9} className="shrink-0" />
      <span className="truncate text-[9px] font-medium">{label}</span>
    </button>
  );
}

/** Memoised on purpose: playback moves the tracks by writing scrollLeft, so this
 *  subtree only re-renders when the edit itself changes. */
export default memo(StudioTimeline);
