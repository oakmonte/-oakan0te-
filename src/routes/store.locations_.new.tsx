import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { LocationSheet, type StoreLocationValues } from "@/components/store/LocationSheet";
import {
  hasPendingProductDraft,
  peekPendingProductDraftId,
  setPendingNewLocationId,
} from "@/lib/product-draft-handoff";
import { useActiveStoreId } from "@/hooks/use-own-store";

export const Route = createFileRoute("/store/locations_/new")({
  component: NewLocation,
});

function NewLocation() {
  const navigate = useNavigate();
  const { storeId } = useActiveStoreId();

  // Reached from the product form's Inventory sheet ("Add pickup location")
  // as well as directly from Pickup locations on the store home — same
  // return-to-caller pattern as store.collections_.new.tsx.
  const editingProductId = peekPendingProductDraftId();
  const returnTo = hasPendingProductDraft()
    ? editingProductId
      ? `/store/products/${editingProductId}`
      : "/store/products/new"
    : "/store";

  async function handleSave(values: StoreLocationValues) {
    if (!storeId) return;
    const { data: created, error } = await supabase
      .from("store_locations")
      .insert({
        store_id: storeId,
        name: values.name,
        address_line: values.addressLine || null,
        address_line2: values.addressLine2 || null,
        city: values.city || null,
        state: values.state || null,
        country: values.country || null,
        postal_code: values.postalCode || null,
        lat: values.lat,
        lng: values.lng,
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("NewLocation: failed to create location", error);
      return;
    }
    if (hasPendingProductDraft()) {
      setPendingNewLocationId(created.id);
    }
    navigate({ to: returnTo });
  }

  return (
    <LocationSheet initial={null} onSave={handleSave} onClose={() => navigate({ to: returnTo })} />
  );
}
