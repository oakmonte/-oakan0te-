import { useState } from "react";
import { X, Plus, Trash2, ScanBarcode, ChevronsUpDown, Check } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import {
  BARCODE_TYPES,
  BARCODE_TYPE_LABELS,
  type BarcodeEntry,
  type BarcodeType,
} from "@/lib/barcode-types";
import { BarcodeScanSheet } from "./BarcodeScanSheet";

/** Multi-barcode editor -- a SKU can carry more than one code (its own
 *  custom one alongside a manufacturer's GTIN/UPC/EAN, say). Purely a
 *  local-state editor like every other sheet in this form: there's no Save
 *  step here, closing (X) hands the current rows back to the caller, same
 *  as "Edit locations" already does for location selection. Blank rows are
 *  dropped on close so scratch rows left empty while editing never round-
 *  trip into state or get written to the DB. */
export function BarcodesSheet({
  productLabel,
  initial,
  onClose,
}: {
  productLabel?: string;
  initial: BarcodeEntry[];
  onClose: (barcodes: BarcodeEntry[]) => void;
}) {
  useLockedViewport();
  const [rows, setRows] = useState<BarcodeEntry[]>(
    initial.length > 0 ? initial : [{ type: "custom", value: "" }],
  );
  const [openTypeIndex, setOpenTypeIndex] = useState<number | null>(null);
  const [scanIndex, setScanIndex] = useState<number | null>(null);

  function updateValue(index: number, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, value } : r)));
  }

  function updateType(index: number, type: BarcodeType) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, type } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { type: "custom", value: "" }]);
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function clearAll() {
    setRows([{ type: "custom", value: "" }]);
  }

  function handleClose() {
    onClose(rows.filter((r) => r.value.trim().length > 0));
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 pt-4 pb-3 flex flex-col items-center shrink-0 relative">
        <button
          onClick={handleClose}
          type="button"
          className="absolute left-4 top-4 p-1.5 rounded-full bg-gray-100 transition-transform duration-150 active:scale-90"
        >
          <X size={16} className="text-gray-600" />
        </button>
        <span className="font-semibold text-[16px] text-gray-900">Barcodes</span>
        {productLabel && <span className="text-xs text-gray-400 mt-0.5">{productLabel}</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3.5 transition-colors duration-150 focus-within:border-gray-400 min-w-0">
              <input
                value={row.value}
                onChange={(e) => updateValue(i, e.target.value)}
                placeholder="Barcode"
                className="flex-1 text-[15px] text-gray-900 outline-none min-w-0"
              />
              <button
                type="button"
                onClick={() => setScanIndex(i)}
                aria-label="Scan barcode"
                className="shrink-0 transition-transform duration-150 active:scale-90"
              >
                <ScanBarcode size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setOpenTypeIndex(openTypeIndex === i ? null : i)}
                className="flex items-center gap-1 border border-gray-200 rounded-xl pl-3.5 pr-2.5 py-3.5 text-[15px] text-gray-900 transition-transform duration-150 active:scale-[0.97]"
              >
                {BARCODE_TYPE_LABELS[row.type]}
                <ChevronsUpDown size={14} className="text-gray-400" />
              </button>

              {openTypeIndex === i && (
                <>
                  <button
                    type="button"
                    aria-label="Close type picker"
                    onClick={() => setOpenTypeIndex(null)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-white rounded-2xl shadow-lg border border-gray-100 py-1.5 origin-top-right animate-in fade-in zoom-in-95 duration-150">
                    {BARCODE_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          updateType(i, t);
                          setOpenTypeIndex(null);
                        }}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left transition-colors duration-150 active:bg-gray-50"
                      >
                        <span className="w-3.5 shrink-0">
                          {row.type === t && (
                            <Check size={14} className="text-gray-900 oak-motion-pop" />
                          )}
                        </span>
                        <span
                          className={`text-[14px] ${row.type === t ? "font-semibold text-gray-900" : "text-gray-700"}`}
                        >
                          {BARCODE_TYPE_LABELS[t]}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => deleteRow(i)}
                aria-label="Delete barcode"
                className="shrink-0 p-3 rounded-xl bg-gray-100 text-gray-500 transition-transform duration-150 active:scale-90"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 text-gray-900 text-[15px] font-medium py-3.5 transition-transform duration-150 active:scale-[0.98]"
        >
          <Plus size={16} />
          Add barcode
        </button>

        {rows.length > 1 && (
          <button
            type="button"
            onClick={clearAll}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 text-red-600 text-[15px] font-medium py-3.5 transition-transform duration-150 active:scale-[0.98]"
          >
            <Trash2 size={16} />
            Clear all
          </button>
        )}
      </div>

      {scanIndex !== null && (
        <BarcodeScanSheet
          onDetected={(value, type) => {
            setRows((prev) => prev.map((r, i) => (i === scanIndex ? { type, value } : r)));
            setScanIndex(null);
          }}
          onClose={() => setScanIndex(null)}
        />
      )}
    </div>
  );
}
