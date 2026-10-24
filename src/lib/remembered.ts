// The last data each seller screen showed, kept on the phone, so reopening a
// screen shows it at once (and offline) while the fresh copy loads quietly
// behind it. Offline app phase 2; phase 1 is public/sw.js.
//
// Read it in an EFFECT, never in a useState initialiser: these screens are
// server-rendered, and a first client render that differs from the server's
// is a hydration mismatch.
//
// localStorage, per device. Keys carry the store or user id, so two accounts
// on one phone never see each other's data, and sign-out wipes the lot
// (forgetRemembered, called from auth.ts).

const PREFIX = "oak:mem:";
// A list bigger than this isn't worth the storage; it just loads normally.
const MAX_CHARS = 300_000;

export function recall<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function remember(key: string, value: unknown) {
  try {
    const raw = JSON.stringify(value);
    if (raw.length > MAX_CHARS) return localStorage.removeItem(PREFIX + key);
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    // Full or blocked (private mode): the screen just loads normally.
  }
}

export function forgetRemembered() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // nothing to clear
  }
}

/** The keys (without the prefix) of everything remembered under `prefix`. */
export function rememberedKeys(prefix: string): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX + prefix)) keys.push(k.slice(PREFIX.length));
    }
  } catch {
    // Blocked storage: nothing remembered.
  }
  return keys;
}
