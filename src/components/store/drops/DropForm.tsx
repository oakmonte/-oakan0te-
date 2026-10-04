import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { DROPS_RETURN_TO, saveDrop, type DropFormValues } from "@/lib/drop-form";
import { ProductsSheet } from "@/components/product-form/ProductsSheet";
import { CollectionsSheet } from "@/components/product-form/CollectionsSheet";
import { DateTimeField } from "./DateTimeField";

export function DropForm({
  heading,
  storeId,
  dropId,
  initial,
  footer,
}: {
  heading: string;
  storeId: string;
  /** null for a new drop. */
  dropId: string | null;
  initial: DropFormValues;
  /** Extra content under the form, e.g. the edit page's Delete button. */
  footer?: ReactNode;
}) {
  const navigate = useNavigate();
  const [v, setV] = useState(initial);
  const [savedId, setSavedId] = useState(dropId);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof DropFormValues>(k: K, val: DropFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  async function handleSave() {
    if (!v.title.trim()) return setError("Give the drop a name");
    if (v.collectionIds.length === 0 && v.productIds.length === 0)
      return setError("Add at least one collection or product");
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt)
      return setError("The end has to be after the start");
    setSaving(true);
    setError("");
    const { id, error: err } = await saveDrop(storeId, savedId, v);
    if (id) setSavedId(id);
    setSaving(false);
    if (err) return setError(err);
    navigate(DROPS_RETURN_TO);
  }

  const count = (n: number, noun: string) =>
    n === 0 ? "None" : `${n} ${noun}${n === 1 ? "" : "s"}`;

  return (
    <div className="min-h-dvh bg-sd-surface pb-10">
      <div className="sticky top-14 z-20 bg-sd-surface/95 backdrop-blur border-b border-sd-line px-4 h-14 flex items-center justify-between">
        <BackButton
          icon="chevron"
          size={18}
          label="Cancel"
          ariaLabel="Cancel"
          to={DROPS_RETURN_TO}
          className="text-sm text-sd-ink-muted flex items-center gap-0.5 -ml-1"
        />
        <span className="font-semibold text-[15px]">{heading}</span>
        <button
          onClick={handleSave}
          disabled={saving}
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

      <div className="mx-4 mt-4 rounded-2xl border border-sd-line bg-sd-surface px-4 py-4">
        <input
          value={v.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Drop name"
          className="w-full bg-transparent text-2xl font-semibold text-sd-ink placeholder:text-sd-ink-muted outline-none"
        />
      </div>

      <p className="mx-5 mt-5 mb-2 text-xs font-medium text-sd-ink-faint uppercase tracking-wide">
        What's in this drop
      </p>
      <div className="mx-4 rounded-2xl border border-sd-line bg-sd-surface px-4 divide-y divide-sd-line">
        <button
          type="button"
          onClick={() => setCollectionsOpen(true)}
          className="w-full flex items-center justify-between py-3.5 text-left"
        >
          <span className="text-[15px] text-sd-ink">Collections</span>
          <span className="flex items-center gap-1 text-sm text-sd-ink-faint">
            {count(v.collectionIds.length, "collection")}
            <ChevronRight size={16} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => setProductsOpen(true)}
          className="w-full flex items-center justify-between py-3.5 text-left"
        >
          <span className="text-[15px] text-sd-ink">Products</span>
          <span className="flex items-center gap-1 text-sm text-sd-ink-faint">
            {count(v.productIds.length, "product")}
            <ChevronRight size={16} />
          </span>
        </button>
      </div>

      <p className="mx-5 mt-5 mb-2 text-xs font-medium text-sd-ink-faint uppercase tracking-wide">
        Timer
      </p>
      <div className="mx-4 rounded-2xl border border-sd-line bg-sd-surface px-4 divide-y divide-sd-line">
        <DateTimeField
          label="Starts"
          emptyLabel="Right away"
          value={v.startsAt}
          onChange={(d) => set("startsAt", d)}
        />
        <DateTimeField
          label="Ends"
          emptyLabel="Never"
          value={v.endsAt}
          min={v.startsAt}
          onChange={(d) => set("endsAt", d)}
        />
      </div>

      {footer}

      {collectionsOpen && (
        <CollectionsSheet
          storeId={storeId}
          selectedIds={v.collectionIds}
          onDone={(ids) => {
            set("collectionIds", ids);
            setCollectionsOpen(false);
          }}
          onClose={() => setCollectionsOpen(false)}
          onCreateNew={() => navigate({ to: "/store/collections/new" })}
        />
      )}
      {productsOpen && (
        <ProductsSheet
          storeId={storeId}
          selectedIds={v.productIds}
          onDone={(ids) => {
            set("productIds", ids);
            setProductsOpen(false);
          }}
          onClose={() => setProductsOpen(false)}
        />
      )}
    </div>
  );
}
