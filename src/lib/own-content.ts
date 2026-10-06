import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

// Whether the signed-in user has any posts or drafts at all -- the thing
// "Link content" on a product depends on. A seller with nothing posted yet
// can't link anything, so the product form stops asking them to.

let cached: { userId: string; has: boolean } | null = null;

/** true / false once known, null while loading or signed out. */
export function useHasOwnContent(): boolean | null {
  const { user } = useSession();
  const [has, setHas] = useState<boolean | null>(
    cached && user && cached.userId === user.id ? cached.has : null,
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["published", "draft"])
      .then(({ count, error }) => {
        if (cancelled) return;
        // Unknown on error: keep asking rather than wave it through.
        if (error) {
          console.error("useHasOwnContent", error);
          return;
        }
        cached = { userId: user.id, has: (count ?? 0) > 0 };
        setHas(cached.has);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return has;
}

// Set when the seller opens Link content and finds it empty. The checklist
// row only ticks after that look -- it is never pre-ticked -- so they see
// where linking lives before it's waved through. Session-long on purpose:
// the product form's sheets mount and unmount as the seller moves around.
let emptyContentSeen = false;

export function markEmptyContentSeen() {
  emptyContentSeen = true;
}

export function hasSeenEmptyContent(): boolean {
  return emptyContentSeen;
}
