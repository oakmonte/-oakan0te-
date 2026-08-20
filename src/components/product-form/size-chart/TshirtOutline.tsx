// Redrawn against a flat-sketch tech-pack reference (diagonal shoulder-to-cuff
// sleeves, scoop neckline with a ribbed collar band, straight torso). Only the
// two measurements this chart tracks (sleeve_length, body_length) get dimension
// lines — the reference also shows shoulder-width and chest, which aren't in
// size-chart-config.ts yet.
export function TshirtShortSleeveDiagram({
  activeKey,
  onSelectLine,
}: {
  activeKey?: string | null;
  onSelectLine?: (key: string) => void;
}) {
  const garment =
    "M160,80 Q175,105 200,108 Q225,105 240,80 " +
    "L340,170 L320,205 L255,160 L255,370 L145,370 L145,160 L80,205 L60,170 Z";
  const collarBand = "M170,88 Q182,102 200,105 Q218,102 230,88";

  return (
    <svg viewBox="0 0 420 420" className="w-full h-full" aria-hidden="true">
      <path d={garment} fill="white" stroke="#111827" strokeWidth={2.5} strokeLinejoin="round" />
      <path d={collarBand} stroke="#9CA3AF" strokeWidth={1.25} fill="none" />

      {/* Sleeve length: shoulder seam → sleeve cuff outer corner (right sleeve) */}
      <MeasurementLine
        active={activeKey === "sleeve_length"}
        onSelect={() => onSelectLine?.("sleeve_length")}
        dimension="M250,55 L350,145"
        ticks={["M242,50 L258,62", "M342,138 L358,150"]}
        leader="M300,100 L360,79"
        label={{ x: 362, y: 68, width: 52, height: 22, text: "Sleeve" }}
      />

      {/* Body length: neckline center → hem center */}
      <MeasurementLine
        active={activeKey === "body_length"}
        onSelect={() => onSelectLine?.("body_length")}
        dimension="M200,108 L200,370"
        ticks={["M192,108 L208,108", "M192,370 L208,370"]}
        leader="M200,239 L70,239"
        label={{ x: 10, y: 228, width: 50, height: 22, text: "Body" }}
      />
    </svg>
  );
}

function MeasurementLine({
  active,
  onSelect,
  dimension,
  ticks,
  leader,
  label,
}: {
  active: boolean;
  onSelect: () => void;
  dimension: string;
  ticks: string[];
  leader: string;
  label: { x: number; y: number; width: number; height: number; text: string };
}) {
  const color = active ? "#000000" : "#9CA3AF";
  return (
    <g onClick={onSelect} className="cursor-pointer">
      <path d={dimension} stroke={color} strokeWidth={active ? 2.5 : 2} fill="none" />
      {ticks.map((t, i) => (
        <path key={i} d={t} stroke={color} strokeWidth={active ? 2.5 : 2} />
      ))}
      <path
        d={leader}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeDasharray={active ? undefined : "3 3"}
      />
      <rect
        x={label.x}
        y={label.y}
        width={label.width}
        height={label.height}
        rx={11}
        fill={active ? "#111827" : "white"}
        stroke={color}
        strokeWidth={1.5}
      />
      <text
        x={label.x + label.width / 2}
        y={label.y + label.height / 2 + 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill={active ? "white" : "#374151"}
      >
        {label.text}
      </text>
    </g>
  );
}
