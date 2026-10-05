import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export type TilePhoto = {
  url: string;
  /** Which variant this photo belongs to, 0-based and gap-free: variants
   * that uploaded no photo at all are skipped entirely rather than leaving a
   * number the shopper can never swipe to. Always 0 for collections, which
   * have no variants. */
  variant: number;
};

export type PreviewTile = {
  id: string;
  title: string;
  /** Every photo the seller uploaded for this tile, in variant order, cover
   * first within each variant. More than one turns the tile into a swipeable
   * carousel (see CatalogTile in full-preview-blocks.tsx). Empty means "no
   * photo at all" — the caller substitutes its placeholder. */
  photos: TilePhoto[];
  /** How many variants actually contributed a photo. 1 (or 0) means there is
   * nothing for the tile's variant counter to track, so it isn't drawn. */
  variantCount: number;
  price: number | null;
  compareAtPrice: number | null;
};

/** What a storefront's catalog section shows. There is no Collections /
 *  Products switch any more: collections come first, then the products that
 *  aren't in any (visible) collection, and either section simply isn't
 *  there when it has nothing in it. */
export type StorefrontCatalog = {
  /** Active collections, newest first, at most TILE_LIMIT. */
  collections: PreviewTile[];
  /** Active products in no ACTIVE collection, newest first, at most
   *  TILE_LIMIT. A product whose only collection is a draft counts as loose,
   *  or it would vanish from the storefront entirely. */
  products: PreviewTile[];
  /** Full counts, not capped by TILE_LIMIT. */
  collectionCount: number;
  looseProductCount: number;
};

const TILE_LIMIT = 4;

// A cover photo plus its extras, in upload order, with the nulls and the
// blank strings a half-filled form can leave behind dropped.
function gallery(main: string | null, extra: string[] | null): string[] {
  return [main, ...(extra ?? [])].filter(
    (url): url is string => typeof url === "string" && url.trim() !== "",
  );
}

async function fetchCatalog(storeId: string): Promise<StorefrontCatalog> {
  // Everything here feeds the PUBLIC storefront, so drafts stay out on both
  // sides. Collections are few, so all of them come back (for the count);
  // products come back as bare ids plus their collection links first, and
  // only the handful actually shown get their variants and photos.
  const [cols, prods] = await Promise.all([
    supabase
      .from("collections")
      .select("id, title, image_url, additional_image_urls")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, product_collections(collection_id)")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
  ]);
  if (cols.error) console.error("storefront catalog: collections", cols.error);
  if (prods.error) console.error("storefront catalog: products", prods.error);

  const activeCollections = cols.data ?? [];
  const activeIds = new Set(activeCollections.map((c) => c.id));
  const looseIds = (prods.data ?? [])
    .filter((p) => !(p.product_collections ?? []).some((l) => activeIds.has(l.collection_id)))
    .map((p) => p.id);

  const shownIds = looseIds.slice(0, TILE_LIMIT);
  let products: PreviewTile[] = [];
  if (shownIds.length > 0) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, title, product_variants(main_image_url, additional_image_urls, price, compare_at_price)",
      )
      .in("id", shownIds)
      // Embedded rows come back in no guaranteed order otherwise, which
      // would let the tile's photo order — and the price below, taken from
      // the first variant — change between two loads of the same product.
      .order("created_at", { referencedTable: "product_variants", ascending: true });
    if (error) console.error("storefront catalog: product details", error);
    const byId = new Map((data ?? []).map((p) => [p.id, p]));
    products = shownIds.flatMap((id) => {
      const p = byId.get(id);
      if (!p) return [];
      const variants = p.product_variants ?? [];
      // Deliberately NOT de-duplicated across variants. A size run repeats
      // one photo across every row, so swiping can advance the variant
      // counter without the picture changing — the counter tracks variants,
      // and collapsing identical photo sets would skip variants that exist.
      const photos: TilePhoto[] = [];
      let variant = 0;
      for (const v of variants) {
        const urls = gallery(v.main_image_url, v.additional_image_urls);
        if (urls.length === 0) continue;
        for (const url of urls) photos.push({ url, variant });
        variant += 1;
      }
      return [
        {
          id: p.id,
          title: p.title ?? "Untitled",
          photos,
          variantCount: variant,
          price: variants[0]?.price ?? null,
          compareAtPrice: variants[0]?.compare_at_price ?? null,
        },
      ];
    });
  }

  return {
    collections: activeCollections.slice(0, TILE_LIMIT).map((c) => ({
      id: c.id,
      title: c.title,
      photos: gallery(c.image_url, c.additional_image_urls).map((url) => ({ url, variant: 0 })),
      variantCount: 1,
      price: null,
      compareAtPrice: null,
    })),
    products,
    collectionCount: activeCollections.length,
    looseProductCount: looseIds.length,
  };
}

// Shared across every caller for the same store: one storefront asks from
// the grid, the stick-to-page logic and the visibility gate at once, and
// they must agree. Short-lived so a seller who lists something and comes
// back sees it without a reload.
const inflight = new Map<string, Promise<StorefrontCatalog>>();

function loadCatalog(storeId: string): Promise<StorefrontCatalog> {
  let p = inflight.get(storeId);
  if (!p) {
    p = fetchCatalog(storeId);
    inflight.set(storeId, p);
    setTimeout(() => inflight.delete(storeId), 10_000);
  }
  return p;
}

/** The real catalog of `storeId` — the seller's own store while editing, or
 *  the store being viewed on a public storefront. Always caller-supplied
 *  rather than derived from the session, since a viewer with no store of
 *  their own still needs to see the one they're looking at. null means
 *  "don't load"; `catalog` stays null until the first load lands. */
export function useStorefrontCatalog(storeId: string | null): {
  catalog: StorefrontCatalog | null;
  loading: boolean;
} {
  const [catalog, setCatalog] = useState<StorefrontCatalog | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void loadCatalog(storeId).then((c) => {
      if (cancelled) return;
      setCatalog(c);
      setLoadedFor(storeId);
    });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const current = storeId && loadedFor === storeId ? catalog : null;
  return { catalog: current, loading: !!storeId && current === null };
}
