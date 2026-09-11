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
// Two consequences worth knowing before editing this file:
//
// **The selection frame is an overlay, not part of the tile.** It floats above
// the strip at the selected clip's coordinates. Drawn inside the tile it would
// be clipped by the tile's own `overflow-hidden`, and its grab bars could not
// reach past the clip's edges — which is exactly where a thumb wants them.
//
// **Trimming the FRONT grows the strip's left padding.** The right edge of a
// clip naturally follows your finger, because changing the duration moves it.
// The left edge does not: it is pinned to the clip's position on the timeline,
// so dragging it changed the trim while the bar sat still, and the gesture
// read as broken. Scrolling to compensate cannot work at the head of the
// timeline — scrollLeft clamps at 0, which is precisely where the first clip's
// left edge lives — so the row gets temporary extra padding equal to whatever
// has been trimmed off. That makes room for the edge to travel into, and the
// padding is handed back on release, when the timeline settles to its real
// shape with the new in-point under the playhead.

export const PX_PER_SECOND = 62;
const TRACK_HEIGHT = 62;
/** How far a finger may drift during a press-and-hold before it counts as a
 *  drag instead. A thumb on a phone moves several pixels without meaning to. */
const HOLD_SLOP = 12;
/** The row above the strip holding the selected clip's controls. */
const GUTTER = 32;
/** How long after the last scroll event the strip counts as stopped.
 *
 *  Refreshed on every scroll event, so it never cuts a glide short — it only
 *  has to outlast the gap between the final few events as momentum dies out,
 *  which is a frame or three. Too low and the clock starts writing scrollLeft
 *  while the strip is still coasting, which is the bug this exists for; too
 *  high and the playhead takes a visible beat to pick the strip back up after
 *  a scrub. */
const SCROLL_SETTLE_MS = 140;
/** Visible width of a trim bar, and the wider invisible area around it. */
const BAR_WIDTH = 14;
const BAR_HIT = 34;

type TrimPatch = { trimStart?: number; trimEnd?: number; stillDuration?: number };

