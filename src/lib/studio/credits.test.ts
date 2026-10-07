import { describe, expect, test } from "bun:test";
import { combineCredits, creditsInMix } from "./credits";
import {
  NEUTRAL_ADJUSTMENTS,
  NO_TRANSITION,
  type AudioClip,
  type SourceMap,
  type StudioProject,
  type StudioSource,
} from "./types";

const song = { attribution: "Song — Artist (CC BY 4.0)", licence: "CC BY 4.0", sourceUrl: "a" };
const ping = { attribution: null, licence: "CC0", sourceUrl: "b" };

function source(id: string, credit?: StudioSource["credit"]): StudioSource {
  return {
    id,
    kind: "audio",
    blob: new Blob(),
    url: "",
    duration: 30,
    width: 0,
    height: 0,
    hasAudio: true,
    fps: 0,
    name: id,
    credit,
  };
}

function audio(
  id: string,
  sourceId: string,
  timelineStart: number,
  extra: Partial<AudioClip> = {},
) {
  return {
    id,
    sourceId,
    kind: "music",
    label: id,
    timelineStart,
    inPoint: 0,
    outPoint: 3,
    speed: 1,
    volume: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
    ...extra,
  } satisfies AudioClip;
}

// A ten-second video.
function project(clips: AudioClip[], masterMuted = false): StudioProject {
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
    audio: clips,
    layers: [],
    pins: [],
    aspectId: "9:16",
    fitMode: "fill",
    coverTime: 0,
    masterMuted,
  };
}

const sources: SourceMap = {
  song: source("song", song),
  ping: source("ping", ping),
  mine: source("mine"),
};

describe("creditsInMix", () => {
  test("credits each audible catalogue sound once, in timeline order", () => {
    const p = project([
      audio("p1", "ping", 4),
      audio("s", "song", 0),
      audio("p2", "ping", 6),
      audio("own", "mine", 1),
    ]);
    expect(creditsInMix(p, sources)).toEqual([song, ping]);
  });

  test("skips what isn't heard: muted, silent, past the end, master mute", () => {
    expect(creditsInMix(project([audio("s", "song", 0, { muted: true })]), sources)).toEqual([]);
    expect(creditsInMix(project([audio("s", "song", 0, { volume: 0 })]), sources)).toEqual([]);
    expect(creditsInMix(project([audio("s", "song", 12)]), sources)).toEqual([]);
    expect(creditsInMix(project([audio("s", "song", 0)], true), sources)).toEqual([]);
  });
});

describe("combineCredits", () => {
  test("none, one, several", () => {
    expect(combineCredits([])).toBeNull();
    expect(combineCredits([song])).toBe(song);
    expect(combineCredits([song, ping])).toEqual({
      attribution: "Song — Artist (CC BY 4.0)",
      licence: "CC BY 4.0 · CC0",
      sourceUrl: "a",
    });
  });
});
