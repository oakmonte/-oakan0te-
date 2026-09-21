import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Plus, Trash2, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import type { ManualSize, SizeMeasurements } from "@/lib/size-chart-config";
import { SIZE_SYSTEMS } from "@/components/product-form/OptionEditorSheet";
import { SizePicker } from "./SizeChartSheet";

// Size necessity for categories with no illustrated chart yet (shoes,
// dresses, costumes — see the root CLAUDE.md pre-launch note: a real
// per-category measurement schema with its own guide artwork is future
// work, not something to improvise here).
//
// Rather than leave Size satisfiable by nothing more than a variant option
// existing (the bug this sheet replaces), or invent an unreviewed
// measurement schema, this asks for the same thing a chart would in spirit
// — real cm numbers, direct from the seller — just without a fixed,
// illustrated line set: the seller names what they're measuring (label)
// and gives its value. Stored in the exact same `sizeMeasurements` shape
// SizeChartSheet writes to (sizeValue -> measurementKey -> cm) — the
// product_size_measurements table's measurement_key is already an open
// string for this reason, so nothing downstream needs to change to accept
// it.
export function ManualSizeOnlySheet({
  variantSizeValues,
  manualSize,
  initialMeasurements,
  onSave,
  onClose,
}: {
  variantSizeValues: string[];
  manualSize: ManualSize | null;
  initialMeasurements: SizeMeasurements;
  onSave: (measurements: SizeMeasurements, manualSize: ManualSize | null) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  const isVariantMode = variantSizeValues.length > 0;

  const [index, setIndex] = useState(0);
  const [measurements, setMeasurements] = useState<SizeMeasurements>(initialMeasurements);
  const [pickedSize, setPickedSize] = useState<ManualSize | null>(manualSize);
  const [pickerSystem, setPickerSystem] = useState<keyof typeof SIZE_SYSTEMS>(
    (manualSize?.system as keyof typeof SIZE_SYSTEMS) ?? "XXL",
  );
  const [labelDraft, setLabelDraft] = useState("");
  const [valueDraft, setValueDraft] = useState("");
  const [confirmEmptySave, setConfirmEmptySave] = useState(false);

  const activeSizes = isVariantMode ? variantSizeValues : pickedSize ? [pickedSize.value] : [];
  const currentSize = activeSizes[index];
  const currentEntries = Object.entries(measurements[currentSize] ?? {});

  function addEntry() {
    const label = labelDraft.trim();
    const value = parseFloat(valueDraft);
    if (!label || isNaN(value) || value <= 0) return;
    setMeasurements((prev) => ({
      ...prev,
      [currentSize]: { ...prev[currentSize], [label]: value },
    }));
    setLabelDraft("");
    setValueDraft("");
    setConfirmEmptySave(false);
  }

  function removeEntry(label: string) {
    setMeasurements((prev) => {
      const next = { ...prev[currentSize] };
      delete next[label];
      return { ...prev, [currentSize]: next };
    });
  }

  function pickSize(value: string) {
    setPickedSize({ value, system: pickerSystem });
  }

  const isLastStep = index === activeSizes.length - 1;

  function handleNext() {
    setIndex((i) => Math.min(i + 1, activeSizes.length - 1));
    setConfirmEmptySave(false);
  }

  function handleBack() {
    setIndex((i) => Math.max(i - 1, 0));
    setConfirmEmptySave(false);
  }

  function handleVariantSave() {
    if (activeSizes.some((sv) => Object.keys(measurements[sv] ?? {}).length === 0)) {
      // Same swipe-through-every-size discipline as the chart flow — every
      // size needs at least one real measurement, not just some of them.
      setIndex(activeSizes.findIndex((sv) => Object.keys(measurements[sv] ?? {}).length === 0));
      return;
    }
    onSave(measurements, null);
  }

  function handleManualSave() {
    if (!pickedSize) return;
    const hasAnyValue = Object.keys(measurements[pickedSize.value] ?? {}).length > 0;
    if (!hasAnyValue && !confirmEmptySave) {
      setConfirmEmptySave(true);
      return;
    }
    onSave(measurements, pickedSize);
  }

  // Same reasoning as SizeChartSheet's copy of this: the warning renders at
  // the bottom of a scrollable column, so a seller who tapped Save from
  // higher up sees nothing but the button's own label change.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirmEmptySave) return;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [confirmEmptySave]);

  const saveLabel = isVariantMode
    ? isLastStep
      ? "Save measurements"
      : "Next size"
    : confirmEmptySave
      ? "Save without measurements"
      : "Save size";

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Size</span>
        {isVariantMode ? (
          <span className="text-xs text-gray-400 w-12 text-right">
            {index + 1}/{activeSizes.length}
          </span>
        ) : (
          <span className="w-5" />
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {!isVariantMode && !pickedSize ? (
          <SizePicker system={pickerSystem} onChangeSystem={setPickerSystem} onPick={pickSize} />
        ) : (
          <>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[15px] font-semibold text-gray-900">{currentSize}</span>
                {!isVariantMode && (
                  <button
                    type="button"
                    onClick={() => setPickedSize(null)}
                    className="text-xs text-gray-400 underline"
                  >
                    Change
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                There's no illustrated guide for this category yet — add the measurements that
                matter for this piece yourself (e.g. "Foot length", "Bust"), in cm.
              </p>
            </div>

            {currentEntries.length > 0 && (
              <div className="flex flex-col gap-2">
                {currentEntries.map(([label, cm]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3"
                  >
                    <span className="text-[15px] text-gray-900 truncate">{label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[15px] text-gray-900">{cm} cm</span>
                      <button
                        type="button"
                        onClick={() => removeEntry(label)}
                        aria-label={`Remove ${label}`}
                        className="p-1 text-gray-300"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <label className="flex-1 flex flex-col gap-1">
                <span className="text-xs text-gray-400">Measurement name</span>
                <input
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  placeholder="e.g. Foot length"
                  className="text-[15px] border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-400"
                />
              </label>
              <label className="w-24 flex flex-col gap-1">
                <span className="text-xs text-gray-400">cm</span>
                <input
                  value={valueDraft}
                  onChange={(e) => setValueDraft(e.target.value.replace(/[^0-9.]/g, ""))}
                  inputMode="decimal"
                  placeholder="0"
                  className="text-[15px] border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-400"
                />
              </label>
              <button
                type="button"
                onClick={addEntry}
                disabled={!labelDraft.trim() || !valueDraft.trim()}
                aria-label="Add measurement"
                className="p-2.5 rounded-lg bg-black text-white disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>

            {!isVariantMode && confirmEmptySave && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2.5 animate-in fade-in duration-200">
                No measurements added yet — you can still save just the size, and fill these in
                later.
              </p>
            )}
          </>
        )}
      </div>

      {(isVariantMode || pickedSize) && (
        <div className="sticky bottom-0 px-4 pt-3 oak-safe-bottom border-t border-gray-100 bg-white shrink-0 flex gap-3">
          {isVariantMode && index > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 oak-motion-control"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={
              isVariantMode ? (isLastStep ? handleVariantSave : handleNext) : handleManualSave
            }
            className="flex-1 bg-black text-white text-sm font-medium rounded-full py-3.5 oak-motion-control active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            {saveLabel}
            {((isVariantMode && isLastStep) || (!isVariantMode && confirmEmptySave)) && (
              <Check size={16} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
