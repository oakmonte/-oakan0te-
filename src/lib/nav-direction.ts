// Which way the current navigation is going, exposed to CSS as a data
// attribute on <html> so view transitions can slide the right way.
//
// A data attribute rather than View Transition `types`: TanStack supports
// passing types through to startViewTransition, but a history.go() pop does
// not route through navigate(), so half our back navigations would miss it.
// The attribute covers both paths and degrades to "no transition" on browsers
// without view transitions at all.
export type NavDirection = "forward" | "back";

export function setNavDirection(direction: NavDirection) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.navDir = direction;
}
