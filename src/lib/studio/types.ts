// Data model for the Studio — the multi-clip video editor behind
// /create/after-shot/studio.
//
// Everything here is plain data. No blobs, no DOM, no decoders: a StudioProject
// is a pure description of an edit, which is what makes undo/redo a two-line
// stack and the exporter a pure function of (project, sources). Heavy things —
// the actual media, its decoded audio, its filmstrip — live in the source
// registry (sources.ts) and are looked up by id.
import type { Layer } from "@/lib/after-shot-layers";

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export type StudioSourceId = string;

/** A piece of media the timeline can point at. One per distinct file, however
 *  many clips reference it. */
export type StudioSource = {
  id: StudioSourceId;
  kind: "video" | "image" | "audio";
  blob: Blob;
  /** Object URL. Owned by the source registry, revoked when the studio unmounts. */
  url: string;
  /** Seconds. For images this is the nominal length a new clip gets. */
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  /** Human label for the audio chip — "original", a filename. */
  name: string;
};

export type SourceMap = Record<StudioSourceId, StudioSource>;

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** Every value is a signed percentage, 0 = untouched. These map onto CSS filter
 *  functions in adjustments.ts so the preview (CSS on the element) and the bake
 *  (compiled colour matrix) are driven by one string and cannot drift. */
export type Adjustments = {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  warmth: number; // -100..100  (cool <-> warm)
  fade: number; // 0..100      (lifted blacks, matte look)
  vignette: number; // 0..100   drawn, not a colour matrix — see render.ts
};

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  fade: 0,
  vignette: 0,
};