type TrimGesture = {
  clipId: string;
  side: "start" | "end";
  originX: number;
  /** trimStart / trimEnd for a video, stillDuration for a photo. */
  base: number;
  /** scrollLeft when the gesture began, for front-trim compensation. */
  anchorScroll: number;
};

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
  onSound,
  musicName,
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
  onSound: () => void;
  /** Name of the added music track, shown in place of "Add sound". */
  musicName?: string | null;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [trimming, setTrimming] = useState<string | null>(null);
  const [trimPadLeft, setTrimPadLeft] = useState(0);
  const trimPad = useRef(0);

  // True while the strip's scrollLeft is being written by code rather than by
  // a finger, so the scroll handler doesn't take our own write as input.
  const programmatic = useRef(false);
  const seekFrame = useRef<number | null>(null);

  // True from the moment a finger scrolls the strip until the scroll has
  // actually come to rest — momentum included.
  //
  // This exists because a flick is not over when the finger leaves. The clock
  // effect below writes `scrollLeft`, and assigning `scrollLeft` mid-momentum
  // cancels the momentum outright on both iOS and Android. Without this guard
  // the two fight every frame: the flick scrolls, the scroll seeks, the seek
  // moves the clock, the clock writes the position back a frame late, and the
  // glide dies about a fifth of a second after the thumb lifts. The strip
  // could be dragged but never thrown.
  //
  // `dragging`/`trimming` don't cover it — those are for a tile being dragged,
  // and during momentum there is no finger on the screen at all.
  const userScrolling = useRef(false);
  const settleTimer = useRef<number | null>(null);

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

  // Drive the strip from the clock, but never while a hand is on it — or while
  // a throw it already let go of is still travelling.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || dragging || trimming || userScrolling.current) return;
    const targetLeft = time * PX_PER_SECOND;
    if (Math.abs(el.scrollLeft - targetLeft) < 1) return;
    programmatic.current = true;
    el.scrollLeft = targetLeft;
    // Cleared on the next frame rather than after a guessed timeout: the
    // scroll event from an assignment lands before the next paint, so one
    // frame is both sufficient and the shortest correct wait.
    requestAnimationFrame(() => {
      programmatic.current = false;
    });
  }, [time, dragging, trimming]);

  // Scrubbing fires scroll events far faster than React can usefully re-render
  // the preview, and each one used to cost a full editor render plus a
  // `video.currentTime` write. Coalescing to one seek per animation frame is
  // what makes the strip feel like it is moving under your thumb instead of
  // catching up to it.
  const handleScroll = useCallback(() => {
    if (programmatic.current) return;

    // Every scroll event pushes the settle deadline out, so the flag stays up
    // for as long as the strip keeps moving and drops shortly after it stops.
    // There is a `scrollend` event that would say this exactly, but Safari
    // only grew it recently and this has to work on the phones people have.
    userScrolling.current = true;
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null;
      userScrolling.current = false;
    }, SCROLL_SETTLE_MS);

    if (seekFrame.current !== null) return;
    seekFrame.current = requestAnimationFrame(() => {
      seekFrame.current = null;
      const el = scrollerRef.current;
      if (!el || programmatic.current) return;
      onSeek(Math.max(0, Math.min(el.scrollLeft / PX_PER_SECOND, total)));
    });
  }, [onSeek, total]);

  useEffect(
    () => () => {
      if (seekFrame.current !== null) cancelAnimationFrame(seekFrame.current);
      if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    },
    [],
  );

  const selectedIndex = clips.findIndex((c) => c.id === selectedId);
  const selected = selectedIndex >= 0 ? clips[selectedIndex] : null;
  const canSplit =
    !!selected &&
    time > starts[selectedIndex] + MIN_CLIP_DURATION &&
    time < starts[selectedIndex + 1] - MIN_CLIP_DURATION;

  /* ---------------- trimming ---------------- */

  const gesture = useRef<TrimGesture | null>(null);

  const moveTrim = useCallback(
    (event: PointerEvent) => {
      const g = gesture.current;
      const el = scrollerRef.current;
      if (!g || !el) return;
      const clip = clips.find((c) => c.id === g.clipId);
      if (!clip) return;

      const deltaSeconds = (event.clientX - g.originX) / PX_PER_SECOND;
      // How much timeline time came off the FRONT of the clip. Only this needs
      // scroll compensation; the back edge moves on its own.
      let frontDelta = 0;

      if (clip.kind === "photo") {
        // A photo has no source to trim, so both edges resize its duration —
        // dragging the left edge outward lengthens it, hence the sign flip.
        const next = Math.max(
          MIN_STILL_DURATION,
          Math.min(
            g.base + (g.side === "start" ? -deltaSeconds : deltaSeconds),
            MAX_STILL_DURATION,
          ),
        );
        onTrim(clip.id, { stillDuration: next });
        if (g.side === "start") frontDelta = g.base - next;
      } else {
        const speed = clip.speed || 1;
        const next = g.base + deltaSeconds * speed;
        if (g.side === "start") {
          const trimStart = Math.max(0, Math.min(next, clip.trimEnd - MIN_CLIP_DURATION * speed));
          onTrim(clip.id, { trimStart });
          frontDelta = (trimStart - g.base) / speed;
        } else {
          onTrim(clip.id, {
            trimEnd: Math.min(
              clip.sourceDuration,
              Math.max(next, clip.trimStart + MIN_CLIP_DURATION * speed),
            ),
          });
        }
      }

      if (g.side === "start") {
        // Room for the edge to move into, then the scroll that puts it exactly
        // under the finger. Trimming inward (frontDelta > 0) is pure padding
        // and leaves scrollLeft alone; dragging back out is pure scroll.
        const extra = Math.max(0, frontDelta) * PX_PER_SECOND;
        trimPad.current = extra;
        setTrimPadLeft(extra);
        el.scrollLeft = g.anchorScroll + extra - frontDelta * PX_PER_SECOND;
      }
    },
    [clips, onTrim],
  );

  const endTrim = useCallback(() => {
    const el = scrollerRef.current;
    const extra = trimPad.current;
    gesture.current = null;
    trimPad.current = 0;
    setTrimPadLeft(0);
    setTrimming(null);

    // Handing the padding back shifts every pixel left by `extra`, so the
    // scroll has to come down with it or the strip jumps. Clamped at 0, which
    // is the correct landing spot when the first clip's own head was trimmed:
    // the new in-point IS time zero.
    const finalScroll = el ? Math.max(0, el.scrollLeft - extra) : 0;
    requestAnimationFrame(() => {
      if (el) el.scrollLeft = finalScroll;
      programmatic.current = false;
      onSeek(finalScroll / PX_PER_SECOND);
    });
  }, [onSeek]);

  const beginTrim = useCallback((event: React.PointerEvent, clip: Clip, side: "start" | "end") => {
    const el = scrollerRef.current;
    if (!el) return;
    event.stopPropagation();
    event.preventDefault();
    gesture.current = {
      clipId: clip.id,
      side,
      originX: event.clientX,
      base:
        clip.kind === "photo"
          ? clip.stillDuration
          : side === "start"
            ? clip.trimStart
            : clip.trimEnd,
      anchorScroll: el.scrollLeft,
    };
    // Held for the whole gesture: front-trimming writes scrollLeft on every
    // move, and each of those would otherwise echo back as a seek.
    programmatic.current = true;
    setTrimming(clip.id);
  }, []);

  // Window listeners rather than pointer capture. Capture silently refuses in
  // enough situations (and cannot be driven by synthetic events at all) that a
  // gesture depending on it is a gesture that sometimes doesn't start.
  useEffect(() => {
    if (!trimming) return;
    window.addEventListener("pointermove", moveTrim);
    window.addEventListener("pointerup", endTrim);
    window.addEventListener("pointercancel", endTrim);
    return () => {
      window.removeEventListener("pointermove", moveTrim);
      window.removeEventListener("pointerup", endTrim);
      window.removeEventListener("pointercancel", endTrim);
    };
  }, [trimming, moveTrim, endTrim]);

  // Stop the strip scrolling under a clip that has been picked up.
  //
  // This is what `touch-action` could not do — see the note on the scroller.
  // `preventDefault` on a non-passive touchmove DOES stop a native pan, but
  // only while the browser has not already started one, which is exactly the
  // situation here: a hold takes 280ms of stillness to fire, so at the moment
  // this listener attaches the finger has not moved and no scroll is running.
  // React's own onTouchMove is passive, so it has to be bound by hand.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !dragging) return;
    const block = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [dragging]);

  // `trimPadLeft` has to be added by hand. An absolutely positioned child is
  // laid out against its ancestor's PADDING BOX, whose origin sits before the
  // padding — so the tiles (in normal flow) shift with it and this overlay
  // would not, leaving the frame and the clip it outlines sliding apart mid
  // trim.
  const selectionLeft = selected ? pad + trimPadLeft + starts[selectedIndex] * PX_PER_SECOND : 0;
  const selectionWidth = selected ? clipDuration(selected) * PX_PER_SECOND : 0;

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
          overscrollBehaviorX: "contain",
          // `pan-x` always, even while dragging. Flipping this to "none" when
          // the hold fires reads like it should stop the strip scrolling under
          // the drag, and it does nothing at all: a browser latches
          // touch-action when the touch STARTS, so a change 280ms later
          // applies to the next gesture, never the one in flight. The real
          // block is the non-passive touchmove listener below.
          touchAction: trimming ? "none" : "pan-x",
        }}
      >
        {/* h-full, not just items-stretch: the row is the only thing between
            the fixed-height scroller and tiles that carry a width but no
            height, so without it every tile collapses to nothing. */}
        <div
          className="relative flex h-full items-stretch"
          style={{ paddingLeft: pad + trimPadLeft, paddingRight: pad }}
        >
          {clips.map((clip, i) => (
            <ClipTile
              key={clip.id}
              clip={clip}
              index={i}
              isSelected={clip.id === selectedId}
              isDragging={clip.id === dragging}
              width={clipDuration(clip) * PX_PER_SECOND}
              // The marker between two clips says "there's a cut here". It
              // steps aside the moment either neighbour is selected, because
              // that is when the trim bars need the same few pixels — and a
              // decoration must never win a fight against the control the user
              // is reaching for.
              showBoundary={i > 0 && selectedIndex !== i && selectedIndex !== i - 1}
              onSelect={onSelect}
              onReorder={onReorder}
              onDragStateChange={setDragging}
            />
          ))}

          {selected && (
            <div
              className="pointer-events-none absolute top-0 z-20 h-full"
              style={{ left: selectionLeft, width: selectionWidth }}
            >
              <div className="absolute inset-0 rounded-[8px] border-[3px] border-white" />
              <TrimBar side="start" onDown={(e) => beginTrim(e, selected, "start")} />
              <TrimBar side="end" onDown={(e) => beginTrim(e, selected, "end")} />
            </div>
          )}
        </div>
      </div>

      {/* The playhead. Over the strip, ignoring pointers, exactly centred. */}
      <div
        className="pointer-events-none absolute left-1/2 z-10 w-[2px] -translate-x-1/2 rounded-full bg-white"
        style={{ top: GUTTER, height: TRACK_HEIGHT }}
      />

      {/* Add stays put above the strip. As the last tile in the row it drifted
          off the end of a long edit, so adding a second clip meant scrolling to
          the end to find the button. A short fade under it keeps the button
          legible when busy footage runs beneath. */}
      <div
        className="pointer-events-none absolute right-0 z-20 bg-gradient-to-l from-black/80 to-transparent"
        style={{ top: GUTTER, height: TRACK_HEIGHT, width: 92 }}
      />
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add clips"
        className="absolute right-3 z-30 flex items-center justify-center rounded-[9px] bg-white text-black shadow-[0_2px_10px_rgba(0,0,0,0.55)] active:scale-90"
        style={{ top: GUTTER + (TRACK_HEIGHT - 44) / 2, width: 44, height: 44 }}
      >
        <Plus size={22} />
      </button>

      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={onSound}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-white/[0.09] px-4 text-[14px] font-semibold text-white/90 active:scale-[0.99]"
        >
          <span className="shrink-0 text-[15px] leading-none">♪</span>
          <span className="truncate">{musicName ?? "Add sound"}</span>
        </button>
      </div>

      {playing && <span className="sr-only">Playing</span>}
    </div>
  );
}

