import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  formatBucketRange,
  formatDayKey,
  formatKobo,
  formatKoboCompact,
  type SalesBucket,
} from "@/lib/insights";
import { axisLabelIndexes, barLayout, roundedTopBarPath } from "@/lib/insights-chart";

const PLOT_HEIGHT = 136;
const TOP_PAD = 8; // room for the top tick label's ascenders
const X_AXIS_HEIGHT = 22;
const Y_LABEL_WIDTH = 46;
const PLOT_GAP = 6;

/** Sales per day (or per week on 90D) as columns, hand-drawn in SVG.
 *
 *  Tap a column to read it -- the readout sits ABOVE the plot rather than in a
 *  floating tooltip, because a tooltip over a 375px chart covers the very bars
 *  around the one being read. Arrow keys step through columns for keyboard
 *  users, and the same numbers are in a visually hidden table for screen
 *  readers, so nothing is reachable only by pointing.
 *
 *  Measured with a ResizeObserver rather than scaled through a viewBox: a
 *  viewBox scales the axis text along with the bars, so labels would grow on a
 *  tablet and shrink on a small phone. */
export function SalesChart({
  buckets,
  unit,
  dimmed = false,
}: {
  buckets: SalesBucket[];
  /** "day" or "week" -- for the hint and the table header. */
  unit: "day" | "week";
  /** While a different period is loading: keep this frame, faded, rather than
   *  flashing a skeleton and shifting the page. */
  dimmed?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotX = Y_LABEL_WIDTH + PLOT_GAP;
  const plotWidth = Math.max(0, width - plotX);
  const { bars, top } = barLayout(
    buckets.map((b) => b.revenueKobo),
    plotWidth,
    PLOT_HEIGHT,
  );
  const ticks = top > 0 ? [top, top / 2, 0] : [0];
  const svgHeight = TOP_PAD + PLOT_HEIGHT + X_AXIS_HEIGHT;
  const pick = selected !== null && selected < buckets.length ? buckets[selected] : null;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = buckets.length - 1;
    let next: number | null | undefined;
    if (e.key === "ArrowRight") next = selected === null ? 0 : Math.min(last, selected + 1);
    else if (e.key === "ArrowLeft") next = selected === null ? last : Math.max(0, selected - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === "Escape") next = null;
    if (next === undefined) return;
    e.preventDefault();
    setSelected(next);
  }

  return (
    <div className={`oak-motion-control ${dimmed ? "opacity-50" : ""}`}>
      {/* aria-live so stepping with the arrow keys announces each column. */}
      <p aria-live="polite" className="min-h-[20px] text-[13px] text-sd-ink-muted">
        {pick ? (
          <>
            <span className="font-semibold text-sd-ink">{formatKobo(pick.revenueKobo)}</span>
            {" · "}
            {formatBucketRange(pick)}
            {" · "}
            {pick.orders === 1 ? "1 order" : `${pick.orders} orders`}
          </>
        ) : (
          `Tap a bar to see that ${unit}.`
        )}
      </p>

      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-label={`Sales by ${unit}. Use the arrow keys to read each ${unit}.`}
        onKeyDown={onKeyDown}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setSelected(null);
        }}
        className="mt-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sd-focus"
      >
        {width > 0 && (
          <svg width={width} height={svgHeight} aria-hidden className="block select-none">
            {/* Gridlines and tick labels: hairline, solid, one step off the
                surface -- the bars are the only loud thing here. */}
            {ticks.map((t) => {
              const y = TOP_PAD + PLOT_HEIGHT - (top > 0 ? (t / top) * PLOT_HEIGHT : 0);
              return (
                <g key={t}>
                  <line
                    x1={plotX}
                    x2={width}
                    y1={y}
                    y2={y}
                    strokeWidth={1}
                    className="stroke-sd-chart-grid"
                  />
                  <text
                    x={Y_LABEL_WIDTH}
                    y={y}
                    dy="0.32em"
                    textAnchor="end"
                    className="fill-sd-ink-muted text-[11px] tabular-nums"
                  >
                    {formatKoboCompact(t)}
                  </text>
                </g>
              );
            })}

            <g transform={`translate(${plotX} ${TOP_PAD})`}>
              {selected !== null && bars[selected] && (
                <rect
                  x={bars[selected].slotX}
                  y={0}
                  width={bars[selected].slotWidth}
                  height={PLOT_HEIGHT}
                  rx={4}
                  fill="var(--sd-chart-cursor)"
                />
              )}
              {bars.map((b, i) => (
                <path
                  key={i}
                  d={roundedTopBarPath(b)}
                  className="fill-sd-chart-line"
                  opacity={selected === null || selected === i ? 1 : 0.35}
                />
              ))}
              {/* Hit targets: the full column, not the painted bar. */}
              {bars.map((b, i) => (
                <rect
                  key={`hit-${i}`}
                  x={b.slotX}
                  y={0}
                  width={b.slotWidth}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                  onClick={() => setSelected((s) => (s === i ? null : i))}
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setSelected(i);
                  }}
                />
              ))}
            </g>

            {axisLabelIndexes(bars.length).map((i, k, all) => (
              <text
                key={i}
                x={plotX + (k === all.length - 1 && all.length > 1 ? plotWidth : bars[i].cx)}
                y={TOP_PAD + PLOT_HEIGHT + 16}
                // The last label hangs off the right edge if centred under a
                // narrow end column, so it right-aligns to the plot instead.
                textAnchor={k === all.length - 1 && all.length > 1 ? "end" : "middle"}
                className="fill-sd-ink-muted text-[11px]"
              >
                {formatDayKey(buckets[i].start)}
              </text>
            ))}
          </svg>
        )}
        {width === 0 && <div style={{ height: svgHeight }} />}
      </div>

      <table className="sr-only">
        <caption>Sales by {unit}</caption>
        <thead>
          <tr>
            <th scope="col">{unit === "day" ? "Day" : "Week"}</th>
            <th scope="col">Sales</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.start}>
              <th scope="row">{formatBucketRange(b)}</th>
              <td>{formatKobo(b.revenueKobo)}</td>
              <td>{b.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
