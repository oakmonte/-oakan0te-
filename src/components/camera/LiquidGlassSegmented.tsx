import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform, useVelocity } from "framer-motion";
import { GLASS_RIM, glassClear } from "@/lib/liquid-glass";

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

const PILL_PADDING = 4;
const TAB_VERTICAL_PADDING = 10;

// A segmented control for dark, full-bleed screens (the camera): white labels
// on clear glass, so the lens is a brighter piece of the same clear glass
// rather than the white glassLens the light navs use — white text on a white
// lens would vanish. The lens moves the way the other navs' lenses do: sprung,
// and stretched along its direction of travel by its own velocity.
const LENS: CSSProperties = {
  ...glassClear,
  background: "rgba(255,255,255,0.2)",
};

export default function LiquidGlassSegmented<T extends string>({
  options,
  value,
  onChange,
  tabWidth = 84,
  disabled = false,
  style,
}: LiquidGlassSegmentedProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const x = useMotionValue(activeIndex * tabWidth);
  const velocity = useVelocity(x);
  const scaleX = useTransform(velocity, [-1800, 0, 1800], [1.22, 1, 1.22]);
  const scaleY = useTransform(velocity, [-1800, 0, 1800], [0.88, 1, 0.88]);
  const first = useRef(true);
  useEffect(() => {
    const to = activeIndex * tabWidth;
    if (first.current) {
      first.current = false;
      x.jump(to);
      return;
    }
    const controls = animate(x, to, { type: "spring", stiffness: 420, damping: 32, mass: 0.9 });
    return () => controls.stop();
  }, [activeIndex, tabWidth, x]);

  return (
    <div
      className={`relative flex rounded-full ${GLASS_RIM}`}
      style={{
        ...glassClear,
        padding: PILL_PADDING,
        opacity: disabled ? 0.5 : 1,
        transition: "opacity 200ms ease-out",
        ...style,
      }}
    >
      <motion.div
        aria-hidden
        className={`rounded-full ${GLASS_RIM}`}
        style={{
          ...LENS,
          x,
          scaleX,
          scaleY,
          position: "absolute",
          top: PILL_PADDING,
          left: PILL_PADDING,
          width: tabWidth,
          height: `calc(100% - ${PILL_PADDING * 2}px)`,
          willChange: "transform",
        }}
      />
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={opt.value === value}
          onClick={() => !disabled && onChange(opt.value)}
          className="relative uppercase text-xs font-bold tracking-wide"
          style={{
            width: tabWidth,
            padding: `${TAB_VERTICAL_PADDING}px 0`,
            textAlign: "center",
            color: opt.value === value ? "#fff" : "rgba(255,255,255,0.7)",
            // Holds the labels' edges over a bright scene seen through the glass.
            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
            transition: "color 200ms ease-out",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
