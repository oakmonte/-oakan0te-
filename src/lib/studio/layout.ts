// Fixed vertical metrics for the studio screen. They live outside the component
// files because the route has to reserve space for the timeline before the
// timeline renders, and because a component module that also exports constants
// trips react-refresh's only-export-components rule.

export const RULER_H = 16;
export const VIDEO_TRACK_H = 54;
export const AUDIO_TRACK_H = 34;
export const LAYER_TRACK_H = 24;
export const TRACK_GAP = 5;
export const TRACK_TOP_PAD = 4;

export const TIMELINE_HEIGHT =
  TRACK_TOP_PAD +
  RULER_H +
  VIDEO_TRACK_H +
  TRACK_GAP +
  AUDIO_TRACK_H +
  TRACK_GAP +
  LAYER_TRACK_H +
  10;

/** Vertical centre of the video track, measured from the top of the timeline —
 *  what the pinned speaker and `+` buttons align to. */
export const VIDEO_TRACK_CENTER = TRACK_TOP_PAD + RULER_H + VIDEO_TRACK_H / 2;

/** Filmstrip tile width on screen. */
export const TILE_W = 30;
/** Ceiling on tiles per clip. At full zoom a minute-long clip is 25,000px wide,
 *  which at a fixed 30px tile is 840 base64 images in one row — a multi-second
 *  main-thread freeze mid-gesture. Past this the tiles simply get wider. */
export const MAX_TILES_PER_CLIP = 80;
/** Visual gap between neighbouring clips on the video track. Drawn, not
 *  timed: the track stays gapless (see README "Time model") and each clip is
 *  simply inset by half of this on both sides, so a cut reads as two objects
 *  rather than one continuous strip. */
export const CLIP_GAP = 3;
/** Grab area on each end of a selected clip. */
export const HANDLE_W = 14;

export const MIN_PPS = 18;
export const MAX_PPS = 420;
export const DEFAULT_PPS = 78;
export const LONG_PRESS_MS = 320;
/** Pointer travel that turns a tap into a drag, matching LayerOverlay's. */
export const TAP_SLOP = 6;

/** Ruler tick steps in seconds, coarsest last. The first one whose on-screen
 *  spacing clears MIN_TICK_PX wins. */
export const RULER_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
export const MIN_TICK_PX = 52;
