import { describe, expect, test } from "bun:test";
import { canSplitAt, duplicateAfter, splitAt } from "./overlay-edit";

const caption = { id: "a", startTime: 2, endTime: 6, lane: 1, content: "Sale" };

describe("splitAt", () => {
  test("cuts in two, the original keeping its id", () => {
    expect(splitAt(caption, 4, "b")).toEqual([
      { ...caption, endTime: 4 },
      { ...caption, id: "b", startTime: 4 },
    ]);
  });

  test("refuses a cut that leaves a sliver", () => {
    expect(canSplitAt(caption, 2.1)).toBe(false);
    expect(splitAt(caption, 5.9, "b")).toBeNull();
    expect(splitAt(caption, 1, "b")).toBeNull();
  });
});

describe("duplicateAfter", () => {
  test("places the copy straight after, same length", () => {
    expect(duplicateAfter(caption, "b", 20)).toEqual({
      ...caption,
      id: "b",
      startTime: 6,
      endTime: 10,
      lane: undefined,
    });
  });

  test("shortens the copy to fit before the end of the video", () => {
    expect(duplicateAfter(caption, "b", 7).endTime).toBe(7);
  });

  test("no room after: same time, for the lane packer to stack", () => {
    const copy = duplicateAfter(caption, "b", 6);
    expect([copy.startTime, copy.endTime, copy.lane]).toEqual([2, 6, undefined]);
  });
});
