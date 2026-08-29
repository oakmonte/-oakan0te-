import { useRef, useState } from "react";
import { Check, ChevronLeft, ImageIcon, X } from "lucide-react";
import type { VariantOption, VariantRow } from "./VariantMatrixBuilder";
import { stockTotal } from "./variant-stock";
import { ImageGallery } from "./ImageGallery";
import { DraftImagePickerSheet } from "./DraftImagePickerSheet";
import { ImageSourceSheet, type ImageSource } from "./ImageSourceSheet";
import { InventorySheet, type InventoryValues } from "./InventorySheet";
import { useMultiFilePicker } from "@/hooks/use-file-picker";
import { uploadProductImage } from "@/lib/upload-product-image";

export function VariantCombinationsSheet({
  options,
  rows,
  setRows,
  mainImageUrl,
  additionalImageUrls,
  storeId,
  onCreateLocation,
  onBack,
  onDone,
}: {
  options: VariantOption[];
  rows: VariantRow[];
  setRows: (fn: (prev: VariantRow[]) => VariantRow[]) => void;
  mainImageUrl: string;
  additionalImageUrls: string[];
  storeId: string;
  onCreateLocation: () => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const baseImages = mainImageUrl
    ? [mainImageUrl, ...additionalImageUrls.filter((u) => u !== mainImageUrl)]
    : additionalImageUrls;
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkImageUrl, setBulkImageUrl] = useState("");
  const [imagePickerKey, setImagePickerKey] = useState<string | null>(null);
  const [inventoryKey, setInventoryKey] = useState<string | null>(null);
  const [showPriceErrors, setShowPriceErrors] = useState(false);

  const optionNames = options
    .filter((o) => o.name.trim() && o.values.length > 0)
    .map((o) => o.name);
  const selected = rows.filter((r) => r.selected);
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const missingPrice = selected.some((r) => !r.price.trim());

  function updateRow(key: string, patch: Partial<VariantRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleRow(key: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)));
  }

  function toggleAll() {
    const next = !allSelected;
    setRows((prev) => prev.map((r) => ({ ...r, selected: next })));
  }

  // Only overwrite the fields the seller actually filled in, so applying a
  // price doesn't silently wipe stock counts they already entered by hand.
  // Untouched rows they've unchecked are left alone entirely.
  function applyToAll() {
    const patch: Partial<VariantRow> = {};
    if (bulkPrice.trim()) patch.price = bulkPrice.trim();
    if (bulkImageUrl.trim()) patch.mainImageUrl = bulkImageUrl.trim();
    if (Object.keys(patch).length === 0) return;
    setRows((prev) => prev.map((r) => (r.selected ? { ...r, ...patch } : r)));
    setBulkPrice("");
    setBulkImageUrl("");
    setBulkOpen(false);
  }

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col min-h-dvh">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button
          onClick={onBack}
          type="button"
          className="flex items-center gap-1 text-sm text-gray-500 -ml-1"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Variants
        </span>
        <button
          onClick={() => {
            if (missingPrice) {
              setShowPriceErrors(true);
              return;
            }
            onDone();
          }}
          type="button"
          disabled={selected.length === 0}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="px-4 pt-5 text-sm text-gray-500">
          These are all the possible combinations from the options you added. You don't have to
          create all of them — uncheck the ones that don't apply.
        </p>

        <div className="px-4 pt-4 flex items-center justify-between">
          <button type="button" onClick={toggleAll} className="text-xs text-gray-500">
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-gray-400">
            {selected.length} of {rows.length} selected
          </span>
        </div>

        {/* Overview table — one column per option, scrolls sideways rather than
            squeezing every option into the phone's width. */}
        {optionNames.length > 0 && (
          <div className="mt-3 overflow-x-auto border-y border-gray-100">
            <table className="min-w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 w-10" />
                  {optionNames.map((n) => (
                    <th
                      key={n}
                      className="px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap"
                    >
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.key)}
                        aria-label={`${row.selected ? "Deselect" : "Select"} ${row.options
                          .map((o) => o.value)
                          .join(" / ")}`}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          row.selected ? "bg-black border-black" : "border-gray-300 bg-white"
                        }`}
                      >
                        {row.selected && <Check size={13} className="text-white" />}
                      </button>
                    </td>
                    {row.options.map((o) => (
                      <td
                        key={o.name}
                        className={`px-4 py-3 text-[15px] whitespace-nowrap ${
                          row.selected ? "text-gray-900" : "text-gray-300"
                        }`}
                      >
                        {o.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Per-variant detail, selected rows only — no point asking for a price
            on a combination the seller just said they don't stock. */}
        <div className="px-4 py-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">Pricing &amp; stock</p>
            <button
              type="button"
              onClick={() => setBulkOpen((v) => !v)}
              className="text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5"
            >
              Apply to all
            </button>
          </div>

          {showPriceErrors && missingPrice && (
            <p className="text-xs text-red-500 mb-2">
              Add a price to every variant before continuing.
            </p>
          )}

          {bulkOpen && (
            <div className="border border-gray-200 rounded-xl p-3 mb-3 bg-gray-50">
              <p className="text-xs text-gray-500 mb-2">
                Fills every selected variant at once — you can still edit them individually after.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <MiniField label="Price" value={bulkPrice} onChange={setBulkPrice} />
                <MiniField
                  label="Image URL"
                  value={bulkImageUrl}
                  onChange={setBulkImageUrl}
                  type="text"
                />
              </div>
              <button
                type="button"
                onClick={applyToAll}
                disabled={!bulkPrice.trim() && !bulkImageUrl.trim()}
                className="mt-3 w-full bg-black text-white text-sm font-medium rounded-lg py-2.5 disabled:bg-gray-200 disabled:text-gray-400"
              >
                Apply
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {selected.map((row) => (
              <div key={row.key} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-900">
                    {row.options.map((o) => o.value).join(" / ")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setImagePickerKey(row.key)}
                    aria-label="Set variant image"
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0"
                  >
                    {row.mainImageUrl ? (
                      <img src={row.mainImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={16} className="text-gray-300" />
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniField
                    label="Price *"
                    value={row.price}
                    onChange={(v) => updateRow(row.key, { price: v })}
                    error={showPriceErrors && !row.price.trim()}
                  />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400">Stock</span>
                    <button
                      type="button"
                      onClick={() => setInventoryKey(row.key)}
                      className="text-base border border-gray-200 rounded-lg px-2 py-2 text-left"
                    >
                      {stockTotal(row)}
                    </button>
                  </label>
                  <MiniField
                    label="Compare-at"
                    value={row.compareAtPrice}
                    onChange={(v) => updateRow(row.key, { compareAtPrice: v })}
                  />
                  <MiniField
                    label="SKU"
                    value={row.sku}
                    onChange={(v) => updateRow(row.key, { sku: v })}
                    type="text"
                  />
                </div>
              </div>
            ))}

            {selected.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">
                Select at least one combination above.
              </p>
            )}
          </div>
        </div>
      </div>

      {imagePickerKey && (
        <VariantImagePopover
          initialValue={rows.find((r) => r.key === imagePickerKey)?.mainImageUrl ?? ""}
          initialAdditional={rows.find((r) => r.key === imagePickerKey)?.additionalImageUrls ?? []}
          baseImages={baseImages}
          onDone={(url, additional) => {
            updateRow(imagePickerKey, {
              mainImageUrl: url,
              additionalImageUrls: additional.length > 0 ? additional : null,
            });
            setImagePickerKey(null);
          }}
          onClose={() => setImagePickerKey(null)}
        />
      )}

      {inventoryKey &&
        (() => {
          const row = rows.find((r) => r.key === inventoryKey);
          if (!row) return null;
          return (
            <InventorySheet
              productLabel={row.options.map((o) => o.value).join(" / ")}
              storeId={storeId}
              initial={{
                continueSellingOutOfStock: row.continueSellingOutOfStock,
                locationQuantities: row.locationQuantities,
              }}
              onCreateLocation={onCreateLocation}
              onSave={(values: InventoryValues) => {
                updateRow(inventoryKey, {
                  continueSellingOutOfStock: values.continueSellingOutOfStock,
                  locationQuantities: values.locationQuantities,
                });
                setInventoryKey(null);
              }}
              onClose={() => setInventoryKey(null)}
            />
          );
        })()}
    </div>
  );
}

function VariantImagePopover({
  initialValue,
  initialAdditional,
  baseImages,
  onDone,
  onClose,
}: {
  initialValue: string;
  initialAdditional: string[];
  // Photos already uploaded on the base product page — shown as a one-tap
  // pool here so a seller assigning a variant image doesn't have to
  // re-upload something that's already sitting on the product.
  baseImages: string[];
  onDone: (url: string, additional: string[]) => void;
  onClose: () => void;
}) {
  const [images, setImages] = useState(
    initialValue ? [initialValue, ...initialAdditional] : initialAdditional,
  );
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const filePicker = useMultiFilePicker("image/*");
  const addButtonRef = useRef<HTMLButtonElement>(null);

  function openSourceSheet() {
    setAnchorRect(addButtonRef.current?.getBoundingClientRect() ?? null);
    setSourceSheetOpen(true);
  }

  function addUrls(urls: string[]) {
    if (urls.length === 0) return;
    setImages((prev) => [...prev, ...urls.filter((u) => !prev.includes(u))]);
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadError("");
    try {
      const urls = await Promise.all(files.map((f) => uploadProductImage(f)));
      addUrls(urls);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't upload one or more images");
    } finally {
      setUploading(false);
    }
  }

  async function handleSource(source: ImageSource) {
    setSourceSheetOpen(false);
    if (source === "drafts") {
      setDraftsOpen(true);
      return;
    }
    await uploadFiles(await filePicker.pick());
  }

  function handlePicked(urls: string[]) {
    setDraftsOpen(false);
    addUrls(urls);
  }

  // Tapping a base-product photo adds it to this variant; tapping it again
  // (it's already in this variant's list) removes just that assignment — the
  // photo itself stays on the base product either way.
  function toggleBaseImage(url: string) {
    if (images.includes(url)) {
      setImages((prev) => prev.filter((u) => u !== url));
    } else {
      addUrls([url]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-4 w-full max-w-xs animate-in fade-in zoom-in-95 duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {filePicker.node}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Variant image</p>
          <button type="button" onClick={onClose} className="p-1 -mr-1">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <ImageGallery
          images={images}
          onReorder={setImages}
          onRemove={(url) => setImages((prev) => prev.filter((u) => u !== url))}
          onAddTap={openSourceSheet}
          uploading={uploading}
          addButtonRef={addButtonRef}
        />

        {uploadError && <p className="text-xs text-red-500 text-center mt-2">{uploadError}</p>}

        {baseImages.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1.5">From your product photos</p>
            <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {baseImages.map((url) => {
                const selected = images.includes(url);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() => toggleBaseImage(url)}
                    aria-label={selected ? "Remove from variant" : "Add to variant"}
                    className="relative w-12 h-12 shrink-0 rounded-lg bg-gray-100 overflow-hidden"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {selected && (
                      <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Check size={16} className="text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onDone(images[0] ?? "", images.slice(1))}
          className="w-full bg-black text-white text-sm font-medium rounded-lg py-2.5 mt-3"
        >
          Done
        </button>

        {sourceSheetOpen && (
          <ImageSourceSheet
            anchorRect={anchorRect}
            onSelect={handleSource}
            onClose={() => setSourceSheetOpen(false)}
          />
        )}
        {draftsOpen && (
          <DraftImagePickerSheet onSelect={handlePicked} onClose={() => setDraftsOpen(false)} />
        )}
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  type = "number",
  error = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-xs ${error ? "text-red-500" : "text-gray-400"}`}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-base border rounded-lg px-2 py-2 outline-none ${
          error ? "border-red-300" : "border-gray-200"
        }`}
      />
    </label>
  );
}
