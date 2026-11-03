import { useEffect, useState } from "react";

/** Longest the wait lasts: on a slow connection `load` waits for every image,
 *  and work held back for "later" shouldn't wait that long. */
const MAX_WAIT_MS = 4000;

/** False until the page has loaded and gone idle -- or the visitor touches
 *  something, or MAX_WAIT_MS passes, whichever is first. For work the first
 *  screen doesn't need (warming the next tab, signing in for chat) that would
 *  otherwise compete with it for a slow connection. Always false on the
 *  server and on the hydrating render, so it never causes a mismatch. */
export function useAfterPageLoad(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let done = false;
    const cleanups: (() => void)[] = [];
    const go = () => {
      if (done) return;
      done = true;
      cleanups.forEach((c) => c());
      setReady(true);
    };
    const idle = () => {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(go, { timeout: 1000 });
        cleanups.push(() => window.cancelIdleCallback(id));
      } else {
        const id = window.setTimeout(go, 200);
        cleanups.push(() => window.clearTimeout(id));
      }
    };

    if (document.readyState === "complete") idle();
    else {
      window.addEventListener("load", idle, { once: true });
      cleanups.push(() => window.removeEventListener("load", idle));
    }
    // Someone who taps straight away (Messages, Home) needs it now.
    const opts = { once: true, passive: true, capture: true } as const;
    window.addEventListener("pointerdown", go, opts);
    window.addEventListener("keydown", go, opts);
    cleanups.push(() => {
      window.removeEventListener("pointerdown", go, opts);
      window.removeEventListener("keydown", go, opts);
    });
    const cap = window.setTimeout(go, MAX_WAIT_MS);
    cleanups.push(() => window.clearTimeout(cap));

    return () => {
      done = true;
      cleanups.forEach((c) => c());
    };
  }, [ready]);

  return ready;
}
