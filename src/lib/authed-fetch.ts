import { supabase } from "@/lib/integrations/my-supabase/client";

/** Attaches the caller's Supabase access token to an `api.*` request.
 *
 *  The session lives in localStorage, not a cookie, so it is NOT sent
 *  automatically — a server handler running on the service-role key has no way
 *  to know who is asking unless the token is attached here. */
export async function authedFetch(input: string, init: RequestInit = {}) {
  // Never attach the session token to a cross-origin URL. Both callers pass a
  // literal /api/... path today, so this is a guard against the next caller
  // that builds a URL from config or from a server-supplied value.
  const target = new URL(input, window.location.origin);
  if (target.origin !== window.location.origin) {
    throw new Error(`authedFetch refuses to send credentials to ${target.origin}`);
  }

  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}
