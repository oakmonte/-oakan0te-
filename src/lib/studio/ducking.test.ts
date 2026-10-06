import { describe, expect, test } from "bun:test";
import { DUCK_LEVEL, DUCK_RAMP, duckAt, voiceSpans } from "./ducking";
import { NEUTRAL_ADJUSTMENTS, NO_TRANSITION, type AudioClip, type StudioProject } from "./types";

function audio(id: string, kind: AudioClip["kind"], start: number, length: number): AudioClip {
  return {
    id,
    sourceId: id,
    kind,
    label: id,
    timelineStart: start,
    inPoint: 0,
    outPoint: length,
    speed: 1,
    volume: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
  };
}

// A twenty-second video.
function project(clips: AudioClip[]): StudioProject {
  return {
    clips: [
      {
        id: "v",
        sourceId: "v",
        inPoint: 0,
        outPoint: 20,
        speed: 1,
        volume: 1,
        muted: false,
        audioDetached: false,
        filterId: "none",
        adjustments: NEUTRAL_ADJUSTMENTS,
        transitionIn: NO_TRANSITION,
      },
    ],
    audio: clips,
    layers: [],
    pins: [],
    aspectId: "9:16",
    fitMode: "fill",
    coverTime: 0,
    masterMuted: false,
  };
}

describe("voiceSpans", () => {
  test("only voiceovers, merged when they nearly touch, cut at the video's end", () => {
    const p = project([
      audio("m", "music", 0, 20),
      audio("v1", "voiceover", 2, 3),
      audio("v2", "voiceover", 5.2, 2),
      audio("v3", "voiceover", 18, 5),
    ]);
    expect(voiceSpans(p)).toEqual([
      [2, 7.2],
      [18, 20],
    ]);
  });
});

describe("duckAt", () => {
  const spans: [number, number][] = [[4, 8]];
  test("full clear of the voice, ducked under it, ramped either side", () => {
    expect(duckAt(spans, 1)).toBe(1);
    expect(duckAt(spans, 6)).toBe(DUCK_LEVEL);
    expect(duckAt(spans, 4 - DUCK_RAMP / 2)).toBeCloseTo((1 + DUCK_LEVEL) / 2);
    expect(duckAt(spans, 8 + DUCK_RAMP / 2)).toBeCloseTo((1 + DUCK_LEVEL) / 2);
    expect(duckAt(spans, 9)).toBe(1);
  });
});
