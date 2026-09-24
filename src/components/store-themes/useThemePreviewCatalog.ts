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

// A cover photo plus its extras, in upload order, with the nulls and the
// blank strings a half-filled form can leave behind dropped.
function gallery(main: string | null, extra: string[] | null): string[] {
  return [main, ...(extra ?? [])].filter(
    (url): url is string => typeof url === "string" && url.trim() !== "",
  );
}

// Real, read-only preview of a store's collections/products — the seller's
// own store while editing, or any store's when rendered publicly (see
// PublicStorefront). storeId is always caller-supplied rather than derived
// from the viewer's session, since a viewer with no store of their own (or a
// different one) still needs to see the store actually being looked at.
export function useThemePreviewCatalog(mode: "collections" | "products", storeId: string | null) {
  const [tiles, setTiles] = useState<PreviewTile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) {
      setTiles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      if (mode === "collections") {
        const { data, error } = await supabase
          .from("collections")
          .select("id, title, image_url, additional_image_urls")
          .eq("store_id", storeId)
          .limit(4);
        if (cancelled) return;
        setTiles(
          error || !data
            ? []
            : data.map((c) => ({
                id: c.id,
                title: c.title,
                photos: gallery(c.image_url, c.additional_image_urls).map((url) => ({
                  url,
                  variant: 0,
                })),
                variantCount: 1,
                price: null,
                compareAtPrice: null,
              })),
        );
      } else {
        const { data, error } = await supabase
          .from("products")
          .select(
            "id, title, product_variants(main_image_url, additional_image_urls, price, compare_at_price)",
          )
          .eq("store_id", storeId)
          // This same query feeds the PUBLIC storefront, so drafts stay out —
          // a half-finished listing with no price or photos is not something
          // a shopper should land on.
          .eq("status", "active")
          // Newest first, so which four products show is stable across loads
          // and reflects what the seller just listed.
          .order("created_at", { ascending: false })
          // Embedded rows come back in no guaranteed order otherwise, which
          // would let the tile's photo order — and the price below, taken
          // from the first variant — change between two loads of the same
          // product.
          .order("created_at", { referencedTable: "product_variants", ascending: true })
          .limit(4);
        if (cancelled) return;
        setTiles(
          error || !data
            ? []
            : data.map((p) => {
                const variants = p.product_variants ?? [];
                // Deliberately NOT de-duplicated across variants. A size run
                // repeats one photo across every row, so this does produce
                // stretches where swiping advances the tile's variant counter
                // without the picture changing — that is the intended read:
                // the counter tracks variants, and collapsing identical
                // photo sets would make it skip variants that genuinely
                // exist. A colourway run, where each variant carries its own
                // photo, is the case this shape is really for.
                const photos: TilePhoto[] = [];
                let variant = 0;
                for (const v of variants) {
                  const urls = gallery(v.main_image_url, v.additional_image_urls);
                  if (urls.length === 0) continue;
                  for (const url of urls) photos.push({ url, variant });
                  variant += 1;
                }
                return {
                  id: p.id,
                  title: p.title ?? "Untitled",
                  photos,
                  variantCount: variant,
                  price: variants[0]?.price ?? null,
                  compareAtPrice: variants[0]?.compare_at_price ?? null,
                };
              }),
        );
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, storeId]);

  return { tiles, loading };
}
