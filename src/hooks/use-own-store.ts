import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/integrations/my-supabase/client";

export type OwnedStoreSummary = { id: string; brand_name: string; store_username: string };

const ACTIVE_STORE_KEY = "oak_active_store_id";

function readStoredActiveId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_STORE_KEY);
  } catch {
    return null;
  }
}

function writeStoredActiveId(id: string) {
  try {
    sessionStorage.setItem(ACTIVE_STORE_KEY, id);
  } catch {
    // Safari private browsing etc — the switcher just won't survive a reload.
  }
}

/** Every store the signed-in user owns, oldest first — the same tie-break
 *  order requireOwnStore uses server-side, so the client and server agree on
 *  which store is "the" store for an account that only has one. */
export function useOwnStores() {
  const { user, loading: sessionLoading } = useSession();
  const [stores, setStores] = useState<OwnedStoreSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setStores([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("stores")
      .select("id, brand_name, store_username")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("useOwnStores: failed to load stores", error);
        setStores(data ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, sessionLoading]);

  return { stores, loading };
}

/** The store every /store/* screen should read and write. Defaults to the
 *  oldest store and remembers an explicit pick from the store switcher (in
 *  sessionStorage, so it's per-tab and never touches the localStorage session
 *  token) for the rest of that pick's relevance — cleared the moment it no
 *  longer names one of the account's stores. */
export function useActiveStore() {
  const { stores, loading } = useOwnStores();
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (stores.length === 0) {
      setActiveIdState(null);
      return;
    }
    const stored = readStoredActiveId();
    const valid = stored && stores.some((s) => s.id === stored);
    setActiveIdState(valid ? stored : stores[0].id);
  }, [stores, loading]);

  const setActiveId = useCallback((id: string) => {
    writeStoredActiveId(id);
    setActiveIdState(id);
  }, []);

  const store = stores.find((s) => s.id === activeId) ?? null;

  return { store, storeId: store?.id ?? null, stores, loading, setActiveId };
}

/** Thin version of useActiveStore for call sites that only need the id — most
 *  of the dashboard's data hooks, which just want one uuid to filter by. */
export function useActiveStoreId() {
  const { storeId, loading } = useActiveStore();
  return { storeId, loading };
}
