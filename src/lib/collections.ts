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
// "Delete with products" only ever targets one collection (the detail
// page's own action, not a bulk one) -- also deletes every product
// currently in it. product_tags has no ON DELETE CASCADE on product_id
// (unlike product_variants/product_options/product_collections/
// product_size_measurements, which all cascade — see
// store.products_.$id.tsx's handleDeleteProduct), so each product's tags
// must be cleared first or the products delete fails on the FK constraint.
export async function deleteCollection(
  collectionId: string | string[],
  withProducts: boolean,
): Promise<{ error: string | null }> {
  if (withProducts) {
    if (Array.isArray(collectionId)) {
      throw new Error("deleteCollection: withProducts only supports a single collection id");
    }
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

  const { error } = Array.isArray(collectionId)
    ? await supabase.from("collections").delete().in("id", collectionId)
    : await supabase.from("collections").delete().eq("id", collectionId);
  return { error: error?.message ?? null };
}
