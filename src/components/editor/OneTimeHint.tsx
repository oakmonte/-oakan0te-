import { X } from "lucide-react";

// A tip for a gesture the screen can't otherwise show — hold to move a clip,
// pinch to zoom. Shown once per phone, then never again.
//
// It is a nudge, not documentation: nothing may depend on a person having read
// it. That is what lets it live in localStorage — a private tab or a fresh
// standalone install only means seeing it again.

export function HintBubble({
  children,
  onDismiss,
  className = "",
  style,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="status"
      className={`oak-motion-pop pointer-events-auto flex items-center gap-1 rounded-full bg-black/80 py-1 pl-3.5 pr-1 text-[12px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.45)] ${className}`}
      style={style}
    >
      <span>{children}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss tip"
        className="oak-hit flex h-6 w-6 items-center justify-center rounded-full text-white/70 active:scale-90"
      >
        <X size={13} />
      </button>
    </div>
  );
}
