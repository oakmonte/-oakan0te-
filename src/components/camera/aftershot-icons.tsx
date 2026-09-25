import type { SVGProps } from "react";

// Hand-rolled icons for the after-shot editor, for glyphs lucide doesn't have.
//
// They take the same props as a lucide icon (size, strokeWidth, className, and
// any other SVG attribute), so one can sit in the EDIT_TOOLS list in
// create.after-shot.index.tsx next to lucide's without a special case. The
// defaults match lucide's too — a 1.8 stroke here used to read visibly lighter
// than the 2px lucide glyphs it sat beside.
type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & {
  size?: number | string;
  strokeWidth?: number | string;
};

function IconBase({ size = 24, strokeWidth = 2, className, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative: every button that shows one carries its own aria-label.
      // Without these a screen reader announced an unnamed "image" inside the
      // button, and old Edge made the SVG itself a tab stop.
      aria-hidden
      focusable="false"
      className={`shrink-0 ${className ?? ""}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** A clip between two outward chevrons — "trim this". */
export function TrimIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="7" y="4" width="10" height="16" rx="3" />
      <path d="M4 9l-1.6 3L4 15" />
      <path d="M20 9l1.6 3L20 15" />
    </IconBase>
  );
}
