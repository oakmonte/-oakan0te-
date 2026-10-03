import { supabase } from "@/lib/integrations/my-supabase/client";

export const DROPS_RETURN_TO = { to: "/store/products", search: { tab: "Drops" } } as const;

export type DropFormValues = {
  title: string;
  collectionIds: string[];
  productIds: string[];
  startsAt: Date | null;
  endsAt: Date | null;
};

export const EMPTY_DROP: DropFormValues = {
  title: "",
  collectionIds: [],
  productIds: [],
  startsAt: null,
  endsAt: null,
};

/** Loads an existing drop into form values, scoped to the store (RLS is off
 *  on `drops`, so a guessed id would otherwise resolve). */
export async function loadDrop(id: string, storeId: string): Promise<DropFormValues | null> {
  const { data } = await supabase
    .from("drops")
    .select("title, starts_at, ends_at, drop_collections(collection_id), drop_products(product_id)")
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data) return null;
  return {
    title: data.title,
    collectionIds: (data.drop_collections ?? []).map((l) => l.collection_id),
    productIds: (data.drop_products ?? []).map((l) => l.product_id),
    startsAt: data.starts_at ? new Date(data.starts_at) : null,
    endsAt: data.ends_at ? new Date(data.ends_at) : null,
  };
}

/** Creates (dropId null) or updates a drop and replaces both link sets.
 *  Returns the drop's id even when a link step fails, so a retry updates the
 *  same row instead of inserting a duplicate. */
export async function saveDrop(
  storeId: string,
  dropId: string | null,
  v: DropFormValues,
): Promise<{ id: string | null; error: string | null }> {
  const fields = {
    title: v.title.trim(),
    starts_at: v.startsAt?.toISOString() ?? null,
    ends_at: v.endsAt?.toISOString() ?? null,
    collection_id: null,
  };
  let id = dropId;
  if (!id) {
    const { data, error } = await supabase
      .from("drops")
      .insert({ store_id: storeId, ...fields })
      .select("id")
      .single();
    if (error || !data) return { id: null, error: error?.message ?? "Failed to create drop" };
    id = data.id;
  } else {
    const { data, error } = await supabase
      .from("drops")
      .update(fields)
      .eq("id", id)
      .eq("store_id", storeId)
      .select("id");
    if (error || !data?.length)
      return { id, error: error?.message ?? "Couldn't save — the drop may have been deleted" };
  }

  const [delC, delP] = await Promise.all([
    supabase.from("drop_collections").delete().eq("drop_id", id),
    supabase.from("drop_products").delete().eq("drop_id", id),
  ]);
  if (delC.error || delP.error)
    return { id, error: "Couldn't update what's in the drop — tap Save to retry." };
  const dropIdFinal = id;
  const [insC, insP] = await Promise.all([
    v.collectionIds.length
      ? supabase
          .from("drop_collections")
          .insert(v.collectionIds.map((collection_id) => ({ drop_id: dropIdFinal, collection_id })))
      : Promise.resolve({ error: null }),
    v.productIds.length
      ? supabase
          .from("drop_products")
          .insert(v.productIds.map((product_id) => ({ drop_id: dropIdFinal, product_id })))
      : Promise.resolve({ error: null }),
  ]);
  if (insC.error || insP.error)
    return { id, error: "Couldn't add what's in the drop — tap Save to retry." };
  return { id, error: null };
}
