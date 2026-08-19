// Fixed vertical metrics for the studio screen. They live outside the component
// files because the route has to reserve space for the timeline before the
// timeline renders, and because a component module that also exports constants
// trips react-refresh's only-export-components rule.

export const VIDEO_TRACK_H = 54;
export const AUDIO_TRACK_H = 34;
export const LAYER_TRACK_H = 22;
export const TRACK_GAP = 5;
export const TRACK_TOP_PAD = 14;

export const TIMELINE_HEIGHT =
  TRACK_TOP_PAD + VIDEO_TRACK_H + TRACK_GAP + AUDIO_TRACK_H + TRACK_GAP + LAYER_TRACK_H + 12;

/** Filmstrip tile width on screen. */
export const TILE_W = 30;
/** Grab area on each end of a selected clip. */
export const HANDLE_W = 14;

export const MIN_PPS = 18;
export const MAX_PPS = 420;
export const DEFAULT_PPS = 78;
export const LONG_PRESS_MS = 320;
