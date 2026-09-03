import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

// Routes where an unannounced reload would blow away real in-progress work —
// a half-shot layout, an unsaved caption, a mid-export video. The camera/
// after-shot flow keeps its handoff state in an in-memory module variable
// (capture-handoff.ts), not a focused field, so no generic focus check below
// can protect it — it stays hard-excluded regardless of what's focused.
const RELOAD_UNSAFE_PREFIX = "/create";

// Re-fetching the full page HTML on every screen change *and* every tab
// refocus was the actual complaint: real mobile data cost for a check whose
// answer almost never changes between two checks a few seconds apart. A
// deploy landing a few minutes late costs nothing, so floor how often the
// network round-trip can happen at all — navigation and refocus both feed
// into the same clock instead of each getting their own.
const MIN_CHECK_INTERVAL_MS = 3 * 60 * 1000;

let lastCheckAt = 0;
// Set when a real mismatch was found but the seller was mid-input somewhere
// outside /create — the reload isn't cancelled, just held until they're done,
// so a deploy still lands for them without any typing getting silently wiped.
let pendingReload = false;

// Anywhere in the app, not just /create: a collection name, a profile field,
// a product-form input all deserve the same protection the camera flow gets.
function hasFocusedInput(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

async function isBuildStale(): Promise<boolean> {
  try {
    const res = await fetch(window.location.pathname + window.location.search, {
      cache: "no-store",
    });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const remoteBuildId = doc.querySelector('meta[name="build-id"]')?.getAttribute("content");
    return !!remoteBuildId && remoteBuildId !== __BUILD_ID__;
  } catch {
    // Offline, or the fetch otherwise failed — never reload on ambiguous
    // signal, only on a confirmed mismatch.
    return false;
  }
}

async function checkAndReload() {
  if (window.location.pathname.startsWith(RELOAD_UNSAFE_PREFIX)) return;

  // A mismatch was already confirmed on an earlier check — no need to fetch
  // again, just wait for the field that blocked it to free up.
  if (pendingReload) {
    if (!hasFocusedInput()) window.location.reload();
    return;
  }

  const now = Date.now();
  if (now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return;
  lastCheckAt = now;

  if (await isBuildStale()) {
    if (hasFocusedInput()) {
      pendingReload = true;
    } else {
      window.location.reload();
    }
  }
}

// Lovable pushes straight to production; a tab left open across a deploy
// keeps running the JS it already loaded forever, since client-side
// navigation never re-fetches a route module already sitting in memory —
// that's the "have to hard-refresh to see the update" bug. This re-checks
// the deployed build-id at the moments that actually matter to a user
// (landing on a new top-level page, coming back to a backgrounded tab,
// finishing whatever field held a pending reload back), throttled so it
// costs at most one HTML fetch every few minutes, and silently reloads on a
// real mismatch once nothing on screen would be lost by doing so.
export function useBuildFreshness() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    checkAndReload();
  }, [pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") checkAndReload();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Catches the moment a held-back reload becomes safe without waiting on
    // the next navigation or refocus, which might be a while — deferred a
    // tick so a tab-to-the-next-field doesn't read the old element's blur as
    // "nothing focused" before the new one takes focus.
    const onFocusOut = () => {
      if (pendingReload) setTimeout(checkAndReload, 0);
    };
    document.addEventListener("focusout", onFocusOut);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
}
