// Is this the installed app, or a browser tab?
//
// The two need to behave differently in ways that have nothing to do with
// screen size, so no media query for width can answer it:
//
//   - the installed app must never show the marketing landing page; someone
//     who installed it has already decided
//   - there is no browser toolbar along the bottom, so chrome that sits
//     comfortably above one in Safari sits almost on the home indicator here
//   - it has its own storage jar, so it starts signed out even when Safari is
//     signed in
//
// Two signals, because neither covers everything. `display-mode: standalone`
// is the standard and is what Android and desktop report. iOS only started
// answering that media query reliably in recent versions, and has always set
// the non-standard `navigator.standalone` — so both are checked and either one
// counts.

type IosNavigator = Navigator & { standalone?: boolean };

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if ((navigator as IosNavigator).standalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

/** Stamp the answer onto `<html>` so CSS can respond to it.
 *
 *  `env(safe-area-inset-bottom)` does NOT distinguish these two: it reports
 *  the home indicator in both cases and says nothing about Safari's toolbar,
 *  which occupies real estate above it without being an inset. That is why
 *  bottom chrome tuned against Safari ends up sitting too low once installed —
 *  the toolbar it was visually resting on is gone.
 *
 *  Returns nothing and is safe to call repeatedly; the app calls it on mount
 *  and again whenever the display mode changes, which happens on desktop when
 *  a tab is installed while open. */
export function markStandalone(): () => void {
  if (typeof document === "undefined") return () => {};

  const apply = () => {
    document.documentElement.dataset.standalone = isStandalone() ? "true" : "false";
  };
  apply();

  const query = window.matchMedia?.("(display-mode: standalone)");
  query?.addEventListener("change", apply);
  return () => query?.removeEventListener("change", apply);
}
