import { useCallback, useEffect, useState } from "react";

// Whether a one-time tip should show — see HintBubble in
// src/components/editor/OneTimeHint.tsx for what these tips are and why a
// lost localStorage is harmless.

const PREFIX = "oak-hint:";
/** Long enough to read twice, short enough not to become furniture. */
const AUTO_HIDE_MS = 7000;

function seen(key: string): boolean {
  try {
    return window.localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function markSeen(key: string) {
  try {
    window.localStorage.setItem(PREFIX + key, "1");
  } catch {
    // Storage blocked: the tip simply comes back next visit.
  }
}

/** `[visible, dismiss]`. Starts hidden and is decided after mount, so the
 *  server render and the first client render agree. */
export function useOneTimeHint(key: string, enabled = true): [boolean, () => void] {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || seen(key)) return;
    setVisible(true);
    // Counted as seen the moment it shows. A tip that waits for an explicit
    // dismissal nags every visit for anyone who just let it fade.
    markSeen(key);
    const timer = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [key, enabled]);

  const dismiss = useCallback(() => setVisible(false), []);
  return [visible, dismiss];
}
