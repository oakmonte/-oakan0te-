// Onboarding scratch state — the answers a step needs to hand to a later step
// before there is anywhere in the database to put them yet.
//
// localStorage, not sessionStorage: the Google OAuth round-trip and the email
// code both keep the same tab today, but sessionStorage is per-tab and dies on
// a browser tab restore, which used to strand the user on /no-account with no
// way to say what they came for. Everything here is cleared once the flow ends.

export type Intent = "seller" | "creator" | "curator";

const INTENT_KEY = "oakmonte_intent";
const STORE_TYPE_KEY = "oakmonte_store_type";
const CUSTOM_ORDERS_KEY = "oakmonte_custom_orders";
const PASSWORD_RESET_KEY = "oakmonte_password_reset";

const INTENTS: readonly string[] = ["seller", "creator", "curator"];

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    // Safari private mode throws on storage access.
    return null;
  }
}

function write(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function remove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isIntent(value: unknown): value is Intent {
  return typeof value === "string" && INTENTS.includes(value);
}

export function setIntent(intent: Intent) {
  write(INTENT_KEY, intent);
}

export function readIntent(): Intent | null {
  const stored = read(INTENT_KEY);
  return isIntent(stored) ? stored : null;
}

/** Set when someone takes the "Forgot password? Email me a code" route out of
 *  the sign-in form.
 *
 *  Without it that path dead-ends: `needsPassword` is false for an account that
 *  already has a password, so the code sign-in succeeds and drops the user on
 *  their profile with the forgotten password still in place — and the notice
 *  they were shown ("you can set a new password after") never comes true. They
 *  would be back on emailed codes forever, which is the cost this whole
 *  password step exists to avoid. */
export function setPasswordResetPending() {
  write(PASSWORD_RESET_KEY, "1");
}

export function isPasswordResetPending(): boolean {
  return read(PASSWORD_RESET_KEY) === "1";
}

export function clearPasswordResetPending() {
  remove(PASSWORD_RESET_KEY);
}

export type StoreDraft = { storeType: string | null; customOrders: boolean };

export function setStoreDraft(draft: StoreDraft) {
  write(STORE_TYPE_KEY, draft.storeType ?? "");
  write(CUSTOM_ORDERS_KEY, String(draft.customOrders));
}

export function readStoreDraft(): StoreDraft {
  return {
    storeType: read(STORE_TYPE_KEY) || null,
    customOrders: read(CUSTOM_ORDERS_KEY) === "true",
  };
}

// Called once the last step of a flow completes, so a later sign-in in the same
// browser isn't routed by a stale intent from a flow that already finished.
export function clearOnboardingState() {
  remove(INTENT_KEY);
  remove(STORE_TYPE_KEY);
  remove(CUSTOM_ORDERS_KEY);
  remove(PASSWORD_RESET_KEY);
}
