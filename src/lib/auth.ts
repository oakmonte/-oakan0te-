import { supabase } from "@/lib/integrations/my-supabase/client";

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
export function getProfileUsernameFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
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
  user: { user_metadata?: Record<string, unknown> } | null
): string | null {
  if (!user) return null;
  const candidates = [user.user_metadata?.full_name, user.user_metadata?.name];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

// Single source of truth for "where should this user land after auth."
// - Has a profile already -> straight to their real profile.
// - No profile, but an intent was set (came from one of the three specific
//   entry points) -> choose-username, same as before.
// - No profile AND no intent (came from the generic header Sign In button,
//   so we don't know what they want yet) -> the "no account" chooser page.
export async function resolvePostAuthRedirect(
  userId: string
): Promise<
  | { to: "/profile/$username"; params: { username: string } }
  | { to: "/choose-username" }
  | { to: "/no-account" }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("personal_username")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("resolvePostAuthRedirect: failed to check profile", error);
  }

  if (data?.personal_username) {
    return { to: "/profile/$username", params: { username: data.personal_username } } as const;
  }

  const hasIntent = typeof window !== "undefined" && !!sessionStorage.getItem("oakmonte_intent");
  if (hasIntent) {
    return { to: "/choose-username" } as const;
  }

  return { to: "/no-account" } as const;
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl() },
  });
}

export async function sendMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}