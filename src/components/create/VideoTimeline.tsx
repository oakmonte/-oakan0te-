import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Plus, Split, Volume2, VolumeX } from "lucide-react";
import {
  clipDuration,
  clipStarts,
  MIN_CLIP_DURATION,
  MAX_STILL_DURATION,
  MIN_STILL_DURATION,
  sequenceDuration,
  type Clip,
} from "@/lib/video-sequence";

// The timeline. The playhead does not move — the film does.
//
// That inversion is the whole interaction: a fixed centre line plus a strip
// that scrolls under it means scrubbing is just native scrolling, with the
// momentum, rubber-banding and pixel-accuracy the OS already provides. Trying
// to drag a playhead along a static strip means reimplementing all of that
// badly, and it puts the frame you're judging under your own thumb.
//
// The cost of the trick is the half-screen of padding at each end (so the
// first and last frames can reach the centre) and a guard against the
// scroll/state feedback loop: playback writes scrollLeft, scrolling writes
// time, and without `programmatic` they fight each other every frame.

export const PX_PER_SECOND = 62;
const TRACK_HEIGHT = 62;
/** The row above the strip holding the selected clip's controls. */
const GUTTER = 32;
/** Fingers are wider than a hairline; the grab area is bigger than the paint. */
const HANDLE_HIT = 22;

type TrimPatch = { trimStart?: number; trimEnd?: number; stillDuration?: number };

export default function VideoTimeline({
  clips,
  selectedId,
  time,
  playing,
  onSelect,
  onSeek,
  onTrim,
  onReorder,
  onAdd,
  onSplit,
  onToggleMute,
  onTransition,
}: {
  clips: Clip[];
  selectedId: string | null;
  time: number;
  playing: boolean;
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
  onTrim: (id: string, patch: TrimPatch) => void;
  onReorder: (from: number, to: number) => void;
  onAdd: (e: React.MouseEvent<HTMLElement>) => void;
  onSplit: () => void;
  onToggleMute: (id: string) => void;
  onTransition: (index: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);
  // True while WE are setting scrollLeft, so the scroll handler doesn't take
  // its own write as user input and echo it back as a seek.
  const programmatic = useRef(false);
  const settle = useRef<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [trimming, setTrimming] = useState<string | null>(null);

  const total = sequenceDuration(clips);
  const starts = clipStarts(clips);

  // Half the viewport, so time 0 and the final frame can both reach the centre.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setPad(el.clientWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drive the strip from the clock. Skipped while the user is dragging
  // anything — their hand outranks the playhead.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || dragging || trimming) return;
    const targetLeft = time * PX_PER_SECOND;
    if (Math.abs(el.scrollLeft - targetLeft) < 1) return;
    programmatic.current = true;
    el.scrollLeft = targetLeft;
    if (settle.current) window.clearTimeout(settle.current);
    // Scroll events land a frame or two after the assignment, so the flag has
    // to outlive the call that set it.
    settle.current = window.setTimeout(() => {
      programmatic.current = false;
    }, 80);
  }, [time, dragging, trimming]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || programmatic.current) return;
    onSeek(Math.max(0, Math.min(el.scrollLeft / PX_PER_SECOND, total)));
  }, [onSeek, total]);

  const selectedIndex = clips.findIndex((c) => c.id === selectedId);
  const selected = selectedIndex >= 0 ? clips[selectedIndex] : null;
  const canSplit =
    !!selected &&
    time > starts[selectedIndex] + MIN_CLIP_DURATION &&
    time < starts[selectedIndex + 1] - MIN_CLIP_DURATION;

  return (
    <div className="relative select-none" style={{ height: GUTTER + TRACK_HEIGHT + 56 }}>
      {/* Controls for the selected clip, in their own row rather than floating
          over the strip — a pill sitting on top of the film hides the frames
          you're deciding about. Split is centred because that's where the cut
          lands: directly under the playhead. */}
      <div className="relative flex items-center px-4" style={{ height: GUTTER }}>
        {selected?.kind === "video" && (
          <button
            type="button"
            onClick={() => onToggleMute(selected.id)}
            aria-label={selected.muted ? "Unmute clip" : "Mute clip"}
            className="flex h-7 items-center gap-1.5 rounded-full bg-white/[0.12] px-2.5 text-[11px] font-medium text-white/85 active:scale-90"
          >
            {selected.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            {selected.muted ? "Muted" : "Sound on"}
          </button>
        )}
        {canSplit && (
          <button
            type="button"
            onClick={onSplit}
            aria-label="Split clip at playhead"
            className="absolute left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold text-black active:scale-95"
          >
            <Split size={13} /> Split
          </button>
        )}
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="no-scrollbar overflow-x-auto overflow-y-hidden"
        style={{
          height: TRACK_HEIGHT,
          scrollbarWidth: "none",
          // Momentum scrolling is what makes this read as a scrub rather than
          // a drag, but it must be off while a trim handle has the pointer.
          overscrollBehaviorX: "contain",
          touchAction: dragging || trimming ? "none" : "pan-x",
        }}
      >
        {/* h-full, not just items-stretch: the row is the only thing between
            the fixed-height scroller and tiles that carry a width but no
            height, so without it every tile collapses to nothing. */}
        <div className="flex h-full items-stretch" style={{ paddingLeft: pad, paddingRight: pad }}>
          {clips.map((clip, i) => (
            <ClipTile
              key={clip.id}
              clip={clip}
              index={i}
              isSelected={clip.id === selectedId}
              isDragging={clip.id === dragging}
              width={clipDuration(clip) * PX_PER_SECOND}
              onSelect={onSelect}
              onTrim={onTrim}
              onReorder={onReorder}
              onDragStateChange={setDragging}
              onTrimStateChange={setTrimming}
              onTransition={i > 0 ? () => onTransition(i) : undefined}
            />
          ))}
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add clips"
            className="ml-2 flex shrink-0 items-center justify-center rounded-[7px] bg-white text-black active:scale-90"
            style={{ width: 46 }}
          >
            <Plus size={22} />
          </button>
        </div>
      </div>

      {/* The playhead. Over the strip, ignoring pointers, exactly centred. */}
      <div
        className="pointer-events-none absolute left-1/2 z-10 w-[2px] -translate-x-1/2 rounded-full bg-white"
        style={{ top: GUTTER, height: TRACK_HEIGHT }}
      />

      <div className="px-4 pt-3">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-white/[0.09] text-[14px] font-semibold text-white/90 active:scale-[0.99]"
        >
          <span className="text-[15px] leading-none">♪</span> Add sound
        </button>
      </div>

      {playing && <span className="sr-only">Playing</span>}
    </div>
  );
}

