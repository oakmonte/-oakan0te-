// The Studio's document reducer plus its undo/redo stack.
//
// Every edit the UI can make is an action here and nothing else mutates a
// project. That is what makes the reference's undo/redo pair honest: history is
// a list of whole StudioProject snapshots, and a snapshot is cheap because a
// project holds only numbers and ids (sources.ts owns the megabytes).
//
// Continuous gestures — dragging a trim handle, sliding a fader — would
// otherwise push fifty snapshots per swipe, so they wrap themselves in
// beginHistoryGroup()/endHistoryGroup(): one snapshot at the start, silent
// updates until the finger lifts.
import { useCallback, useReducer } from "react";
import {
  MIN_CLIP_DURATION,
  MIN_SPEED,
  MAX_SPEED,
  NO_TRANSITION,
  clipDuration,
  clipStarts,
  resolveAtTime,
  uid,
  type Adjustments,
  type AudioClip,
  type ProductPin,
  type StudioProject,
  type TimedLayer,
  type Transition,
  type VideoClip,
  type FitMode,
} from "./types";

export type StudioAction =
  | { type: "addClips"; clips: VideoClip[]; atIndex?: number }
  | { type: "deleteClip"; id: string }
  | { type: "duplicateClip"; id: string }
  | { type: "moveClip"; id: string; delta: number }
  | { type: "reorderClip"; id: string; toIndex: number }
  | { type: "splitAt"; time: number }
  | { type: "trimClip"; id: string; inPoint?: number; outPoint?: number }
  | { type: "setSpeed"; id: string; speed: number }
  | { type: "setVolume"; id: string; volume: number }
  | { type: "toggleClipMute"; id: string }
  | { type: "detachAudio"; id: string }
  | { type: "reattachAudio"; audioId: string }
  | { type: "setFilter"; id: string; filterId: string; all?: boolean }
  | { type: "setAdjustments"; id: string; adjustments: Adjustments; all?: boolean }
  | { type: "setTransition"; id: string; transition: Transition }
  | { type: "revealRamp"; time: number }
  | { type: "addAudio"; clip: AudioClip }
  | { type: "updateAudio"; id: string; patch: Partial<AudioClip> }
  | { type: "deleteAudio"; id: string }
  | { type: "addLayer"; layer: TimedLayer }
  | { type: "updateLayer"; id: string; patch: Partial<TimedLayer> }
  | { type: "deleteLayer"; id: string }
  | { type: "addPin"; pin: ProductPin }
  | { type: "updatePin"; id: string; patch: Partial<ProductPin> }
  | { type: "deletePin"; id: string }
  | { type: "setAspect"; aspectId: string }
  | { type: "setFitMode"; fitMode: FitMode }
  | { type: "setCoverTime"; time: number }
  | { type: "toggleMasterMute" };

// The first clip can never have an incoming transition — there is nothing to
// transition FROM. Reorder and delete both have to re-establish that.
function normalise(project: StudioProject): StudioProject {
  const clips = project.clips.map((c, i) =>
    i === 0 && c.transitionIn.kind !== "none" ? { ...c, transitionIn: NO_TRANSITION } : c,
  );
  const changed = clips.some((c, i) => c !== project.clips[i]);
  return changed ? { ...project, clips } : project;
}

function mapClip(
  project: StudioProject,
  id: string,
  fn: (clip: VideoClip) => VideoClip,
): StudioProject {
  return { ...project, clips: project.clips.map((c) => (c.id === id ? fn(c) : c)) };
}

