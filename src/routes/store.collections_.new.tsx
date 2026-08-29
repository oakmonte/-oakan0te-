import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { MediaSection } from "@/components/product-form/MediaSection";
import { DescriptionSheet } from "@/components/product-form/DescriptionSheet";
import {
  hasPendingProductDraft,
  peekPendingProductDraftId,
  setPendingNewCollectionId,
} from "@/lib/product-draft-handoff";
import { useActiveStoreId } from "@/hooks/use-own-store";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); // HTML
  const [descriptionSheetOpen, setDescriptionSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

    setSaving(true);
    setError("");

    const { data: created, error: insertErr } = await supabase
      .from("collections")
      .insert({
        store_id: storeId,
        title: title.trim(),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
      })
      .select("id")
      .single();

    if (insertErr || !created) {
      setError(insertErr?.message ?? "Failed to create collection");
      setSaving(false);
      return;
    }

    // Both destinations restore collectionIds off the stashed draft, then
    // append this one before rendering — same handoff either way.
    if (hasPendingProductDraft()) {
      setPendingNewCollectionId(created.id);
    }

    navigate({ to: returnTo });
  }

  return (
    <div className="min-h-dvh bg-white pb-10">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
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

      <MediaSection mainImageUrl={imageUrl} onChange={setImageUrl} />

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
          <span className="text-[15px] text-gray-900">
            {hasDescription ? "Description" : "Add description"}
          </span>
          <ChevronRight size={16} className="text-gray-300 shrink-0" />
        </button>
      </div>

      {descriptionSheetOpen && (
        <DescriptionSheet
          value={description}
          onSave={(html) => {
            setDescription(html);
            setDescriptionSheetOpen(false);
          }}
          onClose={() => setDescriptionSheetOpen(false)}
        />
      )}
    </div>
  );
}
