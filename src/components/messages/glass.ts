import type { CSSProperties } from "react";
import { glassDark } from "@/lib/liquid-glass";

/** Bottom-anchored dark glass (composer, filter sheet): the shared dark
 *  recipe, a touch denser because message text sits on it, with the drop
 *  shadow cast upward instead of down. */
export const glassPanel: CSSProperties = {
  ...glassDark,
  background: "rgba(24,26,30,0.66)",
  boxShadow: [
    "0 -18px 46px rgba(0,0,0,0.42)",
    "inset 0 1px 0.5px rgba(255,255,255,0.26)",
    "inset 0 0 14px rgba(255,255,255,0.05)",
  ].join(", "),
};

/** Floating dark glass (menus, reaction bar) — the shared recipe as is. Pair
 *  with GLASS_RIM on a positioned element. */
export const glassFloating: CSSProperties = glassDark;
