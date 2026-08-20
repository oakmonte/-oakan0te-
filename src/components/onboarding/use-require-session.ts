import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/integrations/my-supabase/client";

/** Guard for every onboarding step that writes to the database.
 *
 *  Without it these routes rendered in full for a signed-out visitor and only
 *  said "You're no longer signed in" after the whole form had been filled in —
 *  with no link to a sign-in page from there. */
export function useRequireSession() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/sign-in", replace: true });
        return;
      }
      setUserId(data.session.user.id);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return { userId, checking };
}
