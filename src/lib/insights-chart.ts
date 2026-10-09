import { niceCeil } from "@/lib/insights";

// Geometry for the hand-rolled sales bar chart, kept apart from the component
// so the arithmetic can be tested without rendering anything. No charting
// library: recharts is in package.json but would put ~100KB into the dashboard
// chunk for one bar chart, on the screen sellers open most on slow data.

export type BarGeometry = {
  /** The bar itself. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The whole column the bar sits in -- the tap target, deliberately far
   *  bigger than an 8px-wide bar on a 30-day chart. */
  slotX: number;
  slotWidth: number;
  /** Horizontal centre, for labels and the tooltip. */
  cx: number;
};

export const MAX_BAR_WIDTH = 24;
/** A surface-coloured gap between neighbours, so 30 adjacent bars read as 30. */
export const BAR_GAP = 2;
/** A sale too small to register at the chart's scale is still drawn this tall:
 *  a day with one order must never look identical to a day with none. */
export const MIN_VISIBLE_BAR = 2;

export function barLayout(
  values: number[],
  plotWidth: number,
  plotHeight: number,
): { bars: BarGeometry[]; top: number } {
  const n = values.length;
  const top = niceCeil(Math.max(0, ...values));
  if (n === 0 || plotWidth <= 0) return { bars: [], top };
  const slot = plotWidth / n;
  const width = Math.max(1, Math.min(MAX_BAR_WIDTH, slot - BAR_GAP));
  const bars = values.map((v, i) => {
    const slotX = i * slot;
    const cx = slotX + slot / 2;
    const scaled = top > 0 ? (v / top) * plotHeight : 0;
    const height = v > 0 ? Math.max(MIN_VISIBLE_BAR, scaled) : 0;
    return { x: cx - width / 2, y: plotHeight - height, width, height, slotX, slotWidth: slot, cx };
  });
  return { bars, top };
}

/** A bar with a 4px rounded data end and a square foot on the baseline. Empty
 *  string for a zero bar, which draws nothing rather than a sliver. */
export function roundedTopBarPath(b: Pick<BarGeometry, "x" | "y" | "width" | "height">): string {
  if (b.height <= 0 || b.width <= 0) return "";
  const r = Math.min(4, b.width / 2, b.height);
  const right = b.x + b.width;
  const bottom = b.y + b.height;
  return [
    `M${b.x},${bottom}`,
    `V${b.y + r}`,
    `A${r},${r} 0 0 1 ${b.x + r},${b.y}`,
    `H${right - r}`,
    `A${r},${r} 0 0 1 ${right},${b.y + r}`,
    `V${bottom}`,
    "Z",
  ].join("");
}

/** Which buckets get a date under them: the first, the last, and the middle,
 *  so the axis is readable at 30 bars without colliding labels. */
export function axisLabelIndexes(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 2) return Array.from({ length: n }, (_, i) => i);
  return [0, Math.floor((n - 1) / 2), n - 1];
}
