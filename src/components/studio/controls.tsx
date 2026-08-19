import type { ReactNode } from "react";
import { Check, RotateCcw } from "lucide-react";

// Shared chrome for the studio's bottom region.
//
// A studio panel is NOT a modal. CameraPanel dims the whole screen because the
// camera has nothing to look at while you pick a flash mode; here the picture and
// the timeline ARE the feedback for every control, so a panel replaces the
// toolbar in place and leaves everything above it live and scrubable.

export function StudioSheet({
  title,
  onDone,
  onReset,
  children,
  footer,
}: {
  title: string;
  onDone: () => void;
  onReset?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="border-t border-white/10" style={{ background: "#0B0B0B" }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[13px] font-semibold tracking-wide">{title}</span>
        <div className="flex items-center gap-1">
          {onReset && (
            <button
              onClick={onReset}
              aria-label={`Reset ${title.toLowerCase()}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 active:scale-90"
            >
              <RotateCcw size={16} />
            </button>
          )}
          <button
            onClick={onDone}
            aria-label="Done"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black active:scale-90"
          >
            <Check size={17} />
          </button>
        </div>
      </div>
      <div className="px-4 pb-1">{children}</div>
      {footer}
    </div>
  );
}

export function StudioSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  onCommitStart,
  onCommitEnd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
  onCommitStart?: () => void;
  onCommitEnd?: () => void;
}) {
  return (
    <label className="block py-1.5">
      <span className="mb-1 flex items-center justify-between text-[11px] text-white/60">
        <span>{label}</span>
        <span className="tabular-nums text-white/85">
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix ?? ""}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        // A drag is one undo step, not one per pixel — see beginHistoryGroup.
        onPointerDown={onCommitStart}
        onPointerUp={onCommitEnd}
        onPointerCancel={onCommitEnd}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
        style={{ touchAction: "none" }}
      />
    </label>
  );
}

export function Pill({
  active,
  onClick,
  children,
  disabled,
  tone = "neutral",
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-transform active:scale-95 disabled:opacity-35"
      style={{
        background: active ? "#fff" : "rgba(255,255,255,0.10)",
        color: active ? "#000" : tone === "danger" ? "#FF7A7A" : "#fff",
      }}
    >
      {children}
    </button>
  );
}

export function ToolButton({
  label,
  icon,
  onClick,
  disabled,
  tone = "neutral",
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-[58px] w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl transition-transform active:scale-95 disabled:opacity-30"
      style={{
        background: "rgba(255,255,255,0.07)",
        color: tone === "danger" ? "#FF7A7A" : "#fff",
      }}
    >
      {icon}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-[12px] text-white/45">{children}</p>;
}
