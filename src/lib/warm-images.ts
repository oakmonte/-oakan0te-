// Fills the browser cache with images a screen we're about to navigate to will
// need, in priority tiers, while the current screen is idle. Purely a
// head-start: nothing renders from this, and failures are ignored.

const warmed = new Set<string>();

function idle(fn: () => void) {
  if (typeof window === "undefined") return () => {};
  const ric = window.requestIdleCallback;
  if (ric) {
    const id = ric(fn, { timeout: 1500 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}

function warmOne(src: string) {
  if (warmed.has(src)) return Promise.resolve();
  warmed.add(src);
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.decoding = "async";
    img.src = src;
  });
}

/** Warms `tiers` in order — each tier only starts once the previous one is
 *  done, so the first-visible images never queue behind the heavy ones. */
export function warmImageTiers(tiers: string[][]) {
  let cancelled = false;
  const cancelIdle = idle(async () => {
    for (const tier of tiers) {
      if (cancelled) return;
      await Promise.all(tier.map(warmOne));
    }
  });
  return () => {
    cancelled = true;
    cancelIdle();
  };
}
