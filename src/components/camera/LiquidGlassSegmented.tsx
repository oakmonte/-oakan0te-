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

const PILL_PADDING = 5;

export default function LiquidGlassSegmented<T extends string>({
  options,
  value,
  onChange,
  tabWidth = 92,
  disabled = false,
  style,
}: LiquidGlassSegmentedProps<T>) {
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        padding: PILL_PADDING,
        borderRadius: 999,
        // Track: dim, low-saturation glass — deliberately duller than the
        // indicator so it reads as recessed, with the indicator as the "real"
        // lit glass surface riding above it.
        background: "rgba(20,20,22,0.45)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      {/* Sliding glass indicator — its own stronger blur + saturation/brightness
          boost, plus inset specular highlights, so it reads as a curved lit
          surface rather than a flat color swap. */}
      <div
        style={{
          position: "absolute",
          top: PILL_PADDING,
          left: PILL_PADDING,
          width: tabWidth,
          height: `calc(100% - ${PILL_PADDING * 2}px)`,
          borderRadius: 999,
          background: "rgba(255,255,255,0.14)",
          backdropFilter: "blur(20px) saturate(180%) brightness(1.15)",
          WebkitBackdropFilter: "blur(20px) saturate(180%) brightness(1.15)",
          border: "1px solid rgba(255,255,255,0.35)",
          boxShadow:
            "inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -1px 2px rgba(0,0,0,0.25), 0 4px 14px rgba(0,0,0,0.35)",
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
            padding: "9px 0",
            textAlign: "center",
            color: opt.value === value ? "#000" : "rgba(255,255,255,0.7)",
            transition: "color 200ms ease-out",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}