function ClipTile({
  clip,
  index,
  isSelected,
  isDragging,
  width,
  onSelect,
  onTrim,
  onReorder,
  onDragStateChange,
  onTrimStateChange,
  onTransition,
}: {
  clip: Clip;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  width: number;
  onSelect: (id: string | null) => void;
  onTrim: (id: string, patch: TrimPatch) => void;
  onReorder: (from: number, to: number) => void;
  onDragStateChange: (id: string | null) => void;
  onTrimStateChange: (id: string | null) => void;
  onTransition?: () => void;
}) {
  const holdTimer = useRef<number | null>(null);
  const origin = useRef(0);
  const moved = useRef(false);

  const clearHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  // Press-and-hold to pick a clip up. A plain drag can't mean "reorder" here —
  // horizontal drag already means "scrub", and the strip would have to guess
  // which one the user meant. The hold makes it explicit.
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    origin.current = e.clientX;
    moved.current = false;
    clearHold();
    holdTimer.current = window.setTimeout(() => {
      onDragStateChange(clip.id);
      onSelect(clip.id);
      if (navigator.vibrate) navigator.vibrate(8);
    }, 280);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (Math.abs(e.clientX - origin.current) > 6) {
      moved.current = true;
      if (!isDragging) clearHold();
    }
    if (!isDragging) return;
    const delta = e.clientX - origin.current;
    // One whole tile of travel commits one position. Anything finer and the
    // list churns under the finger.
    const steps = Math.trunc(delta / Math.max(40, width * 0.6));
    if (steps !== 0) {
      onReorder(index, index + steps);
      origin.current = e.clientX;
    }
  }

  function handlePointerUp() {
    clearHold();
    if (isDragging) {
      onDragStateChange(null);
      return;
    }
    if (!moved.current) onSelect(isSelected ? null : clip.id);
  }

  return (
    <>
      {onTransition && (
        <button
          type="button"
          onClick={onTransition}
          aria-label={`Transition before clip ${index + 1}`}
          className="relative z-10 -mx-[9px] flex h-full w-[18px] shrink-0 items-center justify-center"
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-white text-black">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
              <path d="M2 4v16l8-8-8-8Zm20 0-8 8 8 8V4Z" />
            </svg>
          </span>
        </button>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={`${clip.kind === "photo" ? "Photo" : "Video"} clip ${index + 1}`}
        aria-pressed={isSelected}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          clearHold();
          onDragStateChange(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect(isSelected ? null : clip.id);
        }}
        className={`relative shrink-0 overflow-hidden transition-[border-color,opacity] ${
          isSelected ? "rounded-[7px] border-2 border-white" : "border-2 border-transparent"
        } ${isDragging ? "opacity-70" : ""}`}
        style={{ width: Math.max(24, width) }}
      >
        {/* The poster tiled across the clip's length. Decoding a real frame per
            50px would be the accurate thing and is far too expensive on a
            phone for a strip this size — the repeat reads as "footage" at a
            glance, which is all this row is for. */}
        {clip.thumbUrl || clip.kind === "photo" ? (
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `url(${clip.thumbUrl ?? clip.url})`,
              backgroundSize: "auto 100%",
              backgroundRepeat: "repeat-x",
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/10">
            <ImageIcon size={16} className="text-white/40" />
          </div>
        )}

        {clip.muted && clip.kind === "video" && (
          <span className="absolute bottom-1 left-1 rounded-[3px] bg-black/65 p-[3px]">
            <VolumeX size={10} />
          </span>
        )}
        {clip.speed !== 1 && (
          <span className="absolute bottom-1 right-1 rounded-[3px] bg-black/65 px-1 text-[9px] font-semibold">
            {clip.speed}x
          </span>
        )}

        {isSelected && (
          <>
            <TrimHandle side="start" clip={clip} onTrim={onTrim} onActive={onTrimStateChange} />
            <TrimHandle side="end" clip={clip} onTrim={onTrim} onActive={onTrimStateChange} />
          </>
        )}
      </div>
    </>
  );
}