export function studioReducer(project: StudioProject, action: StudioAction): StudioProject {
  switch (action.type) {
    case "addClips": {
      const at = action.atIndex ?? project.clips.length;
      const clips = [...project.clips];
      clips.splice(at, 0, ...action.clips);
      return normalise({ ...project, clips });
    }

    case "deleteClip": {
      // Never leave the timeline with zero clips — an editor with nothing on the
      // track has no valid preview, no duration and no export.
      if (project.clips.length <= 1) return project;
      return normalise({
        ...project,
        clips: project.clips.filter((c) => c.id !== action.id),
        // Detached sound that belonged to this clip goes with it; leaving an
        // orphan chip playing over whatever slid into the gap is never wanted.
        audio: project.audio.filter((a) => a.linkedClipId !== action.id),
      });
    }

    case "duplicateClip": {
      const index = project.clips.findIndex((c) => c.id === action.id);
      if (index < 0) return project;
      const copy: VideoClip = { ...project.clips[index], id: uid("clip") };
      const clips = [...project.clips];
      clips.splice(index + 1, 0, copy);
      return normalise({ ...project, clips });
    }

    case "moveClip": {
      const index = project.clips.findIndex((c) => c.id === action.id);
      if (index < 0) return project;
      const to = Math.min(project.clips.length - 1, Math.max(0, index + action.delta));
      if (to === index) return project;
      const clips = [...project.clips];
      const [clip] = clips.splice(index, 1);
      clips.splice(to, 0, clip);
      return normalise({ ...project, clips });
    }

    case "reorderClip": {
      const index = project.clips.findIndex((c) => c.id === action.id);
      if (index < 0) return project;
      const to = Math.min(project.clips.length - 1, Math.max(0, action.toIndex));
      if (to === index) return project;
      const clips = [...project.clips];
      const [clip] = clips.splice(index, 1);
      clips.splice(to, 0, clip);
      return normalise({ ...project, clips });
    }

    case "splitAt": {
      const at = resolveAtTime(project.clips, action.time);
      if (!at) return project;
      const { clip, index, sourceTime } = at;
      // Both halves have to survive the minimum, or the split produces a sliver
      // that can't be trimmed, selected or exported.
      if (
        sourceTime - clip.inPoint < MIN_CLIP_DURATION ||
        clip.outPoint - sourceTime < MIN_CLIP_DURATION
      ) {
        return project;
      }
      const left: VideoClip = { ...clip, outPoint: sourceTime };
      const right: VideoClip = {
        ...clip,
        id: uid("clip"),
        inPoint: sourceTime,
        // The cut you just made is a hard cut until you choose otherwise.
        transitionIn: NO_TRANSITION,
      };
      const clips = [...project.clips];
      clips.splice(index, 1, left, right);
      return normalise({ ...project, clips });
    }

    case "trimClip": {
      return normalise(
        mapClip(project, action.id, (clip) => {
          let inPoint = action.inPoint ?? clip.inPoint;
          let outPoint = action.outPoint ?? clip.outPoint;
          if (action.inPoint !== undefined) {
            inPoint = Math.min(Math.max(0, inPoint), outPoint - MIN_CLIP_DURATION);
          }
          if (action.outPoint !== undefined) {
            outPoint = Math.max(outPoint, inPoint + MIN_CLIP_DURATION);
          }
          return { ...clip, inPoint, outPoint };
        }),
      );
    }

    case "setSpeed": {
      const speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, action.speed));
      const next = mapClip(project, action.id, (clip) => ({ ...clip, speed }));
      // Detached sound follows its clip, otherwise slowing the video silently
      // desyncs the audio you lifted off it.
      return normalise({
        ...next,
        audio: next.audio.map((a) => (a.linkedClipId === action.id ? { ...a, speed } : a)),
      });
    }

    case "setVolume":
      return mapClip(project, action.id, (clip) => ({
        ...clip,
        volume: Math.min(2, Math.max(0, action.volume)),
        muted: action.volume === 0 ? clip.muted : false,
      }));

    case "toggleClipMute":
      return mapClip(project, action.id, (clip) => ({ ...clip, muted: !clip.muted }));

    case "detachAudio": {
      const index = project.clips.findIndex((c) => c.id === action.id);
      if (index < 0) return project;
      const clip = project.clips[index];
      if (clip.audioDetached) return project;
      const start = clipStarts(project.clips)[index];
      const detached: AudioClip = {
        id: uid("audio"),
        sourceId: clip.sourceId,
        kind: "detached",
        label: "original",
        timelineStart: start,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
        speed: clip.speed,
        volume: clip.volume,
        muted: clip.muted,
        fadeIn: 0,
        fadeOut: 0,
        linkedClipId: clip.id,
      };
      return {
        ...mapClip(project, action.id, (c) => ({ ...c, audioDetached: true })),
        audio: [...project.audio, detached],
      };
    }

    case "reattachAudio": {
      const audio = project.audio.find((a) => a.id === action.audioId);
      if (!audio || audio.kind !== "detached" || !audio.linkedClipId) return project;
      return {
        ...mapClip(project, audio.linkedClipId, (c) => ({
          ...c,
          audioDetached: false,
          volume: audio.volume,
          muted: audio.muted,
        })),
        audio: project.audio.filter((a) => a.id !== action.audioId),
      };
    }

    case "setFilter":
      return action.all
        ? { ...project, clips: project.clips.map((c) => ({ ...c, filterId: action.filterId })) }
        : mapClip(project, action.id, (c) => ({ ...c, filterId: action.filterId }));

    case "setAdjustments":
      return action.all
        ? {
            ...project,
            clips: project.clips.map((c) => ({ ...c, adjustments: { ...action.adjustments } })),
          }
        : mapClip(project, action.id, (c) => ({ ...c, adjustments: { ...action.adjustments } }));

    case "setTransition": {
      const index = project.clips.findIndex((c) => c.id === action.id);
      if (index <= 0) return project; // nothing to transition from
      // A transition borrows half its window from each neighbour, so it can
      // never be longer than the shorter of the two clips it sits between.
      const budget =
        Math.min(clipDuration(project.clips[index - 1]), clipDuration(project.clips[index])) * 0.9;
      const duration = Math.min(action.transition.duration, Math.max(0, budget));
      return mapClip(project, action.id, (c) => ({
        ...c,
        transitionIn: duration <= 0 ? NO_TRANSITION : { ...action.transition, duration },
      }));
    }

    case "revealRamp": {
      // Oakmonte macro: the outfit reveal. Splits around the playhead and drops
      // the middle slice into slow motion, which is the shot everyone edits by
      // hand and nobody enjoys doing by hand.
      const at = resolveAtTime(project.clips, action.time);
      if (!at) return project;
      const { clip, index, sourceTime } = at;
      const half = (RAMP_WINDOW / 2) * clip.speed;
      const rampIn = Math.max(clip.inPoint, sourceTime - half);
      const rampOut = Math.min(clip.outPoint, sourceTime + half);
      if (rampOut - rampIn < MIN_CLIP_DURATION) return project;

      const parts: VideoClip[] = [];
      if (rampIn - clip.inPoint >= MIN_CLIP_DURATION) {
        parts.push({ ...clip, outPoint: rampIn });
      }
      parts.push({
        ...clip,
        id: uid("clip"),
        inPoint: rampIn,
        outPoint: rampOut,
        speed: RAMP_SPEED,
        transitionIn: parts.length ? NO_TRANSITION : clip.transitionIn,
      });
      if (clip.outPoint - rampOut >= MIN_CLIP_DURATION) {
        parts.push({ ...clip, id: uid("clip"), inPoint: rampOut, transitionIn: NO_TRANSITION });
      }
      if (parts.length < 2) return project;
      parts[0] = { ...parts[0], transitionIn: clip.transitionIn };

      const clips = [...project.clips];
      clips.splice(index, 1, ...parts);
      return normalise({ ...project, clips });
    }

    case "addAudio":
      return { ...project, audio: [...project.audio, action.clip] };

    case "updateAudio":
      return {
        ...project,
        audio: project.audio.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };

    case "deleteAudio":
      // Deleting a detached chip is how you silence a clip for good, so the clip
      // stays flagged detached — clearing the flag would resurrect the sound.
      return { ...project, audio: project.audio.filter((a) => a.id !== action.id) };

    case "addLayer":
      return { ...project, layers: [...project.layers, action.layer] };

    case "updateLayer":
      return {
        ...project,
        layers: project.layers.map((l) =>
          l.id === action.id ? ({ ...l, ...action.patch } as TimedLayer) : l,
        ),
      };

    case "deleteLayer":
      return { ...project, layers: project.layers.filter((l) => l.id !== action.id) };

    case "addPin":
      return { ...project, pins: [...project.pins, action.pin] };

    case "updatePin":
      return {
        ...project,
        pins: project.pins.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };

    case "deletePin":
      return { ...project, pins: project.pins.filter((p) => p.id !== action.id) };

    case "setAspect":
      return { ...project, aspectId: action.aspectId };

    case "setFitMode":
      return { ...project, fitMode: action.fitMode };

    case "setCoverTime":
      return { ...project, coverTime: Math.max(0, action.time) };

    case "toggleMasterMute":
      return { ...project, masterMuted: !project.masterMuted };

    default:
      return project;
  }
}

