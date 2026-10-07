import { expect, test } from "bun:test";
import { TIMELINE_HEIGHT, timelineLayout } from "./layout";

test("one lane of audio and text is the timeline the route reserves", () => {
  const { tracks, height } = timelineLayout({ audio: 0, text: 0, sticker: 0, pin: 0 });
  expect(tracks.map((t) => t.kind)).toEqual(["audio", "text"]);
  expect(height).toBe(TIMELINE_HEIGHT);
});

test("stickers and pins get rows once they exist, and lanes add height", () => {
  const { tracks, height } = timelineLayout({ audio: 2, text: 1, sticker: 1, pin: 1 });
  expect(tracks.map((t) => t.kind)).toEqual(["audio", "text", "sticker", "pin"]);
  expect(tracks[0].lanes).toBe(2);
  expect(tracks[1].top).toBe(tracks[0].top + tracks[0].height + 5);
  expect(height).toBeGreaterThan(TIMELINE_HEIGHT);
});
