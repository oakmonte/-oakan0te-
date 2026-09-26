import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export type StoreCatalogReadiness = {
  // True until both counts below have resolved at least once -- a caller
  // gating public visibility on `hasAny` needs to tell "still checking" apart
  // from "checked, and there's nothing" or it flashes a real storefront
  // through in the split second before this settles false.
  loading: boolean;
  hasProducts: boolean;
  hasCollections: boolean;
  // What callers actually gate on: is there *anything* real to show. A store
  // with three collections and zero products, or vice versa, still counts.
  hasAny: boolean;
  /** The counts themselves, null until loaded. Used for the stick-to-page
   * default (more than 12 of whichever the grid shows). */
  productCount: number | null;
  collectionCount: number | null;
};

/** Whether a store has any real catalog to show a stranger -- distinct from
 *  `useStoreSetupStatus`'s `productCount`, which only ever runs for the
 *  store's own owner. This runs for whoever is looking at the storefront,
 *  because CollectionsGrid fills an empty catalog with fake demo products
 *  and collections indistinguishable from real ones (see
 *  useThemePreviewCatalog.ts) -- fine for a seller mid-setup previewing their
 *  own in-progress storefront, not fine as what a visitor lands on.
 *
 *  `storeId` null means "don't check" (the caller already knows the answer
 *  doesn't matter, e.g. because the viewer is the store's own owner) --
 *  `loading` stays true and both counts stay false, since nothing is being
 *  asked. */
export function useStoreCatalogReadiness(storeId: string | null): StoreCatalogReadiness {
  const [productCount, setProductCount] = useState<number | null>(null);
  const [collectionCount, setCollectionCount] = useState<number | null>(null);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [collectionsLoaded, setCollectionsLoaded] = useState(false);

  useEffect(() => {
    setProductsLoaded(false);
    setCollectionsLoaded(false);
    setProductCount(null);
    setCollectionCount(null);
    if (!storeId) return;
    let cancelled = false;

    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      // Same "drafts stay out" rule useThemePreviewCatalog's public query
      // enforces -- a store with nothing but unfinished listings is not
      // ready for a stranger either.
      .eq("status", "active")
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreCatalogReadiness: failed to load product count", error);
        }
        setProductCount(count ?? 0);
        setProductsLoaded(true);
      });

    supabase
      .from("collections")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreCatalogReadiness: failed to load collection count", error);
        }
        setCollectionCount(count ?? 0);
        setCollectionsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return {
    loading: !storeId || !productsLoaded || !collectionsLoaded,
    hasProducts: (productCount ?? 0) > 0,
    hasCollections: (collectionCount ?? 0) > 0,
    hasAny: (productCount ?? 0) > 0 || (collectionCount ?? 0) > 0,
    productCount,
    collectionCount,
  };
}

/** The public-storefront visibility rule shared by profile.$username.tsx and
 *  store-profile.$storeUsername.tsx -- pulled out so the two can't drift the
 *  same way ProfileTabStrip's own "shared so the two can't drift apart"
 *  comment already guards against for the tab strip itself. A theme must be
 *  picked, and (for anyone but the owner) there has to be something real in
 *  the catalog. `loading` counts as visible, not hidden -- see
 *  StoreCatalogReadiness's own comment on why defaulting to hidden would
 *  flash every real storefront closed-then-open on first load. */
export function isStorefrontVisible(
  themeId: string | null | undefined,
  isOwner: boolean,
  catalogReadiness: Pick<StoreCatalogReadiness, "loading" | "hasAny">,
): boolean {
  return !!themeId && (isOwner || catalogReadiness.loading || catalogReadiness.hasAny);
}
