// A flat technical sketch rather than an icon: the gentle shoulder slope,
// curved sleeve seams and double-line crew neck mirror a real tee. Only the two
// measurements this chart tracks get interactive dimension lines.
export function TshirtShortSleeveDiagram({
  activeKey,
  onSelectLine,
}: {
  activeKey?: string | null;
  onSelectLine?: (key: string) => void;
}) {
  const garment =
    "M176 92 " +
    "C187 122 216 139 260 139 C304 139 333 122 344 92 " +
    "L456 145 L491 252 L419 279 " +
    "C411 281 404 282 398 282 L398 468 L122 468 L122 282 " +
    "C116 282 109 281 101 279 L29 252 L64 145 Z";
  const leftSleeveSeam = "M122 160 C134 195 134 242 122 282";
  const rightSleeveSeam = "M398 160 C386 195 386 242 398 282";
  const collarOuter = "M176 92 C187 122 216 139 260 139 C304 139 333 122 344 92";
  const collarInner = "M190 100 C201 119 224 128 260 128 C296 128 319 119 330 100";

  return (
    <svg viewBox="0 0 520 520" className="w-full h-full" aria-hidden="true">
      <path d={garment} fill="white" stroke="#111827" strokeWidth={2.5} strokeLinejoin="round" />
      <path d={leftSleeveSeam} stroke="#4B5563" strokeWidth={1.5} fill="none" />
      <path d={rightSleeveSeam} stroke="#4B5563" strokeWidth={1.5} fill="none" />
      <path d={collarOuter} stroke="#111827" strokeWidth={2.1} fill="none" />
      <path d={collarInner} stroke="#9CA3AF" strokeWidth={1.35} fill="none" />
      <path
        d="M42 250 L55 266 M478 250 L465 266 M124 455 L396 455"
        stroke="#D1D5DB"
        strokeWidth={1.25}
        strokeDasharray="2.5 3"
      />

      {/* Sleeve length: shoulder seam → sleeve cuff (left sleeve). */}
      <MeasurementLine
        active={activeKey === "sleeve_length"}
        onSelect={() => onSelectLine?.("sleeve_length")}
        dimension="M51 118 L16 233"
        ticks={["M43 115 L59 121", "M8 230 L24 236"]}
        leader="M34 175 L70 175"
        label={{ x: 4, y: 158, width: 64, height: 23, text: "Sleeve" }}
      />

      {/* Body length: collar centre → hem, shown externally like a tech pack. */}
      <MeasurementLine
        active={activeKey === "body_length"}
        onSelect={() => onSelectLine?.("body_length")}
        dimension="M476 132 L476 468"
        ticks={["M468 132 L484 132", "M468 468 L484 468"]}
        leader="M398 300 L476 300"
        label={{ x: 441, y: 288, width: 64, height: 23, text: "Body" }}
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
