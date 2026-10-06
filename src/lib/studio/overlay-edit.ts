// Split and duplicate for timed overlays — captions, stickers, drawings and
// product pins. Pure, so the rules are pinned by tests rather than by
// whichever panel happens to call them.

/** The shortest piece either half of a split may be. Matches the timeline's
 *  trim minimum, so a split can't make something too short to grab. */
export const MIN_PIECE = 0.3;

type Timed = { id: string; startTime: number; endTime: number; lane?: number };

/** Whether `at` is far enough inside the item for both halves to be usable. */
export function canSplitAt(item: Timed, at: number): boolean {
  return at - item.startTime >= MIN_PIECE && item.endTime - at >= MIN_PIECE;
}

/** The item cut in two at `at`: the original keeps its id and ends there,
 *  the new half starts there. Null when either half would be too short. */
export function splitAt<T extends Timed>(item: T, at: number, newId: string): [T, T] | null {
  if (!canSplitAt(item, at)) return null;
  return [
    { ...item, endTime: at },
    { ...item, id: newId, startTime: at },
  ];
}

/** A copy, placed straight after the original so it reads as "the same
 *  thing again" — the usual reason to duplicate a caption. When there's no
 *  room before `limit` (the end of the video), the copy goes at the same time
 *  and the lane packer puts it on the next lane. Lane is cleared so the
 *  packer chooses. */
export function duplicateAfter<T extends Timed>(item: T, newId: string, limit: number): T {
  const length = item.endTime - item.startTime;
  const room = limit - item.endTime;
  if (room < MIN_PIECE) return { ...item, id: newId, lane: undefined };
  return {
    ...item,
    id: newId,
    startTime: item.endTime,
    endTime: item.endTime + Math.min(length, room),
    lane: undefined,
  };
}
