import { useSyncExternalStore } from "react";

/** What tapping the bookmark on a post does. Both on by default: one tap
 *  favourites the post AND puts its linked items in the wishlist. The toast
 *  that appears afterwards lets the viewer switch either off, and that choice
 *  sticks for the rest of the session — the point is that you decide once and
 *  keep scrolling, not that you re-decide on every post.
 *
 *  sessionStorage, not localStorage: it's a per-sitting preference, and it
 *  must never share a key with the auth token's storage (see
 *  use-own-store.ts's active-store id for the same reasoning).
 *
 *  Module-level rather than context because every card in the feed reads it
 *  and none of them own it — a provider would only add a wrapper. */
export type SavePrefs = { favourites: boolean; wishlist: boolean };

const KEY = "oak_save_prefs";
const DEFAULTS: SavePrefs = { favourites: true, wishlist: true };

function read(): SavePrefs {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SavePrefs>;
    return {
      favourites: parsed.favourites ?? true,
      wishlist: parsed.wishlist ?? true,
    };
  } catch {
    return DEFAULTS;
  }
}

// Read lazily: this module is imported during SSR, where sessionStorage
// doesn't exist at all.
let prefs: SavePrefs = DEFAULTS;
let hydrated = false;
const listeners = new Set<() => void>();

export function getSavePrefs(): SavePrefs {
  if (!hydrated && typeof window !== "undefined") {
    prefs = read();
    hydrated = true;
  }
  return prefs;
}

/** Stable across calls so useSyncExternalStore doesn't loop on the server. */
function getServerSnapshot(): SavePrefs {
  return DEFAULTS;
}

export function setSavePref(key: keyof SavePrefs, value: boolean) {
  prefs = { ...getSavePrefs(), [key]: value };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing — the choice just won't outlive this page.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSavePrefs(): SavePrefs {
  return useSyncExternalStore(subscribe, getSavePrefs, getServerSnapshot);
}
