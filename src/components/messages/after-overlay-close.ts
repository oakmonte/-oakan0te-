/**
 * Run `next` once the history entry of an overlay that is closing right now
 * has actually been popped.
 *
 * useOverlayHistory takes its entry back off with history.back(), which is
 * asynchronous. An overlay opened in the same tick (a long-press menu's
 * "Delete" opening a confirm) would push its own entry first, and the pending
 * back() would then pop THAT one -- closing the confirm the instant it
 * appeared. Waiting for the popstate puts the pushes back in order.
 */
export function afterOverlayClose(next: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener("popstate", run);
    // One more frame so useOverlayHistory's own popstate handling settles.
    requestAnimationFrame(next);
  };
  window.addEventListener("popstate", run);
  // Nothing to pop (e.g. the overlay closed because of a navigation).
  setTimeout(run, 350);
}
