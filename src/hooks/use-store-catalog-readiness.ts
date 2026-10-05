import { useStorefrontCatalog } from "@/components/store-themes/storefront-catalog";

export type StoreCatalogReadiness = {
  // True until the catalog has loaded -- a caller gating public visibility
  // on `hasAny` needs to tell "still checking" apart from "checked, and
  // there's nothing" or it flashes a real storefront through in the split
  // second before this settles false.
  loading: boolean;
  // What callers actually gate on: is there *anything* the storefront's
  // catalog section would show (an active collection, or an active product
  // that isn't inside one).
  hasAny: boolean;
  /** How many tiles the storefront's catalog has in total -- active
   *  collections plus the products outside them. null until loaded. Drives
   *  the stick-to-page option (stickyOptionAvailable / resolveStickyBottom). */
  gridItemCount: number | null;
};

/** Whether a store has any real catalog to show a stranger. This runs for
 *  whoever is looking at the storefront, because CollectionsGrid fills an
 *  empty catalog with demo collections and products indistinguishable from
 *  real ones -- fine for a seller mid-setup previewing their own storefront,
 *  not fine as what a visitor lands on. Reads the same loader the grid
 *  itself renders from (storefront-catalog.ts), so the two always agree.
 *
 *  `storeId` null means "don't check" (the caller already knows the answer
 *  doesn't matter, e.g. because the viewer is the store's own owner) --
 *  `loading` stays true and nothing is fetched. */
export function useStoreCatalogReadiness(storeId: string | null): StoreCatalogReadiness {
  const { catalog } = useStorefrontCatalog(storeId);
  const gridItemCount = catalog ? catalog.collectionCount + catalog.looseProductCount : null;
  return {
    loading: catalog === null,
    hasAny: (gridItemCount ?? 0) > 0,
    gridItemCount,
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
