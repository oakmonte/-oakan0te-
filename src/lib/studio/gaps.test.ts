import { describe, expect, test } from "bun:test";
import { studioReducer } from "./project";
import { transitionStateAt } from "./render";
import {
  NEUTRAL_ADJUSTMENTS,
  NO_TRANSITION,
  clipStarts,
  resolveAtTime,
  videoDuration,
  type StudioProject,
  type VideoClip,
} from "./types";

// Gaps between clips: slide a clip away from its neighbour (usually after a
// split) and the space between them is black in the finished video. These are
// the rules the preview, the playback clock and the exporter all read, so a
// regression here shows up as a video that is the wrong length or out of sync.

function clip(id: string, seconds: number, gapBefore?: number): VideoClip {
  return {
    id,
    sourceId: "src",
    inPoint: 0,
    outPoint: seconds,
    speed: 1,
    volume: 1,
    muted: false,
    audioDetached: false,
    filterId: "none",
    adjustments: NEUTRAL_ADJUSTMENTS,
    transitionIn: NO_TRANSITION,
    gapBefore,
  };
}

function project(clips: VideoClip[]): StudioProject {
  return {
    clips,
    audio: [],
    layers: [],
    pins: [],
    aspectId: "9:16",
    fitMode: "fill",
    coverTime: 0,
    masterMuted: false,
  };
}

describe("timeline geometry with gaps", () => {
  test("a gap pushes every later clip along and counts towards the length", () => {
    const clips = [clip("a", 2), clip("b", 3, 1.5), clip("c", 1)];
    expect(clipStarts(clips)).toEqual([0, 3.5, 6.5]);
    expect(videoDuration(clips)).toBe(7.5);
  });

  test("the playhead inside a gap resolves to the next clip, flagged as a gap", () => {
    const clips = [clip("a", 2), clip("b", 3, 1)];
    const at = resolveAtTime(clips, 2.5);
    expect(at?.inGap).toBe(true);
    expect(at?.clip.id).toBe("b");
    expect(resolveAtTime(clips, 1)?.inGap).toBe(false);
    expect(resolveAtTime(clips, 3.2)?.inGap).toBe(false);
  });

  test("no transition renders across a gap", () => {
    const b = { ...clip("b", 3, 1), transitionIn: { kind: "dissolve" as const, duration: 0.4 } };
    expect(transitionStateAt([clip("a", 2), b], 3)).toBeNull();
  });
});

describe("sliding clips", () => {
  test("the last clip can be pulled away, leaving black in front of it", () => {
    const p = studioReducer(project([clip("a", 2), clip("b", 2)]), {
      type: "slideClip",
      id: "b",
      gapBefore: 1.5,
    });
    expect(clipStarts(p.clips)).toEqual([0, 3.5]);
  });

  test("a middle clip only moves within its free space, and the clip after it stays put", () => {
    const start = project([clip("a", 2), clip("b", 2, 1), clip("c", 2, 1)]);
    const before = clipStarts(start.clips)[2];
    const p = studioReducer(start, { type: "slideClip", id: "b", gapBefore: 10 });
    // Its own gap plus the next one's is all the room there is.
    expect(p.clips[1].gapBefore).toBe(2);
    expect(p.clips[2].gapBefore).toBeUndefined();
    expect(clipStarts(p.clips)[2]).toBe(before);
  });

  test("the first clip never gets a gap", () => {
    const p = studioReducer(project([clip("a", 2), clip("b", 2)]), {
      type: "slideClip",
      id: "a",
      gapBefore: 1,
    });
    expect(p.clips[0].gapBefore).toBeUndefined();
  });

  test("a sliver of a gap snaps shut", () => {
    const p = studioReducer(project([clip("a", 2), clip("b", 2)]), {
      type: "slideClip",
      id: "b",
      gapBefore: 0.01,
    });
    expect(p.clips[1].gapBefore).toBeUndefined();
  });

  test("closing a gap pulls the clip back against its neighbour", () => {
    const p = studioReducer(project([clip("a", 2), clip("b", 2, 1)]), {
      type: "closeGap",
      id: "b",
    });
    expect(clipStarts(p.clips)).toEqual([0, 2]);
  });

  test("a clip given a gap loses its incoming transition", () => {
    const b = { ...clip("b", 2), transitionIn: { kind: "dissolve" as const, duration: 0.4 } };
    const p = studioReducer(project([clip("a", 2), b]), {
      type: "slideClip",
      id: "b",
      gapBefore: 1,
    });
    expect(p.clips[1].transitionIn.kind).toBe("none");
  });
});

describe("other edits around gaps", () => {
  test("splitting inside a gap does nothing", () => {
    const start = project([clip("a", 2), clip("b", 3, 1)]);
    expect(studioReducer(start, { type: "splitAt", time: 2.5 })).toBe(start);
  });

  test("splitting a clip that has a gap keeps the gap in front of the left half only", () => {
    const p = studioReducer(project([clip("a", 2), clip("b", 3, 1)]), {
      type: "splitAt",
      time: 4,
    });
    expect(p.clips.map((c) => c.gapBefore ?? 0)).toEqual([0, 1, 0]);
    expect(videoDuration(p.clips)).toBe(6);
  });

  test("reordering moves clips, not the empty space between them", () => {
    const p = studioReducer(project([clip("a", 2), clip("b", 2, 1), clip("c", 2)]), {
      type: "reorderClip",
      id: "c",
      toIndex: 1,
    });
    expect(p.clips.map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(p.clips.map((c) => c.gapBefore ?? 0)).toEqual([0, 1, 0]);
  });

  test("a duplicate sits right after the original, with no gap of its own", () => {
    const p = studioReducer(project([clip("a", 2), clip("b", 2, 1)]), {
      type: "duplicateClip",
      id: "b",
    });
    expect(p.clips[2].gapBefore).toBeUndefined();
  });
});
