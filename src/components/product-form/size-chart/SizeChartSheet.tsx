import { useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import {
  cmToDisplay,
  displayToCm,
  type ManualSize,
  type SizeChartDefinition,
  type SizeMeasurements,
} from "@/lib/size-chart-config";
import { SIZE_SYSTEMS } from "@/components/product-form/OptionEditorSheet";
import { TshirtShortSleeveDiagram } from "@/components/product-form/size-chart/TshirtOutline";

type Unit = "cm" | "in";
// sizeValue -> measurementKey -> raw typed string, in whatever `unit` currently is
type Draft = Record<string, Record<string, string>>;
const SYSTEM_KEYS = Object.keys(SIZE_SYSTEMS) as (keyof typeof SIZE_SYSTEMS)[];

function formatNum(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function seedDraft(sizeValues: string[], lines: { key: string }[], init: SizeMeasurements): Draft {
  const draft: Draft = {};
  for (const sv of sizeValues) {
    draft[sv] = {};
    for (const line of lines) {
      const cm = init[sv]?.[line.key];
      draft[sv][line.key] = cm != null ? formatNum(cm) : "";
    }
  }
  return draft;
}

export function SizeChartSheet({
  variantSizeValues,
  manualSize,
  chart,
  initialMeasurements,
  onSave,
  onClose,
}: {
  variantSizeValues: string[];
  manualSize: ManualSize | null;
  chart: SizeChartDefinition;
  initialMeasurements: SizeMeasurements;
  onSave: (measurements: SizeMeasurements, manualSize: ManualSize | null) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  // Variant Size axis wins when it exists — a seller who already set up Size
  // as a variant option doesn't also get a manual picker for the same thing.
  const isVariantMode = variantSizeValues.length > 0;

  const [unit, setUnit] = useState<Unit>("cm");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(() =>
    isVariantMode
      ? seedDraft(variantSizeValues, chart.lines, initialMeasurements)
      : seedDraft(manualSize ? [manualSize.value] : [], chart.lines, initialMeasurements),
  );

  const [pickedSize, setPickedSize] = useState<ManualSize | null>(manualSize);
  const [pickerSystem, setPickerSystem] = useState<keyof typeof SIZE_SYSTEMS>(
    (manualSize?.system as keyof typeof SIZE_SYSTEMS) ?? "XXL",
  );
  const [confirmEmptySave, setConfirmEmptySave] = useState(false);

  const activeSizes = isVariantMode ? variantSizeValues : pickedSize ? [pickedSize.value] : [];
  const currentSize = activeSizes[index];

  function setCell(sizeValue: string, key: string, raw: string) {
    setConfirmEmptySave(false);
    setDraft((prev) => ({
      ...prev,
      [sizeValue]: { ...prev[sizeValue], [key]: raw },
    }));
  }

  function switchUnit(next: Unit) {
    if (next === unit) return;
    setDraft((prev) => {
      const out: Draft = {};
      for (const sv of Object.keys(prev)) {
        out[sv] = {};
        for (const key of Object.keys(prev[sv])) {
          const raw = prev[sv][key];
          const num = parseFloat(raw);
          if (!raw.trim() || isNaN(num)) {
            out[sv][key] = raw.trim() ? raw : "";
            continue;
          }
          const cm = displayToCm(num, unit);
          out[sv][key] = formatNum(cmToDisplay(cm, next));
        }
      }
      return out;
    });
    setUnit(next);
  }

  function pickSize(value: string) {
    setPickedSize({ value, system: pickerSystem });
    setDraft(() => seedDraft([value], chart.lines, initialMeasurements));
    setConfirmEmptySave(false);
  }

  function measurementsFor(sizeValues: string[]): SizeMeasurements {
    const out: SizeMeasurements = {};
    for (const sv of sizeValues) {
      for (const line of chart.lines) {
        const raw = draft[sv]?.[line.key];
        const num = raw ? parseFloat(raw) : NaN;
        if (isNaN(num)) continue;
        out[sv] ??= {};
        out[sv][line.key] = displayToCm(num, unit);
      }
    }
    return out;
  }

  function handleNext() {
    setIndex((i) => Math.min(i + 1, activeSizes.length - 1));
    setConfirmEmptySave(false);
  }

  function handleBack() {
    setIndex((i) => Math.max(i - 1, 0));
    setConfirmEmptySave(false);
  }

  function handleVariantSave() {
    onSave(measurementsFor(variantSizeValues), null);
  }

  function handleManualSave() {
    if (!pickedSize) return;
    const hasAnyValue = chart.lines.some((l) => draft[pickedSize.value]?.[l.key]?.trim());
    if (!hasAnyValue && !confirmEmptySave) {
      setConfirmEmptySave(true);
      return;
    }
    onSave(measurementsFor([pickedSize.value]), pickedSize);
  }

  const isLastStep = index === activeSizes.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Size chart
        </span>
        {isVariantMode ? (
          <span className="text-xs text-gray-400 w-12 text-right">
            {index + 1}/{activeSizes.length}
          </span>
        ) : (
          <span className="w-5" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {!isVariantMode && !pickedSize ? (
          <SizePicker system={pickerSystem} onChangeSystem={setPickerSystem} onPick={pickSize} />
        ) : (
          <>
            <div className="aspect-square w-full bg-gray-50 rounded-2xl p-4">
              <TshirtShortSleeveDiagram activeKey={focusedKey} onSelectLine={setFocusedKey} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
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
              <div className="flex bg-gray-100 rounded-full p-1">
                {(["cm", "in"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => switchUnit(u)}
                    className={`px-3 py-1 rounded-full text-xs font-medium oak-motion-surface ${
                      unit === u ? "bg-black text-white" : "text-gray-500"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {chart.lines.map((line) => (
                <div
                  key={line.key}
                  className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-3 transition-colors duration-150 ${
                    focusedKey === line.key ? "border-gray-900" : "border-gray-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setFocusedKey(line.key)}
                    className="text-[15px] text-gray-900 text-left"
                  >
                    {line.label}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <input
                      value={draft[currentSize]?.[line.key] ?? ""}
                      onChange={(e) =>
                        setCell(currentSize, line.key, e.target.value.replace(/[^0-9.]/g, ""))
                      }
                      onFocus={() => setFocusedKey(line.key)}
                      inputMode="decimal"
                      placeholder="0"
                      className="w-16 text-right text-[15px] outline-none bg-transparent"
                    />
                    <span className="text-xs text-gray-400">{unit}</span>
                  </div>
                </div>
              ))}
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
        <div className="sticky bottom-0 px-4 py-3 border-t border-gray-100 bg-white shrink-0 flex gap-3">
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
            className="flex-1 bg-black text-white text-sm font-medium rounded-full py-3.5 oak-motion-control active:scale-[0.98]"
          >
            {isVariantMode
              ? isLastStep
                ? "Save size chart"
                : "Next size"
              : confirmEmptySave
                ? "Save without measurements"
                : "Save size"}
          </button>
        </div>
      )}
    </div>
  );
}

function SizePicker({
  system,
  onChangeSystem,
  onPick,
}: {
  system: keyof typeof SIZE_SYSTEMS;
  onChangeSystem: (s: keyof typeof SIZE_SYSTEMS) => void;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[15px] font-semibold text-gray-900 mb-1">Pick a size</p>
        <p className="text-xs text-gray-500">
          Optional — only needed if this product isn't already split into Size variants.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SYSTEM_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChangeSystem(key)}
            className={`text-sm rounded-full px-3 py-1.5 border transition-colors duration-150 ${
              system === key ? "bg-black text-white border-black" : "border-gray-200 text-gray-700"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {SIZE_SYSTEMS[system].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className="text-sm rounded-full px-3.5 py-2 border border-gray-200 text-gray-900 oak-motion-control"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
