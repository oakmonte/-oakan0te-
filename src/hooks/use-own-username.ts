// The signed-in user's personal username, cached module-level so that a click
// handler can read it synchronously. Back navigation needs it — half the app's
// parents are "your own profile" — and a back button cannot wait on a query.
//
// The same one-row lookup was already being repeated inline in home.tsx,
// store-theme-selector.tsx and elsewhere; this is that query, once.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

let cached: string | undefined;

export function getOwnUsername(): string | undefined {
  return cached;
}

/** Updated by /edit-profile when the username changes. Left stale, every
 *  "back to your profile" went to the OLD /profile/$username, which no longer
 *  exists. */
export function setOwnUsername(username: string) {
  cached = username;
}

/** Cleared on sign-out so the next account does not inherit it. */
export function clearOwnUsername() {
  cached = undefined;
}

export function useOwnUsername(): string | undefined {
  const { user } = useSession();
  const [username, setUsername] = useState<string | undefined>(cached);

  useEffect(() => {
    if (!user) return;
    if (cached) {
      setUsername(cached);
      return;
    }
    let cancelled = false;
    void supabase
      .from("profiles")
      .select("personal_username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.personal_username) return;
        cached = data.personal_username;
        setUsername(data.personal_username);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return username;
}
