import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

/** How many drafts the signed-in user has, for the CREATE panel's counter.
 *
 *  A `head: true` count — the server returns the number and no rows, so the
 *  panel doesn't pay to download every draft's media URL just to print a
 *  digit. Returns 0 while loading and when signed out, which is what the tile
 *  should show in both cases anyway. */
export function useDraftCount(): number {
  const { user, loading } = useSession();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (loading || !user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "draft")
      .then(({ count: n, error }) => {
        if (cancelled) return;
        if (error) console.error("useDraftCount: failed to count drafts", error);
        setCount(n ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return count;
}
