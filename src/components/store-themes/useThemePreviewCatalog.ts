import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export type PreviewTile = {
  id: string;
  title: string;
  image_url: string | null;
  price: number | null;
};

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
          .select("id, title, image_url")
          .eq("store_id", storeId)
          .limit(4);
        if (cancelled) return;
        setTiles(
          error || !data
            ? []
            : data.map((c) => ({ id: c.id, title: c.title, image_url: c.image_url, price: null })),
        );
      } else {
        const { data, error } = await supabase
          .from("products")
          .select("id, title, product_variants(main_image_url, price)")
          .eq("store_id", storeId)
          .limit(4);
        if (cancelled) return;
        setTiles(
          error || !data
            ? []
            : data.map((p) => ({
                id: p.id,
                title: p.title ?? "Untitled",
                image_url: p.product_variants?.[0]?.main_image_url ?? null,
                price: p.product_variants?.[0]?.price ?? null,
              })),
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
