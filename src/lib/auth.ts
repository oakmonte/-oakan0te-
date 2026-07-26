import { supabase } from "@/lib/integrations/my-supabase/client";

function callbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl() },
  });
}

export async function sendMagicLink(email: string, username: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl(),
      data: { username },
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

