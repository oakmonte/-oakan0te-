import type { CSSProperties, ReactNode } from "react";

type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

type LiquidGlassSegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tabWidth?: number;
  disabled?: boolean;
  style?: CSSProperties;
};

// ── Tweak these while eyeballing on-device — every visual dimension routes
// through these five values, nothing else in the file needs to change. ──
const PILL_PADDING = 5; // outer padding between track edge and tabs
const TAB_VERTICAL_PADDING = 12; // ↑ raise this to make the whole pill taller
const TRACK_OPACITY = 0.28; // track background darkness (was ~0.45)
const TRACK_BORDER_OPACITY = 0.06; // track outline strength (was 0.08)
const INDICATOR_BORDER_OPACITY = 0.22; // indicator ring strength (was 0.35 — was reading as too thick/defined)

export default function LiquidGlassSegmented<T extends string>({
  options,
  value,
  onChange,
  tabWidth = 92,
  disabled = false,
  style,
}: LiquidGlassSegmentedProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        padding: PILL_PADDING,
        borderRadius: 999,
        // Track: lighter, warmer transparent gray — closer to the reference's
        // soft recessed look than a near-opaque dark base.
        background: `rgba(60,58,54,${TRACK_OPACITY})`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid rgba(255,255,255,${TRACK_BORDER_OPACITY})`,
        ...style,
      }}
    >
      {/* Sliding glass indicator — its own stronger blur + saturation/brightness
          boost, plus a soft (not heavy) specular ring, so it reads as a subtle
          lit surface rather than a hard-edged pill. */}
      <div
        style={{
          position: "absolute",
          top: PILL_PADDING,
          left: PILL_PADDING,
          width: tabWidth,
          height: `calc(100% - ${PILL_PADDING * 2}px)`,
          borderRadius: 999,
          background: "rgba(255,255,255,0.10)",
          backdropFilter: "blur(20px) saturate(160%) brightness(1.1)",
          WebkitBackdropFilter: "blur(20px) saturate(160%) brightness(1.1)",
          border: `1px solid rgba(255,255,255,${INDICATOR_BORDER_OPACITY})`,
          boxShadow:
            "inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -1px 2px rgba(0,0,0,0.18), 0 3px 10px rgba(0,0,0,0.28)",
          transform: `translateX(${activeIndex * tabWidth}px)`,
          transition: "transform 320ms cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(opt.value)}
          className="relative uppercase text-xs font-bold tracking-wide"
          style={{
            width: tabWidth,
            padding: `${TAB_VERTICAL_PADDING}px 0`,
            textAlign: "center",
            color: opt.value === value ? "#fff" : "rgba(255,255,255,0.6)",
            transition: "color 200ms ease-out",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
