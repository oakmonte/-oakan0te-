import { useMemo } from "react";
import { encodeQr, qrPath } from "@/lib/qr-code";

const MARGIN = 4;

/** A scannable QR code as one SVG path.
 *
 *  Fixed black-on-white rather than --sd-* tokens, on purpose: in dark mode
 *  the tokens would invert it, and an inverted code is exactly the kind a
 *  cheap phone's scanner refuses. The white plate includes the four-module
 *  quiet zone the spec requires. */
export function QrCode({ value, size = 168, label }: { value: string; size?: number; label: string }) {
  const matrix = useMemo(() => encodeQr(value, "M"), [value]);
  const total = matrix.size + MARGIN * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className="block rounded-xl"
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={qrPath(matrix, MARGIN)} fill="#000000" />
    </svg>
  );
}