/** One edge of the selected clip. Dragging it changes the trim window for a
 *  video, or the hold duration for a photo — the same gesture on both, because
 *  from the timeline's point of view they are the same thing: where the clip
 *  starts and stops. */
function TrimHandle({
  side,
  clip,
  onTrim,
  onActive,
}: {
  side: "start" | "end";
  clip: Clip;
  onTrim: (id: string, patch: TrimPatch) => void;
  onActive: (id: string | null) => void;
}) {
  const origin = useRef(0);
  const base = useRef(0);

  function begin(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = e.clientX;
    base.current =
      clip.kind === "photo" ? clip.stillDuration : side === "start" ? clip.trimStart : clip.trimEnd;
    onActive(clip.id);
  }

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const deltaSeconds = (e.clientX - origin.current) / PX_PER_SECOND;

    if (clip.kind === "photo") {
      // A photo has no source to trim, so both edges resize its duration —
      // dragging the left edge outward has to lengthen it, hence the sign flip.
      const next = base.current + (side === "start" ? -deltaSeconds : deltaSeconds);
      onTrim(clip.id, {
        stillDuration: Math.max(MIN_STILL_DURATION, Math.min(next, MAX_STILL_DURATION)),
      });
      return;
    }

    const speed = clip.speed || 1;
    if (side === "start") {
      const next = base.current + deltaSeconds * speed;
      onTrim(clip.id, {
        trimStart: Math.max(0, Math.min(next, clip.trimEnd - MIN_CLIP_DURATION * speed)),
      });
    } else {
      const next = base.current + deltaSeconds * speed;
      onTrim(clip.id, {
        trimEnd: Math.min(
          clip.sourceDuration,
          Math.max(next, clip.trimStart + MIN_CLIP_DURATION * speed),
        ),
      });
    }
  }

  return (
    <div
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={() => onActive(null)}
      onPointerCancel={() => onActive(null)}
      aria-label={side === "start" ? "Trim start" : "Trim end"}
      className={`absolute top-0 z-10 flex h-full items-center justify-center ${
        side === "start" ? "left-0" : "right-0"
      }`}
      style={{ width: HANDLE_HIT, touchAction: "none", cursor: "ew-resize" }}
    >
      <span
        className={`flex h-full w-[11px] items-center justify-center bg-white ${
          side === "start" ? "rounded-l-[5px]" : "rounded-r-[5px]"
        }`}
      >
        <span className="h-[18px] w-[2px] rounded-full bg-black/45" />
      </span>
    </div>
  );
}
