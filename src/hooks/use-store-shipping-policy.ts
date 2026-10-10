import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

/** A store's shipping policy and picture, for the storefront footer's
 *  Shipping Policy pop-up. `policy` is null until loaded and stays null when
 *  the seller hasn't written one -- the footer shows no link then. */
export function useStoreShippingPolicy(storeId: string | null) {
  const [state, setState] = useState<{ policy: string | null; logoUrl: string | null }>({
    policy: null,
    logoUrl: null,
  });

  useEffect(() => {
    if (!storeId) {
      setState({ policy: null, logoUrl: null });
      return;
    }
    let cancelled = false;
    supabase
      .from("stores")
      .select("shipping_policy, logo_url")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("useStoreShippingPolicy: failed to load", error);
        const policy = data?.shipping_policy?.trim() || null;
        setState({ policy, logoUrl: data?.logo_url ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return state;
}
