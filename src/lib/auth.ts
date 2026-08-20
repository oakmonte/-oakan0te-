import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { readIntent, type Intent } from "@/lib/onboarding-state";

function callbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Legacy client-side guess — kept only in case something still imports it,
// but nothing in the app should call this anymore. Navigation always goes
// through resolvePostAuthRedirect, and display purposes should use
// getDisplayNameFromUser instead.
export function getProfileUsernameFromUser(
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
) {
  if (!user) return null;
  const candidates = [user.user_metadata?.full_name, user.user_metadata?.name, user.email];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const slug = slugify(candidate);
      if (slug) return slug;
    }
  }
  const fallback = user.email?.split("@")[0];
  return fallback ? slugify(fallback) : "account";
}

// For display purposes only (e.g. seeding profiles.display_name at signup).
// Not slugified, not used for routing. Returns null if the auth provider
// didn't give us a real name — caller decides the fallback (should be the
// chosen username, not an email-derived string).
export function getDisplayNameFromUser(
  user: { user_metadata?: Record<string, unknown> } | null,
): string | null {
  if (!user) return null;
  const candidates = [user.user_metadata?.full_name, user.user_metadata?.name];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export type PostAuthRedirect =
  | { to: "/profile/$username"; params: { username: string } }
  | { to: "/choose-username" }
  | { to: "/seller-type" }
  | { to: "/where-did-you-hear-about-us" }
  | { to: "/name-your-store" }
  | { to: "/find-your-fit" }
  | { to: "/create-password" }
  | { to: "/no-account" };

/** Where this user's own profile lives, or the home page if they somehow have
 *  no profile row yet. Used to end every onboarding flow in the same place. */
export async function ownProfileRedirect(
  userId: string,
): Promise<{ to: "/profile/$username"; params: { username: string } } | { to: "/" }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("personal_username")
    .eq("id", userId)
    .maybeSingle();

  if (error) console.error("ownProfileRedirect: failed to read profile", error);

  return data?.personal_username
    ? ({ to: "/profile/$username", params: { username: data.personal_username } } as const)
    : ({ to: "/" } as const);
}

// Single source of truth for "where should this user land after auth."
//
// It resumes an unfinished flow rather than dropping a half-onboarded user on
// their profile page: before, any user with a username was sent straight to
// /profile, so anyone who abandoned the flow after choosing a username could
// never reach the remaining steps again.
export async function resolvePostAuthRedirect(
  userId: string,
  /** The intent of the page the user is standing on, when it knows. Passed
   *  explicitly because storage can silently fail (Safari private browsing),
   *  and a null read there used to bounce the user to /no-account forever. */
  intentHint?: Intent | null,
): Promise<PostAuthRedirect> {
  // Central password gate: checking it only inside AuthPanel.finish meant one
  // browser Back press skipped it and left the account without a password.
  const { data: userData } = await supabase.auth.getUser();
  if (needsPassword(userData.user)) return { to: "/create-password" } as const;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("personal_username, account_type, referral_source")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("resolvePostAuthRedirect: failed to check profile", error);
  }

  if (!profile?.personal_username) {
    // No profile yet. If they came through one of the three entry points we
    // know what they want; otherwise ask.
    return (intentHint ?? readIntent())
      ? ({ to: "/choose-username" } as const)
      : ({ to: "/no-account" } as const);
  }

  // account_type is written at profile creation and is the durable record of
  // intent — fall back to local state only for profiles created before it.
  const intent = (profile.account_type as Intent | null) ?? intentHint ?? readIntent() ?? "seller";

  if (!profile.referral_source) {
    return intent === "seller"
      ? ({ to: "/seller-type" } as const)
      : ({ to: "/where-did-you-hear-about-us" } as const);
  }

  if (intent === "seller") {
    const { count, error: storeError } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    if (storeError) console.error("resolvePostAuthRedirect: failed to check store", storeError);
    if (!storeError && !count) return { to: "/name-your-store" } as const;
  }

  return { to: "/profile/$username", params: { username: profile.personal_username } } as const;
}

/** True when this account signs in by email and has no password set yet, so it
 *  would otherwise need a fresh emailed code on every single login. Google-only
 *  accounts never need one. */
export function needsPassword(user: User | null): boolean {
  if (!user) return false;
  if (user.user_metadata?.has_password === true) return false;
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [
    user.app_metadata?.provider,
  ];
  return providers.filter(Boolean).includes("email");
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl() },
  });
}

/** Emails a 6-digit code. Deliberately no `emailRedirectTo`: the Supabase and
 *  Resend templates send `{{ .Token }}`, not a magic link, so there is no link
 *  for the user to click and no second tab for them to get stranded in. */
export async function sendEmailCode(email: string, { createUser = true } = {}) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: createUser } });
}

export async function verifyEmailCode(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: "email" });
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** Sets the password on the current session's user. The `has_password` flag is
 *  what `needsPassword` reads later — Supabase gives the client no other way to
 *  tell whether a password exists. */
export async function setAccountPassword(password: string) {
  return supabase.auth.updateUser({ password, data: { has_password: true } });
}

export async function signOut() {
  return supabase.auth.signOut();
}
