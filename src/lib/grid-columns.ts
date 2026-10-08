import { useSyncExternalStore } from "react";

// Columns: 2 on a phone, 3 once there's room (a tablet held upright), 4 on
// landscape tablets and laptops. The masonry needs the count in JS (each column
// is its own stack), so these queries mirror GRID_COLS, which the CSS-only
// loading skeleton and the Shop grid use for the same breakpoints.
const FOUR_COLS = "(min-width: 1024px), (orientation: landscape) and (min-width: 768px)";
const THREE_COLS = "(min-width: 600px)";
export const GRID_COLS =
  "grid-cols-2 min-[600px]:grid-cols-3 landscape:min-[768px]:grid-cols-4 min-[1024px]:grid-cols-4";

function readColumnCount() {
  if (typeof window === "undefined") return 2;
  if (window.matchMedia(FOUR_COLS).matches) return 4;
  if (window.matchMedia(THREE_COLS).matches) return 3;
  return 2;
}

export function useColumnCount() {
  return useSyncExternalStore(
    (onChange) => {
      const lists = [FOUR_COLS, THREE_COLS].map((q) => window.matchMedia(q));
      lists.forEach((l) => l.addEventListener("change", onChange));
      return () => lists.forEach((l) => l.removeEventListener("change", onChange));
    },
    readColumnCount,
    () => 2,
  );
}