/** The slow slice a Reveal ramp carves out, and how slow it runs. */
export const RAMP_WINDOW = 0.7;
export const RAMP_SPEED = 0.4;

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 60;

type HistoryState = {
  past: StudioProject[];
  present: StudioProject;
  future: StudioProject[];
  /** While true, dispatches update `present` without pushing history. */
  grouping: boolean;
};

type HistoryAction =
  | { type: "do"; action: StudioAction }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "beginGroup" }
  | { type: "endGroup" };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "do": {
      const next = studioReducer(state.present, action.action);
      if (next === state.present) return state;
      if (state.grouping) return { ...state, present: next, future: [] };
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
        grouping: false,
      };
    }
    case "beginGroup":
      if (state.grouping) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: state.present,
        future: [],
        grouping: true,
      };
    case "endGroup": {
      if (!state.grouping) return state;
      // A group that changed nothing (a tap that never became a drag) shouldn't
      // leave a dead undo step behind.
      const previous = state.past[state.past.length - 1];
      if (previous === state.present) {
        return { ...state, past: state.past.slice(0, -1), grouping: false };
      }
      return { ...state, grouping: false };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
        grouping: false,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: next,
        future: rest,
        grouping: false,
      };
    }
    default:
      return state;
  }
}

export type StudioStore = {
  project: StudioProject;
  dispatch: (action: StudioAction) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Call on pointerdown of a drag; every dispatch until endHistoryGroup folds
   *  into a single undo step. */
  beginHistoryGroup: () => void;
  endHistoryGroup: () => void;
};

export function useStudioProject(initial: StudioProject): StudioStore {
  const [state, send] = useReducer(historyReducer, {
    past: [],
    present: initial,
    future: [],
    grouping: false,
  });

  const dispatch = useCallback((action: StudioAction) => send({ type: "do", action }), []);
  const undo = useCallback(() => send({ type: "undo" }), []);
  const redo = useCallback(() => send({ type: "redo" }), []);
  const beginHistoryGroup = useCallback(() => send({ type: "beginGroup" }), []);
  const endHistoryGroup = useCallback(() => send({ type: "endGroup" }), []);

  return {
    project: state.present,
    dispatch,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    beginHistoryGroup,
    endHistoryGroup,
  };
}
