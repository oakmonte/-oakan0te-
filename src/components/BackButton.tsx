// The shared back affordance. Screens keep their own header markup and styling
// — this carries only the behaviour, which every one of them had been
// hand-rolling as a hardcoded navigate() that PUSHED a new history entry
// instead of popping one. See use-back.ts.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { useBack } from "@/hooks/use-back";
import type { NavTarget } from "@/lib/nav-hierarchy";
import { registerScreenBack } from "@/lib/screen-back";

type BackButtonProps = {
  /** Match whatever the screen already used. */
  icon?: "arrow" | "chevron" | "none";
  size?: number;
  /** The labelled-chevron look the store screens use ("Products", "Cancel"). */
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  /** For screens that must intervene first — the studio confirms before
   *  throwing away an unsaved edit. Called instead of navigating; call
   *  `back()` yourself once the user confirms. */
  onIntercept?: (back: () => void) => void;
  /** Override the hierarchy, for screens that know their own caller — the
   *  new-collection and new-location forms return to whichever product form
   *  opened them. Still pops if that screen is behind us. */
  to?: NavTarget;
  /** Render even at a root, where there is nothing above us. Off by default:
   *  a chevron that goes nowhere is worse than no chevron. */
  alwaysShow?: boolean;
};

export function BackButton({
  icon = "arrow",
  size = 22,
  label,
  className,
  style,
  ariaLabel = "Back",
  onIntercept,
  to,
  alwaysShow = false,
}: BackButtonProps) {
  const { back, canGoUp } = useBack(to);
  const shown = canGoUp || alwaysShow;

  const press = () => (onIntercept ? onIntercept(back) : back());
  // Latest closure in a ref, so registration happens once per mount rather
  // than on every render that passes a fresh inline onIntercept.
  const pressRef = useRef(press);
  pressRef.current = press;
  // Lets the edge swipe do what this button does. See screen-back.ts.
  useEffect(() => {
    if (!shown) return;
    return registerScreenBack(() => pressRef.current());
  }, [shown]);

  if (!shown) return null;

  return (
    <button
      type="button"
      onClick={press}
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {icon === "arrow" && <ArrowLeft size={size} />}
      {icon === "chevron" && <ChevronLeft size={size} />}
      {label}
    </button>
  );
}
