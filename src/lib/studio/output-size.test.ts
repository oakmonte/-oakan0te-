import { describe, expect, test } from "bun:test";
import { outputSize } from "./export";
import { NEUTRAL_ADJUSTMENTS, NO_TRANSITION, type SourceMap, type StudioProject } from "./types";

// One 1080x1920 clip on a 9:16 or 16:9 canvas.
function project(aspectId: string): StudioProject {
  return {
    clips: [
      {
        id: "v",
        sourceId: "video",
        inPoint: 0,
        outPoint: 10,
        speed: 1,
        volume: 1,
        muted: false,
        audioDetached: false,
        filterId: "none",
        adjustments: NEUTRAL_ADJUSTMENTS,
        transitionIn: NO_TRANSITION,
      },
    ],
    audio: [],
    layers: [],
    pins: [],
    aspectId,
    fitMode: "fill",
    coverTime: 0,
    masterMuted: false,
  };
}

const sources: SourceMap = {
  video: {
    id: "video",
    kind: "video",
    blob: new Blob(),
    url: "",
    duration: 10,
    width: 1080,
    height: 1920,
    hasAudio: true,
    fps: 30,
    name: "clip",
  },
};

describe("outputSize", () => {
  test("first try: 720p on the long edge", () => {
    expect(outputSize(project("9:16"), sources)).toEqual({ width: 720, height: 1280 });
  });

  test("the retry after a failed encode is smaller, and still even", () => {
    const { width, height } = outputSize(project("9:16"), sources, 854);
    expect(height).toBe(854);
    expect(width).toBeLessThan(720);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });

  test("the retry cap applies to landscape too", () => {
    const { width, height } = outputSize(project("16:9"), sources, 854);
    expect(width).toBe(854);
    expect(height % 2).toBe(0);
  });
});