export function isNeutral(a: Adjustments): boolean {
  return (
    a.brightness === 0 &&
    a.contrast === 0 &&
    a.saturation === 0 &&
    a.warmth === 0 &&
    a.fade === 0 &&
    a.vignette === 0
  );
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export type TransitionKind = "none" | "dissolve" | "flash" | "slide" | "zoom";

export type Transition = {
  kind: TransitionKind;
  /** Total window length in seconds, centred on the cut. */
  duration: number;
};

export const NO_TRANSITION: Transition = { kind: "none", duration: 0 };

export const TRANSITION_PRESETS: { kind: TransitionKind; label: string; duration: number }[] = [
  { kind: "none", label: "None", duration: 0 },
  { kind: "dissolve", label: "Dissolve", duration: 0.4 },
  { kind: "flash", label: "Flash", duration: 0.3 },
  { kind: "slide", label: "Whip", duration: 0.35 },
  { kind: "zoom", label: "Punch", duration: 0.35 },
];

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export const MIN_CLIP_DURATION = 0.1; // seconds of source, before speed
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;
export const SPEED_PRESETS = [0.25, 0.5, 1, 2, 3, 4];

/** The video track is gapless and ordered: a clip's timeline position is the sum
 *  of every earlier clip's on-timeline length. Nothing stores an absolute start,
 *  so trimming clip 1 can never leave a hole in front of clip 2. */
export type VideoClip = {
  id: string;
  sourceId: StudioSourceId;
  /** Seconds into the source. */
  inPoint: number;
  outPoint: number;
  speed: number;
  /** Linear gain, 0..2. Ignored once audioDetached is true. */
  volume: number;
  muted: boolean;
  /** True once the clip's sound has been lifted onto its own audio-track chip.
   *  The video keeps playing silently and the AudioClip owns the sound. */
  audioDetached: boolean;
  filterId: string;
  adjustments: Adjustments;
  /** Applies at the cut BEFORE this clip. The first clip's is always "none". */
  transitionIn: Transition;
};

export type AudioClipKind = "detached" | "music" | "voiceover";

/** Audio floats: it stores its own absolute timeline position, so detaching a
 *  clip's sound and then sliding it half a second late is just a number change. */
export type AudioClip = {
  id: string;
  sourceId: StudioSourceId;
  kind: AudioClipKind;
  label: string;
  timelineStart: number;
  inPoint: number;
  outPoint: number;
  /** Playback rate, so detached sound can follow the clip's speed change. */
  speed: number;
  volume: number;
  muted: boolean;
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  /** Set for kind === "detached": which video clip it was lifted from. */
  linkedClipId?: string;
};

export function audioDuration(a: AudioClip): number {
  return Math.max(0, (a.outPoint - a.inPoint) / a.speed);
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

/** An after-shot Layer that only exists between two timeline instants. The base
 *  Layer union is untouched — a TimedLayer[] is assignable to Layer[], so
 *  LayerOverlay and layer-bake.ts both take these unchanged. */
export type TimedLayer = Layer & { startTime: number; endTime: number };

/** Everything a studio caption needs except its id, text and timing. Centred and
 *  sized in the same fractional units the after-shot layer system uses, so a
 *  caption placed here bakes identically through layer-bake.ts. */
export const TEXT_DEFAULTS = {
  x: 0.5,
  y: 0.72,
  scale: 1,
  rotation: 0,
  zIndex: 0,
  font: "'SF Pro', system-ui, sans-serif",
  color: "#FFFFFF",
  fontSize: 0.062,
  align: "center" as const,
  boxColor: null as string | null,
  fontWeight: 700,
};

/** Oakmonte's own overlay: a shoppable tag pinned to the frame for a stretch of
 *  the video. Deliberately NOT a Layer subtype — it is baked by the studio's own
 *  renderer (render.ts) so nothing in the shared after-shot pipeline has to grow
 *  a case for a marketplace concept. */
export type ProductPin = {
  id: string;
  title: string;
  price: string;
  x: number; // 0-1 fraction of frame width
  y: number; // 0-1 fraction of frame height
  startTime: number;
  endTime: number;
  /** Which side the pill hangs off the dot, so a pin near the right edge stays on screen. */
  side: "left" | "right";
};

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export type AspectPreset = {
  id: string;
  label: string;
  sublabel: string;
  ratio: number; // width / height
};

/** Placement-driven, not arbitrary — each one is somewhere the finished video
 *  actually gets shown in Oakmonte. */
export const ASPECT_PRESETS: AspectPreset[] = [
  { id: "9:16", label: "9:16", sublabel: "Feed", ratio: 9 / 16 },
  { id: "4:5", label: "4:5", sublabel: "Product", ratio: 4 / 5 },
  { id: "1:1", label: "1:1", sublabel: "Grid", ratio: 1 },
  { id: "16:9", label: "16:9", sublabel: "Wide", ratio: 16 / 9 },
];

export type FitMode = "fill" | "fit";

export type StudioProject = {
  clips: VideoClip[];
  audio: AudioClip[];
  layers: TimedLayer[];
  pins: ProductPin[];
  aspectId: string;
  fitMode: FitMode;
  /** Timeline second the listing thumbnail is grabbed from. */
  coverTime: number;
  /** Master mute for the whole mix — the speaker icon left of the track. */
  masterMuted: boolean;
};

export type StudioSelection =
  | { kind: "clip"; id: string }
  | { kind: "audio"; id: string }
  | { kind: "layer"; id: string }
  | { kind: "pin"; id: string }
  | null;

// ---------------------------------------------------------------------------
// Derived geometry
// ---------------------------------------------------------------------------

/** How long a clip occupies on the timeline — source length divided by speed. */
export function clipDuration(clip: VideoClip): number {
  return Math.max(0, (clip.outPoint - clip.inPoint) / clip.speed);
}

/** Absolute timeline start of every clip, in order. Length === clips.length. */
export function clipStarts(clips: VideoClip[]): number[] {
  const starts: number[] = [];
  let t = 0;
  for (const clip of clips) {
    starts.push(t);
    t += clipDuration(clip);
  }
  return starts;
}

export function videoDuration(clips: VideoClip[]): number {
  return clips.reduce((sum, c) => sum + clipDuration(c), 0);
}

/** The full timeline length: the video track, or a trailing music clip if it
 *  runs past the last frame. */
export function projectDuration(project: StudioProject): number {
  let end = videoDuration(project.clips);
  for (const a of project.audio) {
    const stop = a.timelineStart + audioDuration(a);
    if (stop > end) end = stop;
  }
  return end;
}

export type ResolvedClip = {
  clip: VideoClip;
  index: number;
  start: number;
  end: number;
  /** Seconds into the SOURCE for the requested timeline instant. */
  sourceTime: number;
};

/** Which clip is on screen at timeline time t, and where in its source we are. */
export function resolveAtTime(clips: VideoClip[], t: number): ResolvedClip | null {
  if (clips.length === 0) return null;
  const starts = clipStarts(clips);
  for (let i = clips.length - 1; i >= 0; i--) {
    const start = starts[i];
    if (t >= start || i === 0) {
      const clip = clips[i];
      const end = start + clipDuration(clip);
      const local = Math.min(Math.max(t - start, 0), Math.max(end - start, 0));
      return {
        clip,
        index: i,
        start,
        end,
        sourceTime: Math.min(clip.outPoint, clip.inPoint + local * clip.speed),
      };
    }
  }
  return null;
}

export function findAspect(id: string): AspectPreset {
  return ASPECT_PRESETS.find((a) => a.id === id) ?? ASPECT_PRESETS[0];
}

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/** mm:ss for the readout under the preview, matching the reference's 00:00/00:01. */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
