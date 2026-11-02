// "Show the storefront showcase next": set when a seller presses Finish on
// onboarding, read once by /welcome, which then goes to /showcase instead of
// straight to the dashboard. An in-memory flag, not storage, on purpose:
// /welcome is also the installed app's start page, so returning sellers pass
// through it on every launch -- and only the one in-app hop from Finish should
// see the showcase. A reload in between simply skips it, which is fine.

let pending = false;

export function queueShowcase() {
  pending = true;
}

/** Whether Finish has queued it. Read without clearing (React may run a state
 *  initializer twice in development); /showcase clears it once it's shown. */
export function showcaseQueued(): boolean {
  return pending;
}

export function clearShowcase() {
  pending = false;
}
