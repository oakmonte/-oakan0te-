import { useSyncExternalStore } from "react";

// The app-on-the-phone layer (public/sw.js): the app's code and fonts are
// saved on the device after the first visit, so it opens from the phone, and
// pages already visited open with no connection.
//
// Updates: the worker is registered with ?v=<this build's id>, so each deploy
// is a NEW worker script. The browser installs it in the background, it takes
// over at once, and use-build-freshness.ts reloads the page at the next safe
// moment (not mid-typing, not in the camera/editor) -- exactly the update
// path the app had before, now loading from the phone.

export function registerOfflineApp() {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const start = () => {
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(__BUILD_ID__)}`, { updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Files this first page load fetched before the worker was in charge.
        const urls = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.includes("/assets/"));
        reg.active?.postMessage({ type: "oak-prime", urls });
      })
      .catch((err) => console.warn("Offline app: registration failed", err));
  };
  // After load, so it never competes with the first paint for bandwidth.
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

/** Forget pages saved on this phone (sign-out), so the next person using it
 *  can't open the last one's screens offline. */
export function clearSavedPages() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({ type: "oak-clear-pages" });
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
