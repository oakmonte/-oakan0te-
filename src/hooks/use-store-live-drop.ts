import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { pickLiveDrop, type LiveDrop } from "@/lib/drops";

// Shared across every caller for the same store: a storefront renders the
// drop banner once, but the editor sheet and the theme picker ask as well,
// and they should agree without three separate round trips racing each other.
const inflight = new Map<string, Promise<LiveDrop[]>>();

function loadDrops(storeId: string): Promise<LiveDrop[]> {
  let p = inflight.get(storeId);
  if (!p) {
    p = Promise.resolve(
      supabase
        .from("drops")
        .select("id, title, starts_at, ends_at")
        .eq("store_id", storeId)
        // Ended ones are filtered here as well as in pickLiveDrop, so a
        // store with a long history doesn't ship all of it to every visitor.
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .limit(20),
    ).then(({ data, error }) => {
      if (error) console.error("useStoreLiveDrop: failed to load drops", error);
      return data ?? [];
    });
    inflight.set(storeId, p);
    // Short-lived: a seller who announces a drop and comes back to the
    // storefront should see it without a hard reload.
    setTimeout(() => inflight.delete(storeId), 15_000);
  }
  return p;
}

/** The drop a storefront should be announcing right now, or null. The drop
 *  banner renders only when this is non-null: with no real drop there is no
 *  banner at all, not an empty or placeholder one. Re-picks when the chosen
 *  drop ends, so a banner doesn't sit there for a drop that's over. */
export function useStoreLiveDrop(storeId: string | null): LiveDrop | null {
  const [drops, setDrops] = useState<LiveDrop[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    setDrops([]);
    if (!storeId) return;
    let cancelled = false;
    void loadDrops(storeId).then((d) => {
      if (!cancelled) setDrops(d);
    });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const live = pickLiveDrop(drops);

  // Wake up when the live drop's state changes (it starts, or it ends) and
  // pick again. setTimeout caps at ~24.8 days, far past any drop timer.
  useEffect(() => {
    if (!live) return;
    const now = Date.now();
    const edges = [live.starts_at, live.ends_at]
      .map((s) => (s ? new Date(s).getTime() - now : null))
      .filter((ms): ms is number => ms !== null && ms > 0 && ms < 2_000_000_000);
    if (edges.length === 0) return;
    const id = setTimeout(() => setTick((t) => t + 1), Math.min(...edges) + 250);
    return () => clearTimeout(id);
  }, [live]);

  return live;
}
