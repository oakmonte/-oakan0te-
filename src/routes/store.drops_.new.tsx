import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Layers, Shirt } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { MediaSection } from "@/components/product-form/MediaSection";
import { ProductsSheet } from "@/components/product-form/ProductsSheet";
import { CollectionPickerSheet } from "@/components/product-form/CollectionPickerSheet";
import { Switch } from "@/components/ui/switch";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { hasPendingUploads } from "@/lib/background-upload";

export const Route = createFileRoute("/store/drops_/new")({
  component: NewDrop,
});

const RETURN_TO = { to: "/store/products", search: { tab: "Drops" } } as const;

type SourceMode = "collection" | "products";

function NewDrop() {
  const navigate = useNavigate();
  const { storeId } = useActiveStoreId();

  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<SourceMode | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [collectionTitle, setCollectionTitle] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [productsSheetOpen, setProductsSheetOpen] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Set once the `drops` row itself is created -- lets a failed
  // drop_products-attach step be retried on its own (tap Save again)
  // without re-inserting the drop and creating a duplicate. Same pattern as
  // createdCollectionId in store.collections_.new.tsx.
  const [createdDropId, setCreatedDropId] = useState<string | null>(null);

  async function handleSave() {
    if (!storeId) {
      setError("No store found on this account");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (mode === "collection" && !collectionId) {
      setError("Pick a collection");
      return;
    }
    if (mode === "products" && productIds.length === 0) {
      setError("Pick at least one product");
      return;
    }
    if (mode === null) {
      setError("Choose what this drop is for");
      return;
    }
    if (timerEnabled && startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setError("End time must be after the start time");
      return;
    }

    // Same reasoning as the product/collection forms: a still-uploading
    // cover currently holds an object-URL preview, and saving now would
    // write that blob: url straight into the database instead of the real
    // one.
    if (hasPendingUploads()) {
      setError("Wait for your photo to finish uploading before saving");
      return;
    }
    if (imageUrl.startsWith("blob:")) {
      setError("Your photo didn't finish uploading — remove and re-add it");
      return;
    }

    setSaving(true);
    setError("");

    let dropId = createdDropId;
    const dropFields = {
      title: title.trim(),
      cover_image_url: imageUrl.trim() || null,
      collection_id: mode === "collection" ? collectionId : null,
      starts_at: timerEnabled && startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: timerEnabled && endsAt ? new Date(endsAt).toISOString() : null,
    };
    if (!dropId) {
      const { data: created, error: insertErr } = await supabase
        .from("drops")
        .insert({ store_id: storeId, ...dropFields })
        .select("id")
        .single();
      if (insertErr || !created) {
        setError(insertErr?.message ?? "Failed to create drop");
        setSaving(false);
        return;
      }
      dropId = created.id;
      setCreatedDropId(created.id);
    } else {
      const { data: updated, error: updateErr } = await supabase
        .from("drops")
        .update(dropFields)
        .eq("id", dropId)
        .eq("store_id", storeId)
        .select("id");
      if (updateErr || !updated || updated.length === 0) {
        setError(updateErr?.message ?? "Couldn't save — the drop may have been deleted");
        setSaving(false);
        return;
      }
    }

    // Unconditional, not just in products mode -- a retry that switched mode
    // (products -> collection) after a dropped connection would otherwise
    // leave the earlier product-set rows behind alongside the now-set
    // collection_id, same idempotent-retry reasoning as product_collections
    // in the collections form.
    const { error: unlinkErr } = await supabase
      .from("drop_products")
      .delete()
      .eq("drop_id", dropId);
    if (unlinkErr) {
      setError("Drop created, but couldn't update the selected products — tap Save to retry.");
      setSaving(false);
      return;
    }
    if (mode === "products") {
      const { error: linkErr } = await supabase
        .from("drop_products")
        .insert(productIds.map((product_id) => ({ product_id, drop_id: dropId })));
      if (linkErr) {
        setError("Drop created, but couldn't add the selected products — tap Save to retry.");
        setSaving(false);
        return;
      }
    }

    navigate(RETURN_TO);
  }

  return (
    <div className="min-h-dvh bg-sd-surface pb-10">
      <div className="sticky top-14 z-20 bg-sd-surface/95 backdrop-blur border-b border-sd-line px-4 h-14 flex items-center justify-between">
        <BackButton
          icon="chevron"
          size={18}
          label="Cancel"
          ariaLabel="Cancel"
          to={RETURN_TO}
          className="text-sm text-sd-ink-muted flex items-center gap-0.5 -ml-1"
        />
        <span className="font-semibold text-[15px]">New Drop</span>
        <button
          onClick={handleSave}
          disabled={saving || !storeId}
          type="button"
          className="text-sm font-medium text-sd-ink disabled:text-sd-ink-faint"
        >
          Save
        </button>
      </div>

      {error && (
        <p className="px-4 pt-3 text-sm text-sd-danger-ink animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}

      <div className="mx-4 mt-4 rounded-2xl border border-sd-line bg-sd-surface overflow-hidden">
        <MediaSection mainImageUrl={imageUrl} onChange={setImageUrl} noDivider />
        <div className="border-t border-sd-line px-4 py-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Drop title"
            className="w-full text-2xl font-semibold text-sd-ink placeholder:text-sd-ink-muted outline-none"
          />
        </div>
      </div>

      <div className="mx-4 mt-3 rounded-2xl border border-sd-line bg-sd-surface p-4">
        <p className="text-xs font-medium text-sd-ink-faint mb-3 uppercase tracking-wide">
          What's in this drop?
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode("collection")}
            className={`flex flex-col items-center gap-2 rounded-xl border py-4 oak-motion-control active:scale-[0.98] ${
              mode === "collection" ? "border-sd-ink bg-sd-soft" : "border-sd-line"
            }`}
          >
            <Layers size={18} className="text-sd-ink" />
            <span className="text-sm font-medium text-sd-ink">A collection</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("products")}
            className={`flex flex-col items-center gap-2 rounded-xl border py-4 oak-motion-control active:scale-[0.98] ${
              mode === "products" ? "border-sd-ink bg-sd-soft" : "border-sd-line"
            }`}
          >
            <Shirt size={18} className="text-sd-ink" />
            <span className="text-sm font-medium text-sd-ink">Specific products</span>
          </button>
        </div>

        {mode === "collection" && (
          <button
            type="button"
            onClick={() => setCollectionPickerOpen(true)}
            className="w-full flex items-center justify-between py-3 text-left animate-in fade-in duration-200"
          >
            <span className="text-[15px] text-sd-ink">
              {collectionTitle ?? "Pick a collection"}
            </span>
            <ChevronRight size={16} className="text-sd-ink-faint shrink-0" />
          </button>
        )}

        {mode === "products" && (
          <button
            type="button"
            onClick={() => setProductsSheetOpen(true)}
            className="w-full flex items-center justify-between py-3 text-left animate-in fade-in duration-200"
          >
            <span className="text-[15px] text-sd-ink">
              {productIds.length > 0
                ? `${productIds.length} product${productIds.length === 1 ? "" : "s"} selected`
                : "Pick products"}
            </span>
            <ChevronRight size={16} className="text-sd-ink-faint shrink-0" />
          </button>
        )}
      </div>

      <div className="mx-4 mt-3 rounded-2xl border border-sd-line bg-sd-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px] text-sd-ink">Set a timer</p>
            <p className="text-xs text-sd-ink-faint mt-0.5">
              {timerEnabled
                ? "Release or end this drop at a set time"
                : "Announce as new, live right away"}
            </p>
          </div>
          <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
        </div>

        {timerEnabled && (
          <div className="mt-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-sd-ink-faint">
                Starts (optional — leave blank to go live now)
              </span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="rounded-lg border border-sd-line px-3 py-2 text-sm text-sd-ink bg-sd-surface"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-sd-ink-faint">
                Ends (optional — leave blank to never expire)
              </span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="rounded-lg border border-sd-line px-3 py-2 text-sm text-sd-ink bg-sd-surface"
              />
            </label>
          </div>
        )}
      </div>

      {collectionPickerOpen && storeId && (
        <CollectionPickerSheetWithTitle
          storeId={storeId}
          selectedId={collectionId}
          onDone={(id, pickedTitle) => {
            setCollectionId(id);
            setCollectionTitle(pickedTitle);
            setCollectionPickerOpen(false);
          }}
          onClose={() => setCollectionPickerOpen(false)}
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

// CollectionPickerSheet reports only the id -- this wraps it to also resolve
// the title for the summary row above, without duplicating the sheet's own
// fetch or exposing a whole collection object through its public API.
function CollectionPickerSheetWithTitle({
  storeId,
  selectedId,
  onDone,
  onClose,
}: {
  storeId: string;
  selectedId: string | null;
  onDone: (id: string | null, title: string | null) => void;
  onClose: () => void;
}) {
  return (
    <CollectionPickerSheet
      storeId={storeId}
      selectedId={selectedId}
      onClose={onClose}
      onDone={async (id) => {
        if (!id) {
          onDone(null, null);
          return;
        }
        const { data } = await supabase
          .from("collections")
          .select("title")
          .eq("id", id)
          .maybeSingle();
        onDone(id, data?.title ?? null);
      }}
    />
  );
}
