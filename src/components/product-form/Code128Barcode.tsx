import { encodeCode128B } from "@/lib/code128";

/** Renders a real, scannable Code 128 barcode as inline SVG bars, plus the
 *  human-readable value underneath (same convention as a printed barcode
 *  label). Purely a preview -- nothing here uploads or persists an image,
 *  the barcode is regenerated from the stored text value every render. */
export function Code128Barcode({ value, className = "" }: { value: string; className?: string }) {
  const modules = encodeCode128B(value);
  if (!modules) return null;

  const moduleWidth = 2;
  const height = 50;

  // Collapse consecutive same-type modules into single rects so the SVG
  // stays small instead of one <rect> per module.
  const runs: { isBar: boolean; length: number }[] = [];
  for (const ch of modules) {
    const isBar = ch === "1";
    const last = runs[runs.length - 1];
    if (last && last.isBar === isBar) last.length += 1;
    else runs.push({ isBar, length: 1 });
  }

  let x = 0;
  const bars: { x: number; width: number }[] = [];
  for (const run of runs) {
    const width = run.length * moduleWidth;
    if (run.isBar) bars.push({ x, width });
    x += width;
  }
  const totalWidth = x;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Barcode ${value}`}
      >
        <rect x={0} y={0} width={totalWidth} height={height} fill="white" />
        {bars.map((bar, i) => (
          <rect key={i} x={bar.x} y={0} width={bar.width} height={height} fill="black" />
        ))}
      </svg>
      <p className="text-center text-xs text-gray-500 tracking-widest mt-1 font-mono">{value}</p>
    </div>
  );
}
