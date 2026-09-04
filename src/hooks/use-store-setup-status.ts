import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authed-fetch";
import { supabase } from "@/lib/integrations/my-supabase/client";

export type StoreSetupStatus = {
  // True until every signal below has resolved at least once -- callers that
  // gate a one-time action (like the profile page's seller prompt) on
  // `complete` need this so "still loading" is never mistaken for "done".
  loading: boolean;
  payoutSet: boolean;
  locationCount: number | null;
  productCount: number | null;
  themeIdSet: boolean;
  // Mirrors the four steps store.index.tsx's own checklist tracks (get paid,
  // pickup locations, list products, customise storefront) -- kept as one
  // shared hook so a "finished onboarding" check elsewhere in the app (e.g.
  // the profile page's seller prompt) can't quietly drift from what the
  // checklist itself considers done.
  complete: boolean;
  // Escape hatch for a caller that just changed this itself (e.g. the
  // pickup-locations sheet reporting its own list length) and wants to
  // reflect that immediately rather than wait on a refetch.
  setLocationCount: (count: number) => void;
};

/** Fetches the same four onboarding signals store.index.tsx's checklist is
 *  built from. `storeId` null means "no store yet" -- loading stays true and
 *  complete stays false, since there's nothing to check. */
export function useStoreSetupStatus(storeId: string | null): StoreSetupStatus {
  const [payoutSet, setPayoutSet] = useState(false);
  const [payoutLoaded, setPayoutLoaded] = useState(false);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [themeIdSet, setThemeIdSet] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authedFetch("/api/store/payout")
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setPayoutSet(!!body.account);
        setPayoutLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("store_locations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreSetupStatus: failed to load pickup location count", error);
          return;
        }
        setLocationCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreSetupStatus: failed to load product count", error);
          return;
        }
        setProductCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("stores")
      .select("theme_id")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreSetupStatus: failed to load theme status", error);
          return;
        }
        setThemeIdSet(!!data?.theme_id);
        setThemeLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const loading =
    !storeId || !payoutLoaded || locationCount === null || productCount === null || !themeLoaded;

  return {
    loading,
    payoutSet,
    locationCount,
    productCount,
    themeIdSet,
    complete: !loading && payoutSet && !!locationCount && !!productCount && themeIdSet,
    setLocationCount,
  };
}