/** One draggable edge of the selection frame. Visually flush with the clip's
 *  edge; the touch area is more than twice as wide and reaches outside it. */
function TrimBar({
  side,
  onDown,
}: {
  side: "start" | "end";
  onDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onDown}
      aria-label={side === "start" ? "Trim start" : "Trim end"}
      role="slider"
      tabIndex={0}
      aria-valuenow={0}
      className="pointer-events-auto absolute top-0 flex h-full items-center justify-center"
      style={{
        width: BAR_HIT,
        [side === "start" ? "left" : "right"]: -(BAR_HIT - BAR_WIDTH) / 2,
        touchAction: "none",
        cursor: "ew-resize",
      }}
    >
      <span
        className="flex h-full items-center justify-center rounded-[6px] bg-white"
        style={{ width: BAR_WIDTH }}
      >
        <span className="h-[20px] w-[2px] rounded-full bg-black/45" />
      </span>
    </div>
  );
}

function ClipTile({
  clip,
  index,
  isSelected,
  isDragging,
  width,
  showBoundary,
  onSelect,
  onReorder,
  onDragStateChange,
}: {
  clip: Clip;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  width: number;
  showBoundary: boolean;
  onSelect: (id: string | null) => void;
  onReorder: (from: number, to: number) => void;
  onDragStateChange: (id: string | null) => void;
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
  //
  // HOLD_SLOP is 12px, not the 6 it was. A thumb resting on a phone drifts
  // several pixels over 280ms without its owner intending to move anything,
  // and every one of those drifts used to cancel the hold before it fired —
  // which is what made picking a clip up feel like it mostly didn't work.
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
    if (Math.abs(e.clientX - origin.current) > HOLD_SLOP) {
      moved.current = true;
      if (!isDragging) clearHold();
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

  // Once the clip is picked up the gesture belongs to the WINDOW, not to this
  // tile.
  //
  // Dragging a clip left or right means the finger leaves the tile almost
  // immediately — that is the entire point of the gesture. Pointer events go
  // to whatever is under the finger, so a tile listening only to itself stops
  // hearing about the drag one tile in, and the reorder dies halfway. Same
  // reasoning, and the same fix, as the trim gesture higher up this file.
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const delta = e.clientX - origin.current;
      // One whole tile of travel commits one position. Anything finer and the
      // list churns under the finger.
      const steps = Math.trunc(delta / Math.max(40, width * 0.6));
      if (steps !== 0) {
        onReorder(index, index + steps);
        origin.current = e.clientX;
      }
    };
    const onEnd = () => onDragStateChange(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [isDragging, index, width, onReorder, onDragStateChange]);

  return (
    <>
      {showBoundary && (
        // A marker, not a control. It used to open a transitions sheet that
        // admitted transitions were not implemented; the sheet is gone and the
        // marker stayed, because saying "there is a cut here" is the job it was
        // actually doing. `aria-hidden` because the clip tiles either side
        // already announce themselves — a screen reader does not need a third
        // voice for the seam between them.
        <span
          aria-hidden
          className="pointer-events-none relative z-10 -mx-[9px] flex h-full w-[18px] shrink-0 items-center justify-center"
        >
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-white text-black">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
              <path d="M2 4v16l8-8-8-8Zm20 0-8 8 8 8V4Z" />
            </svg>
          </span>
        </span>
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
        className={`relative shrink-0 overflow-hidden transition-opacity ${
          isDragging ? "opacity-70" : ""
        }`}
        style={{ width: Math.max(24, width) }}
      >
        {clip.kind === "video" && clip.frames.length > 0 ? (
          <Filmstrip clip={clip} />
        ) : clip.thumbUrl || clip.kind === "photo" ? (
          // A photo has one frame by definition, and a video falls back to its
          // poster repeated while the filmstrip is still decoding.
          <StillStrip url={clip.thumbUrl ?? clip.url} width={Math.max(24, width)} />
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
      </div>
    </>
  );
}

/** A still, repeated along the clip's length.
 *
 *  Square tiles, each cropped to fill — NOT the whole image scaled to the
 *  track's height. A phone photo is portrait, so fitting one into a 62px strip
 *  squeezes it to about 35px wide and then tiles that, which is how a
 *  recognisable picture turns into a row of thumbnails too small to read. A
 *  centre crop at the track's own height shows the middle of the photo at a
 *  size that is actually legible, and matches how the video filmstrip beside
 *  it already looks.
 *
 *  Tiles rather than one stretched copy because a clip's width is its
 *  duration: a five-second still stretched once would be a smear, where
 *  repeats read as "this is one picture, held". */
function StillStrip({ url, width }: { url: string; width: number }) {
  const count = Math.max(1, Math.ceil(width / TRACK_HEIGHT));
  return (
    <div className="h-full w-full bg-white/5">
      {Array.from({ length: count }, (_, i) => (
        <img
          key={i}
          src={url}
          alt=""
          draggable={false}
          className="absolute top-0 h-full max-w-none object-cover"
          style={{ left: i * TRACK_HEIGHT, width: TRACK_HEIGHT }}
        />
      ))}
    </div>
  );
}

/** The clip's actual frames, laid along its length.
 *
 *  Each frame owns a span of SOURCE time, so placing it is a matter of mapping
 *  that span onto the tile: subtract the trim start, divide by speed. Both are
 *  pure arithmetic on data that is already decoded, which is what makes
 *  dragging a trim handle cheap — the strip slides and re-clips rather than
 *  re-reading the video.
 *
 *  Frames outside the trim window aren't rendered at all. They are kept in
 *  state, though: widening the trim back out has to bring them back, and
 *  decoding them a second time to do that would be absurd. */
function Filmstrip({ clip }: { clip: Clip }) {
  const speed = clip.speed || 1;
  return (
    <div className="h-full w-full bg-white/5">
      {clip.frames.map((frame) => {
        const from = Math.max(frame.start, clip.trimStart);
        const to = Math.min(frame.end, clip.trimEnd);
        if (to <= from) return null;
        return (
          <img
            key={frame.start}
            src={frame.url}
            alt=""
            draggable={false}
            className="absolute top-0 h-full max-w-none object-cover"
            style={{
              left: ((from - clip.trimStart) / speed) * PX_PER_SECOND,
              width: ((to - from) / speed) * PX_PER_SECOND,
            }}
          />
        );
      })}
    </div>
  );
}
