import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useStorefrontSeed } from "@/lib/storefront-seed";

/** A store's shipping policy and picture, for the storefront footer's
 *  Shipping Policy pop-up. `policy` is null until loaded and stays null when
 *  the seller hasn't written one -- the footer shows no link then. */
export function useStoreShippingPolicy(storeId: string | null) {
  // A public storefront's store row came with the page (StorefrontDataContext).
  const seed = useStorefrontSeed(storeId)?.store ?? null;
  const seeded = seed
    ? { policy: seed.shipping_policy?.trim() || null, logoUrl: seed.logo_url }
    : null;
  const [state, setState] = useState<{ policy: string | null; logoUrl: string | null }>(
    seeded ?? { policy: null, logoUrl: null },
  );

  useEffect(() => {
    if (seed) return;
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
  }, [storeId, seed]);

  return seeded ?? state;
}
