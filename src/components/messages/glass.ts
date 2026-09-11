import type { CSSProperties } from "react";

/** The same liquid-glass treatment the floating BottomNav uses, on a dark surface. */
export const glassPanel: CSSProperties = {
  background: "rgba(28,30,34,0.62)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow:
    "0 -18px 46px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 3px rgba(0,0,0,0.25)",
  backdropFilter: "blur(30px) saturate(195%)",
  WebkitBackdropFilter: "blur(30px) saturate(195%)",
};

export const glassFloating: CSSProperties = {
  background: "rgba(38,40,45,0.72)",
  border: "1px solid rgba(255,255,255,0.16)",
  boxShadow:
    "0 18px 46px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.26)",
  backdropFilter: "blur(30px) saturate(195%)",
  WebkitBackdropFilter: "blur(30px) saturate(195%)",
};
