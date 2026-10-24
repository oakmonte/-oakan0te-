import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { isStandalone } from "@/lib/standalone";

/** Guard for every onboarding step that writes to the database.
 *
 *  Without it these routes rendered in full for a signed-out visitor and only
 *  said "You're no longer signed in" after the whole form had been filled in —
 *  with no link to a sign-in page from there. */
export function useRequireSession({ explainSignIn = false }: { explainSignIn?: boolean } = {}) {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  // Set instead of redirecting, for the installed app's first launch (see
  // `explainSignIn`): the caller shows a page before the sign-in.
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        // An installed iPhone app starts signed out (its own storage), so its
        // first screen would be a bare login that looks like starting over.
        // `explainSignIn` lets the caller say otherwise first.
        if (explainSignIn && isStandalone()) {
          setExplain(true);
          setChecking(false);
          return;
        }
        navigate({ to: "/sign-in", replace: true });
        return;
      }
      setUserId(data.session.user.id);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, explainSignIn]);

  return { userId, checking, explain };
}
