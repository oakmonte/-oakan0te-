import { supabase } from "@/lib/integrations/my-supabase/client";

// Shared between the collections list (single or bulk multi-select) and a
// single collection's detail page, so "delete collection only" and "delete
// collection + its products" stay in one place.
//
// "Delete collection only": just remove the collections row(s).
// product_collections cascades on collection_id, so membership rows
// disappear too; the products themselves are untouched. Accepts one id or
// several -- the bulk multi-select case is a single .in() delete, not N
// round trips.
//
// "Delete with products" also deletes every product currently in the
// collection(s) -- one collection or a bulk selection. product_tags has no ON DELETE CASCADE on product_id
// (unlike product_variants/product_options/product_collections/
// product_size_measurements, which all cascade — see
// store.products_.$id.tsx's handleDeleteProduct), so each product's tags
// must be cleared first or the products delete fails on the FK constraint.
export async function deleteCollection(
  collectionId: string | string[],
  withProducts: boolean,
): Promise<{ error: string | null }> {
  const ids = Array.isArray(collectionId) ? collectionId : [collectionId];
  if (withProducts) {
    const { data: links, error: linksErr } = await supabase
      .from("product_collections")
      .select("product_id")
      .in("collection_id", ids);
    if (linksErr) return { error: linksErr.message };

    // A product in two of the selected collections appears twice.
    const productIds = [...new Set((links ?? []).map((l) => l.product_id))];
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

  const { error } = await supabase.from("collections").delete().in("id", ids);
  return { error: error?.message ?? null };
}
