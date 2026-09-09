import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Check, Plus } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { MediaSection } from "@/components/product-form/MediaSection";
import { DescriptionSheet } from "@/components/product-form/DescriptionSheet";
import { ProductsSheet } from "@/components/product-form/ProductsSheet";
import {
  hasPendingProductDraft,
  peekPendingProductDraftId,
  setPendingNewCollectionId,
} from "@/lib/product-draft-handoff";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { hasPendingUploads } from "@/lib/background-upload";

export const Route = createFileRoute("/store/collections_/new")({
  component: NewCollection,
});

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function NewCollection() {
  const navigate = useNavigate();
  const { storeId } = useActiveStoreId();

  const [imageUrl, setImageUrl] = useState("");
  const [additionalImageUrls, setAdditionalImageUrls] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); // HTML
  const [descriptionSheetOpen, setDescriptionSheetOpen] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productsSheetOpen, setProductsSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Set once the `collections` row itself is created -- lets a failed
  // product-attach step be retried on its own (tap Save again) without
  // re-inserting the collection and creating a duplicate.
  const [createdCollectionId, setCreatedCollectionId] = useState<string | null>(null);

  const hasDescription = stripHtml(description).length > 0;
  // Reached from the new-product OR the edit-product form's Collections
  // picker — return to whichever one stashed a draft (with it intact) instead
  // of the products list, both on save and on cancel, so the in-progress
  // listing isn't lost. peekPendingProductDraftId (not takeProductDraft) is
  // deliberate: only the destination page should consume the draft, this is
  // just reading where "destination" is.
  const editingProductId = peekPendingProductDraftId();
  const returnTo = hasPendingProductDraft()
    ? editingProductId
      ? `/store/products/${editingProductId}`
      : "/store/products/new"
    : "/store/collections";

  async function handleSave() {
    if (!storeId) {
      setError("No store found on this account");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    // Same reasoning as the product form: a still-uploading photo's field
    // currently holds an object-URL preview (see MediaSection's
    // background-upload use), and saving now would write that blob: url
    // straight into the database instead of the real one.
    if (hasPendingUploads()) {
      setError("Wait for your photos to finish uploading before saving");
      return;
    }
    // Backstop for hasPendingUploads() above: that only reports uploads
    // still IN FLIGHT, so a photo whose upload already failed (or that was
    // dismissed from the toast) has fallen out of it entirely, while its
    // object-URL preview is still sitting in imageUrl/additionalImageUrls --
    // saving now would write that dead blob: url straight into the row,
    // permanently broken for every buyer and every other device.
    if (imageUrl.startsWith("blob:") || additionalImageUrls.some((u) => u.startsWith("blob:"))) {
      setError("One of your photos didn't finish uploading — remove and re-add it");
      return;
    }

    setSaving(true);
    setError("");

    // A retry after the product-attach step below failed skips straight to
    // that step instead of re-inserting the collection -- same title twice
    // would otherwise create a duplicate. Still writes an update on a retry
    // (not a bare skip) so any edit made between the failed attempt and
    // tapping Save again -- fixing a typo, swapping the cover photo -- isn't
    // silently dropped just because the row already exists.
    let collectionId = createdCollectionId;
    const collectionFields = {
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      additional_image_urls: additionalImageUrls.length > 0 ? additionalImageUrls : null,
    };
    if (!collectionId) {
      const { data: created, error: insertErr } = await supabase
        .from("collections")
        .insert({ store_id: storeId, ...collectionFields })
        .select("id")
        .single();

      if (insertErr || !created) {
        setError(insertErr?.message ?? "Failed to create collection");
        setSaving(false);
        return;
      }
      collectionId = created.id;
      setCreatedCollectionId(created.id);
    } else {
      // .select() so a zero-row match (same PostgREST "success on zero rows"
      // trap fixed for deleteProducts) surfaces instead of silently no-op'ing.
      const { data: updated, error: updateErr } = await supabase
        .from("collections")
        .update(collectionFields)
        .eq("id", collectionId)
        .select("id");
      if (updateErr || !updated || updated.length === 0) {
        setError(updateErr?.message ?? "Couldn't save — the collection may have been deleted");
        setSaving(false);
        return;
      }
    }

    // Replace (delete-then-insert), not append -- makes this idempotent on a
    // retry after a dropped connection (re-inserting the same links would
    // duplicate-key-fail or double them, and the seller could also have
    // deselected a product since the failed attempt, which an append-only
    // insert would never detach).
    const { error: unlinkErr } = await supabase
      .from("product_collections")
      .delete()
      .eq("collection_id", collectionId);
    if (unlinkErr) {
      setError(
        "Collection created, but couldn't update the selected products — tap Save to retry.",
      );
      setSaving(false);
      return;
    }
    if (productIds.length > 0) {
      const { error: linkErr } = await supabase
        .from("product_collections")
        .insert(productIds.map((product_id) => ({ product_id, collection_id: collectionId })));
      if (linkErr) {
        // The collection itself is real at this point -- surfacing the
        // error and staying (rather than navigating away as if nothing was
        // wrong) is what lets the seller retry just this step instead of
        // walking away thinking their product picks were saved when the
        // collection is actually still empty.
        setError("Collection created, but couldn't add the selected products — tap Save to retry.");
        setSaving(false);
        return;
      }
    }

    // Both destinations restore collectionIds off the stashed draft, then
    // append this one before rendering — same handoff either way.
    if (hasPendingProductDraft()) {
      setPendingNewCollectionId(collectionId);
    }

    navigate({ to: returnTo });
  }

  return (
    <div className="min-h-dvh bg-white pb-10">
      <div className="sticky top-14 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: returnTo })}
          className="text-sm text-gray-500 flex items-center gap-0.5 -ml-1"
          type="button"
        >
          <ChevronLeft size={18} />
          Cancel
        </button>
        <span className="font-semibold text-[15px]">New Collection</span>
        <button
          onClick={handleSave}
          disabled={saving || !storeId}
          type="button"
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Save
        </button>
      </div>

      {error && (
        <p className="px-4 pt-3 text-sm text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}

      <MediaSection
        mainImageUrl={imageUrl}
        onChange={setImageUrl}
        additionalImageUrls={additionalImageUrls}
        onAdditionalChange={setAdditionalImageUrls}
      />

      <div className="px-4 py-4 border-b-8 border-gray-50">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Collection title"
          className="w-full text-2xl font-semibold text-gray-900 placeholder:text-gray-600 outline-none pb-3 border-b border-gray-100"
        />

        <button
          type="button"
          onClick={() => setDescriptionSheetOpen(true)}
          className="w-full flex items-center justify-between py-4 text-left"
        >
          <span className="flex items-center gap-3 text-[15px] text-gray-900">
            {hasDescription ? (
              <Check size={18} className="text-gray-900" />
            ) : (
              <Plus size={18} className="text-gray-400" />
            )}
            {hasDescription ? "Description" : "Add description"}
          </span>
          <ChevronRight size={16} className="text-gray-300 shrink-0" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setProductsSheetOpen(true)}
        className="w-full flex items-center justify-between px-4 py-4 border-b-8 border-gray-50 text-left"
      >
        <span className="text-[15px] text-gray-900">Products</span>
        <span className="flex items-center gap-1 shrink-0">
          {productIds.length > 0 && (
            <span className="text-xs text-gray-400">{productIds.length} selected</span>
          )}
          <ChevronRight size={16} className="text-gray-300" />
        </span>
      </button>

      {descriptionSheetOpen && (
        <DescriptionSheet
          value={description}
          placeholder="Describe your collection and try to answer questions you know your customers will ask."
          onSave={(html) => {
            setDescription(html);
            setDescriptionSheetOpen(false);
          }}
          onClose={() => setDescriptionSheetOpen(false)}
        />
      )}

      {productsSheetOpen && storeId && (
        <ProductsSheet
          storeId={storeId}
          selectedIds={productIds}
          onDone={(ids) => {
            setProductIds(ids);
            setProductsSheetOpen(false);
          }}
          onClose={() => setProductsSheetOpen(false)}
        />
      )}
    </div>
  );
}
