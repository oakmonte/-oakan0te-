import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export type PreviewTile = {
  id: string;
  title: string;
  /** Every photo the seller uploaded for this tile, cover first. One entry
   * is the normal case; more than one is what turns the tile into a
   * swipeable carousel (see TileCarousel in full-preview-blocks.tsx). Empty
   * means "no photo at all" — the caller substitutes its placeholder. */
  images: string[];
  price: number | null;
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
                images: gallery(c.image_url, c.additional_image_urls),
                price: null,
              })),
        );
      } else {
        const { data, error } = await supabase
          .from("products")
          .select("id, title, product_variants(main_image_url, additional_image_urls, price)")
          .eq("store_id", storeId)
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
                // Every variant's photos, not just the first one's: a size
                // run repeats one image across all its variants (deduped
                // away here), while a colourway run carries a genuinely
                // different photo per variant, which is exactly what makes
                // the tile worth swiping.
                const images = [
                  ...new Set(
                    variants.flatMap((v) => gallery(v.main_image_url, v.additional_image_urls)),
                  ),
                ];
                return {
                  id: p.id,
                  title: p.title ?? "Untitled",
                  images,
                  price: variants[0]?.price ?? null,
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
