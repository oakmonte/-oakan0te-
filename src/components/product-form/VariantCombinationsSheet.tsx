import { useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import type { VariantOption, VariantRow } from "./VariantMatrixBuilder";

export function VariantCombinationsSheet({
  options,
  rows,
  setRows,
  onBack,
  onDone,
}: {
  options: VariantOption[];
  rows: VariantRow[];
  setRows: (fn: (prev: VariantRow[]) => VariantRow[]) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  const optionNames = options.filter((o) => o.name.trim() && o.values.length > 0).map((o) => o.name);
  const selected = rows.filter((r) => r.selected);
  const allSelected = rows.length > 0 && selected.length === rows.length;

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
    if (bulkStock.trim()) patch.stockQty = bulkStock.trim();
    if (Object.keys(patch).length === 0) return;
    setRows((prev) => prev.map((r) => (r.selected ? { ...r, ...patch } : r)));
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
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Variants</span>
        <button
          onClick={onDone}
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

          {bulkOpen && (
            <div className="border border-gray-200 rounded-xl p-3 mb-3 bg-gray-50">
              <p className="text-xs text-gray-500 mb-2">
                Fills every selected variant at once — you can still edit them individually after.
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
            {selected.map((row) => (
              <div key={row.key} className="border border-gray-200 rounded-xl p-3">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {row.options.map((o) => o.value).join(" / ")}
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

            {selected.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">
                Select at least one combination above.
              </p>
            )}
          </div>
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
