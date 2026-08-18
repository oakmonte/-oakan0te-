import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { VariantRow } from "./VariantMatrixBuilder";

export function VariantCombinationsSheet({
  rows,
  setRows,
  onBack,
  onDone,
}: {
  rows: VariantRow[];
  setRows: (fn: (prev: VariantRow[]) => VariantRow[]) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  function updateRow(key: string, patch: Partial<VariantRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Only overwrite the fields the seller actually filled in, so applying a
  // price doesn't silently wipe stock counts they already entered by hand.
  function applyToAll() {
    const patch: Partial<VariantRow> = {};
    if (bulkPrice.trim()) patch.price = bulkPrice.trim();
    if (bulkStock.trim()) patch.stockQty = bulkStock.trim();
    if (Object.keys(patch).length === 0) return;
    setRows((prev) => prev.map((r) => ({ ...r, ...patch })));
    setBulkPrice("");
    setBulkStock("");
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
        <button onClick={onDone} type="button" className="text-sm font-medium text-black">
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-400">{rows.length} variants</p>
          <button
            type="button"
            onClick={() => setBulkOpen((v) => !v)}
            className="text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5"
          >
            Apply to all
          </button>
        </div>

        {bulkOpen && (
          <div className="border border-gray-200 rounded-xl p-3 mb-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2">
              Fill every variant at once — you can still edit them individually after.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <MiniField label="Price" value={bulkPrice} onChange={setBulkPrice} />
              <MiniField label="Stock" value={bulkStock} onChange={setBulkStock} />
            </div>
            <button
              type="button"
              onClick={applyToAll}
              disabled={!bulkPrice.trim() && !bulkStock.trim()}
              className="mt-3 w-full bg-black text-white text-sm font-medium rounded-lg py-2.5 disabled:bg-gray-200 disabled:text-gray-400"
            >
              Apply
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.key} className="border border-gray-200 rounded-xl p-3">
              <p className="text-sm font-medium text-gray-900 mb-2">
                {row.option1Value}
                {row.option2Value ? ` / ${row.option2Value}` : ""}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <MiniField
                  label="Price *"
                  value={row.price}
                  onChange={(v) => updateRow(row.key, { price: v })}
                />
                <MiniField
                  label="Stock"
                  value={row.stockQty}
                  onChange={(v) => updateRow(row.key, { stockQty: v })}
                />
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
        </div>
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  type = "number",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-base border border-gray-200 rounded-lg px-2 py-2 outline-none"
      />
    </label>
  );
}
