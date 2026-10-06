// Lanes: the rows inside one timeline track.
//
// Two captions on screen at once, or music under a sound effect, used to draw
// on top of each other in a single row — the second hid the first and there
// was no way to tap the one underneath. Each track now stacks overlapping
// items into lanes, like every desktop editor does.
//
// The lane is STORED on the item, not computed at render. Packed fresh on
// every render, a chip would jump rows mid-drag the moment it brushed a
// neighbour; stored, an item stays where it is and only moves when it
// actually collides with something. `packLanes` runs after every reducer
// action (see project.ts) and is the only thing that writes `lane`.

import type { AudioClip, ProductPin, StudioProject, TimedLayer } from "./types";
import { audioDuration } from "./types";

/** Lanes per track. Past this, items share the last lane rather than the
 *  track growing taller than the screen. */
export const MAX_LANES = 4;

/** Edges this close count as touching, not overlapping — an item butted up
 *  against the next shouldn't be pushed into a new lane. */
const EPS = 1e-3;

type Span = { start: number; end: number };

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end - EPS && b.start < a.end - EPS;
}

/** The lowest lane with nothing overlapping [start, end), or the last lane
 *  when every one is taken. */
export function firstFreeLane(
  placed: (Span & { lane: number })[],
  start: number,
  end: number,
  max = MAX_LANES,
): number {
  const span = { start, end };
  for (let lane = 0; lane < max; lane++) {
    if (!placed.some((p) => p.lane === lane && overlaps(p, span))) return lane;
  }
  return max - 1;
}

/** A lane for every item, in input order.
 *
 *  Items that already have a lane keep it unless something placed before them
 *  overlaps there; new items (no lane yet) go in after every placed one, into
 *  the lowest free lane. So adding a caption never shuffles the ones already
 *  on the timeline. */
export function packLanes(items: (Span & { lane?: number })[], max = MAX_LANES): number[] {
  const order = items
    .map((_, i) => i)
    .sort((a, b) => Number(items[a].lane === undefined) - Number(items[b].lane === undefined));
  const placed: (Span & { lane: number })[] = [];
  const lanes = new Array<number>(items.length);
  for (const i of order) {
    const item = items[i];
    const want = Math.min(max - 1, Math.max(0, Math.round(item.lane ?? 0)));
    const free =
      item.lane !== undefined && !placed.some((p) => p.lane === want && overlaps(p, item));
    const lane = free ? want : firstFreeLane(placed, item.start, item.end, max);
    placed.push({ start: item.start, end: item.end, lane });
    lanes[i] = lane;
  }
  return lanes;
}

/** How many lanes a track needs to show every item: one past the highest. */
export function laneCount(items: { lane?: number }[]): number {
  return items.reduce((n, item) => Math.max(n, (item.lane ?? 0) + 1), 0);
}

/** Overlay tracks, by what's on them. Draw layers ride with stickers — both
 *  are pictures on the frame, and neither has words to show on a chip. */
export function isTextLayer(layer: TimedLayer): boolean {
  return layer.kind === "text";
}

function relane<T extends { lane?: number }>(
  items: T[],
  span: (item: T) => Span,
  include: (item: T) => boolean = () => true,
): T[] {
  const picked = items.filter(include);
  if (picked.length === 0) return items;
  const lanes = packLanes(picked.map((item) => ({ ...span(item), lane: item.lane })));
  const byItem = new Map(picked.map((item, i) => [item, lanes[i]]));
  let changed = false;
  const next = items.map((item) => {
    const lane = byItem.get(item);
    if (lane === undefined || lane === item.lane) return item;
    changed = true;
    return { ...item, lane };
  });
  return changed ? next : items;
}

const audioSpan = (a: AudioClip): Span => ({
  start: a.timelineStart,
  end: a.timelineStart + audioDuration(a),
});
const layerSpan = (l: TimedLayer): Span => ({ start: l.startTime, end: l.endTime });
const pinSpan = (p: ProductPin): Span => ({ start: p.startTime, end: p.endTime });

/** Give every audio clip, overlay and pin a lane that doesn't collide.
 *  Returns the same project object when nothing had to move. */
export function withLanes(project: StudioProject): StudioProject {
  const audio = relane(project.audio, audioSpan);
  const text = relane(project.layers, layerSpan, isTextLayer);
  const layers = relane(text, layerSpan, (l) => !isTextLayer(l));
  const pins = relane(project.pins, pinSpan);
  if (audio === project.audio && layers === project.layers && pins === project.pins) {
    return project;
  }
  return { ...project, audio, layers, pins };
}
