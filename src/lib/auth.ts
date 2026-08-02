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

// NOTE: This is a client-side-only fallback for display purposes (e.g. showing
// a placeholder name before a real profile is confirmed to exist). It does NOT
// check the database, so it must never be used to decide where to navigate a
// user after sign-in — use resolvePostAuthRedirect for that instead.
export function getProfileUsernameFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return null;

  const candidates = [
    user.user_metadata?.full_name,
    user.user_metadata?.name,
    user.email,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const slug = slugify(candidate);
      if (slug) return slug;
    }
  }

  const fallback = user.email?.split("@")[0];
  return fallback ? slugify(fallback) : "account";
}

// Single source of truth for "where should this user land after auth."
// Checks whether a profiles row actually exists — if it does, go straight to
// their real profile; if not, send them into onboarding to create one.
// Every sign-in path (Google, magic link, OTP) should call this instead of
// implementing its own redirect logic.
export async function resolvePostAuthRedirect(
  userId: string
): Promise<
  | { to: "/profile/$username"; params: { username: string } }
  | { to: "/choose-username" }
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

  return { to: "/choose-username" } as const;
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