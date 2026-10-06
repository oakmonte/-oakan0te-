import { describe, expect, test } from "bun:test";
import { MAX_LANES, firstFreeLane, laneCount, packLanes, withLanes } from "./lanes";
import { studioReducer } from "./project";
import { TEXT_DEFAULTS, type StudioProject, type TimedLayer } from "./types";

// Overlapping captions, stickers, pins and sounds stack into lanes instead of
// drawing on top of each other. The lane is stored, so the rules that matter
// are about STABILITY: an item only moves when something actually collides
// with it, and adding a new item never shuffles the existing ones.

function text(id: string, startTime: number, endTime: number, lane?: number): TimedLayer {
  return {
    ...TEXT_DEFAULTS,
    id,
    kind: "text",
    content: id,
    startTime,
    endTime,
    lane,
  } as TimedLayer;
}

function sticker(id: string, startTime: number, endTime: number, lane?: number): TimedLayer {
  return {
    id,
    kind: "sticker",
    assetUrl: "x.png",
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    zIndex: 0,
    startTime,
    endTime,
    lane,
  } as TimedLayer;
}

function project(layers: TimedLayer[]): StudioProject {
  return {
    clips: [],
    audio: [],
    layers,
    pins: [],
    aspectId: "9:16",
    fitMode: "fill",
    coverTime: 0,
    masterMuted: false,
  };
}

describe("packLanes", () => {
  test("items that don't overlap share lane 0", () => {
    expect(
      packLanes([
        { start: 0, end: 2 },
        { start: 2, end: 4 },
        { start: 5, end: 6 },
      ]),
    ).toEqual([0, 0, 0]);
  });

  test("an overlapping item goes to the next free lane", () => {
    expect(
      packLanes([
        { start: 0, end: 4 },
        { start: 1, end: 3 },
        { start: 2, end: 5 },
      ]),
    ).toEqual([0, 1, 2]);
  });

  test("an item keeps its lane when nothing collides there", () => {
    expect(
      packLanes([
        { start: 0, end: 2, lane: 0 },
        { start: 5, end: 6, lane: 2 },
      ]),
    ).toEqual([0, 2]);
  });

  test("a new item never displaces one that already has a lane", () => {
    // The new caption starts earlier, but the placed one keeps lane 0.
    expect(
      packLanes([
        { start: 0, end: 5 },
        { start: 1, end: 3, lane: 0 },
      ]),
    ).toEqual([1, 0]);
  });

  test("past the lane cap, items share the last lane", () => {
    const spans = Array.from({ length: MAX_LANES + 2 }, () => ({ start: 0, end: 1 }));
    const lanes = packLanes(spans);
    expect(Math.max(...lanes)).toBe(MAX_LANES - 1);
  });

  test("firstFreeLane and laneCount", () => {
    expect(firstFreeLane([{ start: 0, end: 2, lane: 0 }], 1, 3)).toBe(1);
    expect(firstFreeLane([{ start: 0, end: 2, lane: 0 }], 2, 3)).toBe(0);
    expect(laneCount([])).toBe(0);
    expect(laneCount([{ lane: 0 }, { lane: 2 }, {}])).toBe(3);
  });
});

describe("withLanes", () => {
  test("text and stickers are packed as separate tracks", () => {
    const p = withLanes(project([text("a", 0, 3), sticker("s", 0, 3), text("b", 1, 2)]));
    const lane = (id: string) => p.layers.find((l) => l.id === id)?.lane;
    expect(lane("a")).toBe(0);
    expect(lane("b")).toBe(1);
    // Overlaps both captions in time, but on its own track.
    expect(lane("s")).toBe(0);
  });

  test("returns the same project when every lane is already right", () => {
    const p = withLanes(project([text("a", 0, 3), text("b", 1, 2)]));
    expect(withLanes(p)).toBe(p);
  });

  test("every reducer action leaves lanes resolved", () => {
    const start = withLanes(project([text("a", 0, 3)]));
    const next = studioReducer(start, { type: "addLayer", layer: text("b", 1, 2) });
    expect(next.layers.map((l) => l.lane)).toEqual([0, 1]);
    // Moving b clear of a lets it keep its lane; nothing else moves.
    const moved = studioReducer(next, {
      type: "updateLayer",
      id: "b",
      patch: { startTime: 4, endTime: 5 },
    });
    expect(moved.layers.map((l) => l.lane)).toEqual([0, 1]);
  });
});
