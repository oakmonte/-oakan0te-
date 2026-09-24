// The back action of whichever screen is showing, published by BackButton so
// the edge swipe (EdgeSwipeBack.tsx) does exactly what tapping the chevron
// does — including a screen's `to` override and an `onIntercept` confirm.
// A stack, not a slot: a sheet that renders its own BackButton on top of a
// screen that has one must win while it is open, and hand back when it closes.
// Module-level for the same reason as nav-stack.ts: read from a gesture
// handler, with no provider in between.

const handlers: Array<() => void> = [];

export function registerScreenBack(fn: () => void): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.lastIndexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export function currentScreenBack(): (() => void) | null {
  return handlers[handlers.length - 1] ?? null;
}
