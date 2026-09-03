import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

// Routes where an unannounced reload would blow away real in-progress work —
// a half-shot layout, an unsaved caption, a mid-export video. Everywhere else
// a reload just re-renders whatever was already on screen, so it's safe.
const RELOAD_UNSAFE_PREFIX = "/create";

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
  if (await isBuildStale()) window.location.reload();
}

// Lovable pushes straight to production; a tab left open across a deploy
// keeps running the JS it already loaded forever, since client-side
// navigation never re-fetches a route module already sitting in memory —
// that's the "have to hard-refresh to see the update" bug. This re-checks
// the deployed build-id at the two moments that actually matter to a user
// (landing on a new top-level page, coming back to a backgrounded tab) and
// silently reloads on a real mismatch, so a new deploy reaches people within
// one navigation instead of waiting on them to think to refresh.
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
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
}
