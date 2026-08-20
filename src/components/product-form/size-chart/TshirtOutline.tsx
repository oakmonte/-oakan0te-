// Original line-art, not traced from any reference image. One SVG carries the
// garment silhouette, the two dimension lines drawn directly on the parts
// being measured, and the leader lines out to their labels — keeping
// everything in one coordinate space means it all stays aligned regardless
// of how large the diagram renders (percentage-based CSS overlays would
// drift against an SVG that scales by viewBox).
export function TshirtShortSleeveDiagram({
  activeKey,
  onSelectLine,
}: {
  activeKey?: string | null;
  onSelectLine?: (key: string) => void;
}) {
  const garment =
    "M110,350 L118,190 L58,196 L66,118 L96,100 L128,72 L150,58 Q160,48 170,58 " +
    "L192,72 L224,100 L254,118 L262,196 L202,190 L210,350 Z";

  return (
    <svg viewBox="0 0 320 380" className="w-full h-full" aria-hidden="true">
      <path d={garment} fill="white" stroke="#111827" strokeWidth={2.5} strokeLinejoin="round" />

      <MeasurementLine
        active={activeKey === "sleeve_length"}
        onSelect={() => onSelectLine?.("sleeve_length")}
        dimension="M200,75 L268,200"
        ticks={["M192,68 L208,82", "M260,193 L276,207"]}
        leader="M234,137 L246,90 L262,90"
        label={{ x: 264, y: 82, width: 44, height: 22, text: "Sleeve" }}
      />

      <MeasurementLine
        active={activeKey === "body_length"}
        onSelect={() => onSelectLine?.("body_length")}
        dimension="M140,64 L140,345"
        ticks={["M132,64 L148,64", "M132,345 L148,345"]}
        leader="M140,204 L100,204 L84,204"
        label={{ x: 14, y: 193, width: 44, height: 22, text: "Body" }}
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
