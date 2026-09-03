// Tracks the last route the app was on outside the camera/after-shot flow, so
// the camera's exit button can return there directly via router.navigate()
// instead of window.history.back() — which is unreliable inside third-party
// in-app browser webviews (Instagram/TikTok), since it competes with the
// host app's own back handling rather than being a plain client-side route
// change we control. Plain module variable, not React state — same
// "survives navigation, doesn't need a provider" reasoning as
// capture-handoff.ts.
let lastNonCreateRoute = "/home";

export function setLastNonCreateRoute(pathname: string) {
  lastNonCreateRoute = pathname;
}

export function getLastNonCreateRoute(): string {
  return lastNonCreateRoute;
}
