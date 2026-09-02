import { supabase } from "@/lib/integrations/my-supabase/client";

// Shared between the collections list and a single collection's detail page,
// so both "delete collection only" and "delete collection + its products"
// stay in one place.
//
// "Delete collection only": just remove the collections row. product_collections
// cascades on collection_id, so membership rows disappear too; the products
// themselves are untouched.
//
// "Delete with products": also deletes every product currently in this
// collection. product_tags has no ON DELETE CASCADE on product_id (unlike
// product_variants/product_options/product_collections/product_size_measurements,
// which all cascade — see store.products_.$id.tsx's handleDeleteProduct), so
// each product's tags must be cleared first or the products delete fails on
// the FK constraint.
export async function deleteCollection(
  collectionId: string,
  withProducts: boolean,
): Promise<{ error: string | null }> {
  if (withProducts) {
    const { data: links, error: linksErr } = await supabase
      .from("product_collections")
      .select("product_id")
      .eq("collection_id", collectionId);
    if (linksErr) return { error: linksErr.message };

    const productIds = (links ?? []).map((l) => l.product_id);
    if (productIds.length > 0) {
      const { error: tagsErr } = await supabase
        .from("product_tags")
        .delete()
        .in("product_id", productIds);
      if (tagsErr) return { error: tagsErr.message };

      const { error: productsErr } = await supabase.from("products").delete().in("id", productIds);
      if (productsErr) return { error: productsErr.message };
    }
  }

  const { error } = await supabase.from("collections").delete().eq("id", collectionId);
  return { error: error?.message ?? null };
}
