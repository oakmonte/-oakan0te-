import type { DrawStroke } from "@/lib/after-shot-layers";

// One stroke, in raw px (points are width-fractions, `scale` is the media box
// width). Shared by the live draw surface and the placed layer so a dot looks
// the same before and after confirming — and matches drawDrawLayer's bake.
//
// A one-point stroke is a dot and renders as a filled circle. A one-point
// polyline paints nothing, and a zero-length one with a round cap is painted
// by some engines and skipped by others (WebKit has been inconsistent), so
// neither can be trusted to show a tap.
export function StrokeShape({ stroke, scale }: { stroke: DrawStroke; scale: number }) {
  const px = stroke.width * scale;
  const glow = stroke.glow
    ? { filter: `drop-shadow(0 0 ${px * 0.9}px ${stroke.color})` }
    : undefined;

  if (stroke.points.length === 1) {
    const [x, y] = stroke.points[0];
    return <circle cx={x * scale} cy={y * scale} r={px / 2} fill={stroke.color} style={glow} />;
  }

  return (
    <polyline
      points={stroke.points.map(([x, y]) => `${x * scale},${y * scale}`).join(" ")}
      fill="none"
      stroke={stroke.color}
      strokeWidth={px}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={glow}
    />
  );
}
