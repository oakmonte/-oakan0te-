// Everything about "is this app on a home screen, and how do we get it there".
//
// Two separate jobs that share one subject:
//
//   1. `stampInstalledApp` records, on the account, that this person has the
//      installed app. The seller checklist reads it to tick its install step.
//   2. The `beforeinstallprompt` plumbing keeps Android's one-tap install
//      offer alive long enough for a route to use it.

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { isStandalone } from "@/lib/standalone";

/** Whether this account has ever opened the installed app.
 *
 *  Read from user_metadata rather than localStorage for the same reason
 *  `passkey_prompted` is -- and here the reason is the entire feature, not a
 *  side note. The installed iOS app has its own storage jar, so a flag written
 *  in Safari is invisible to the app and a flag written in the app is invisible
 *  to Safari. Metadata follows the account across that boundary; nothing in
 *  browser storage does. */
export function hasInstalledApp(user: User | null): boolean {
  if (!user) return false;
  return user.user_metadata?.installed_app === true;
}

/** Records that this account has opened the installed app. No-op unless we are
 *  actually running standalone and have not already said so.
 *
 *  Never throws and never reports failure, exactly like `markPasskeyPrompted`:
 *  no caller may make navigation depend on this. A failed write costs a
 *  checklist tick that appears on the next launch instead.
 *
 *  Note what this means on iPhone. A standalone iOS web app starts signed out,
 *  so `user` is null on the very first launch and this does nothing; the stamp
 *  lands once they sign in inside the app. That delay is the reason the passkey
 *  offer sits two steps earlier in the checklist -- Face ID is what makes that
 *  sign-in a tap instead of a retyped password. On Android the WebAPK shares
 *  the browser's jar, so the session is already there and this lands at once. */
let stamping = false;

export async function stampInstalledApp(user: User | null): Promise<void> {
  if (!user) return;
  if (!isStandalone()) return;
  if (hasInstalledApp(user)) return;
  // The caller re-runs on every session change, and supabase-js emits several
  // in quick succession -- INITIAL_SESSION, then TOKEN_REFRESHED, and again
  // SIGNED_IN when the tab regains focus. Each carries a fresh user object, so
  // the metadata check above cannot deduplicate them: none of them has the
  // flag yet, because the first write hasn't landed. This latch is what stops
  // three concurrent updateUser calls for one install.
  //
  // It also caps a failed write at one attempt per page load rather than one
  // per token refresh forever. The cost of that is a stamp that waits for the
  // next launch, which is the same cost the whole function already accepts.
  if (stamping) return;
  stamping = true;
  try {
    const { error } = await supabase.auth.updateUser({ data: { installed_app: true } });
    if (error) console.error("stampInstalledApp failed", error);
  } catch (err) {
    console.error("stampInstalledApp threw", err);
  }
}

/** Chrome's install offer. Not in lib.dom — it is a Chromium extension to the
 *  platform, which is also why none of this exists on iOS. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Module scope on purpose, and this is the whole point of the file.
//
// `beforeinstallprompt` fires once, during page load, long before anyone
// navigates to the screen that wants to offer an install. A listener registered
// in that route's own effect is simply too late and the button silently
// degrades to "here are some menu instructions" -- which looks like it works.
// So we catch it at the root and park it here, the same shape as
// capture-handoff.ts.
let deferred: InstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function publish() {
  for (const fn of subscribers) fn();
}

/** Starts listening. Call once, from the root. Returns a cleanup function. */
export function captureInstallPrompt(): () => void {
  if (typeof window === "undefined") return () => {};

  const onPrompt = (event: Event) => {
    // Without this Chrome shows its own install bar, and the seller gets two
    // competing offers for the same thing on the same screen.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    publish();
  };
  // Fires however the install happened -- our button, Chrome's menu, or the
  // mini-infobar. The saved event is single-use and spent by then either way.
  const onInstalled = () => {
    deferred = null;
    publish();
  };

  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

/** Whether a real one-tap install is available right now. False on every iOS
 *  browser, in every in-app webview, and once the app is already installed. */
export function canPromptInstall(): boolean {
  return deferred !== null;
}

/** Re-renders a component when the offer appears or is spent. */
export function subscribeInstallPrompt(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/** Shows Chrome's install sheet.
 *
 *  "unavailable" is not a failure -- it is the normal answer on iOS and in
 *  webviews, and callers are expected to fall back to written instructions
 *  rather than treat it as an error. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    // Spent either way: Chrome refuses a second prompt() on the same event.
    deferred = null;
    publish();
    return outcome;
  } catch (err) {
    console.error("promptInstall threw", err);
    deferred = null;
    publish();
    return "unavailable";
  }
}
