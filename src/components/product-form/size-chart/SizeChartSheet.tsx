import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import {
  cmToDisplay,
  displayToCm,
  isMeasurementSetPlausible,
  type ManualSize,
  type SizeChartDefinition,
  type SizeMeasurements,
} from "@/lib/size-chart-config";
import { SIZE_SYSTEMS } from "@/components/product-form/OptionEditorSheet";
import { GUIDE_IMAGES } from "./guide-images";

type Unit = "cm" | "in";
// sizeValue -> measurementKey -> raw typed string, in whatever `unit` currently is
type Draft = Record<string, Record<string, string>>;

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
  const [pickerSystem, setPickerSystem] = useState<string>(manualSize?.system ?? "XXL");
  const [confirmEmptySave, setConfirmEmptySave] = useState(false);
  const [confirmImplausible, setConfirmImplausible] = useState(false);
  // Distinct from confirmEmptySave (manual mode's "nothing filled in at all,
  // save just the size") -- this is "SOME lines filled, others still blank",
  // which is the far more common way to under-fill a chart and previously
  // sailed straight through with no warning in either mode.
  const [confirmMissing, setConfirmMissing] = useState(false);

  const activeSizes = isVariantMode ? variantSizeValues : pickedSize ? [pickedSize.value] : [];
  const currentSize = activeSizes[index];

  function setCell(sizeValue: string, key: string, raw: string) {
    setConfirmEmptySave(false);
    setConfirmImplausible(false);
    setConfirmMissing(false);
    setDraft((prev) => ({
      ...prev,
      [sizeValue]: { ...prev[sizeValue], [key]: raw },
    }));
  }

  // Which of the current size's lines are still blank, by their (single-
  // letter) label -- same letters the guide image and each row already show,
  // so naming them here doesn't introduce a label the seller hasn't seen.
  function missingLineLabels(sizeValue: string): string[] {
    return chart.lines.filter((l) => !draft[sizeValue]?.[l.key]?.trim()).map((l) => l.label);
  }

  // Converts the currently-shown size's draft cells to cm and runs the
  // silent cross-measurement sanity check — no ratio/rule detail surfaces
  // to the seller, only a generic "looks off" nudge (see confirmImplausible).
  function currentDraftPlausible(): boolean {
    const cmValues: Record<string, number> = {};
    for (const line of chart.lines) {
      const raw = draft[currentSize]?.[line.key];
      const num = raw ? parseFloat(raw) : NaN;
      if (!isNaN(num)) cmValues[line.key] = displayToCm(num, unit);
    }
    return isMeasurementSetPlausible(cmValues);
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
    setConfirmImplausible(false);
    setConfirmMissing(false);
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
    const missing = missingLineLabels(currentSize);
    if (missing.length > 0 && !confirmMissing) {
      setConfirmMissing(true);
      return;
    }
    if (!currentDraftPlausible() && !confirmImplausible) {
      setConfirmImplausible(true);
      return;
    }
    setIndex((i) => Math.min(i + 1, activeSizes.length - 1));
    setConfirmEmptySave(false);
    setConfirmImplausible(false);
    setConfirmMissing(false);
  }

  function handleBack() {
    setIndex((i) => Math.max(i - 1, 0));
    setConfirmEmptySave(false);
    setConfirmImplausible(false);
    setConfirmMissing(false);
  }

  function handleVariantSave() {
    const missing = missingLineLabels(currentSize);
    if (missing.length > 0 && !confirmMissing) {
      setConfirmMissing(true);
      return;
    }
    if (!currentDraftPlausible() && !confirmImplausible) {
      setConfirmImplausible(true);
      return;
    }
    onSave(measurementsFor(variantSizeValues), null);
  }

  function handleManualSave() {
    if (!pickedSize) return;
    const hasAnyValue = chart.lines.some((l) => draft[pickedSize.value]?.[l.key]?.trim());
    if (!hasAnyValue && !confirmEmptySave) {
      setConfirmEmptySave(true);
      return;
    }
    // Only reached once hasAnyValue is true -- a totally blank size is
    // confirmEmptySave's own, softer message above, not this one.
    const missing = missingLineLabels(pickedSize.value);
    if (hasAnyValue && missing.length > 0 && !confirmMissing) {
      setConfirmMissing(true);
      return;
    }
    if (hasAnyValue && !currentDraftPlausible() && !confirmImplausible) {
      setConfirmImplausible(true);
      return;
    }
    onSave(measurementsFor([pickedSize.value]), pickedSize);
  }

  // These warnings render at the BOTTOM of a scrollable column, under the
  // measurement inputs -- a seller who tapped Save while looking at the guide
  // image up top sees only the button's label change and nothing else, which
  // read as "it just didn't save". Scrolling the warning into view is what
  // makes it land; the button itself is sticky, so the banner ends up right
  // above the thing they just tapped.
  const scrollRef = useRef<HTMLDivElement>(null);
  const warningShowing = confirmMissing || confirmImplausible || confirmEmptySave;
  useEffect(() => {
    if (!warningShowing) return;
    const el = scrollRef.current;
    if (!el) return;
    // rAF, not a bare call: the banner is rendered by this same commit, so
    // scrollHeight is only correct once the browser has laid it out.
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [warningShowing]);

  const isLastStep = index === activeSizes.length - 1;
  // Same "anyway" wording regardless of which specific warning is currently
  // pending confirmation -- there can be a second, different warning right
  // behind this one (missing lines, then an implausible ratio among the
  // ones that ARE filled), so the label just signals "a warning is showing,
  // tap to proceed" rather than naming which one.
  const anyWarningPending = confirmMissing || confirmImplausible;
  const saveLabel = isVariantMode
    ? anyWarningPending
      ? isLastStep
        ? "Save anyway"
        : "Continue anyway"
      : isLastStep
        ? "Save size chart"
        : "Next size"
    : anyWarningPending
      ? "Save anyway"
      : confirmEmptySave
        ? "Save without measurements"
        : "Save size";

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {!isVariantMode && !pickedSize ? (
          <SizePicker system={pickerSystem} onChangeSystem={setPickerSystem} onPick={pickSize} />
        ) : (
          <>
            <div className="aspect-square w-full bg-gray-50 rounded-2xl p-4">
              <img
                src={GUIDE_IMAGES[chart.guide]}
                alt={`${chart.id} measurement guide`}
                className="w-full h-full object-contain"
              />
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
              {/* Deliberately larger than a normal inline control: it sits beside
                  the size label with nothing else competing for the row, and it
                  is a real thumb target a seller taps mid-measurement. */}
              <div className="flex bg-gray-100 rounded-full p-1 shrink-0">
                {(["cm", "in"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => switchUnit(u)}
                    className={`px-5 py-2 rounded-full text-sm font-medium oak-motion-surface ${
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

            {confirmMissing && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2.5 animate-in fade-in duration-200">
                Missing: {missingLineLabels(currentSize).join(", ")}. Buyers won't see a size guide
                for this measurement — you can still save if you're sure.
              </p>
            )}

            {confirmImplausible && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2.5 animate-in fade-in duration-200">
                Double check these numbers — this combination looks unusual for one size. You can
                still save if you're sure.
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
            className="flex-1 bg-black text-white text-sm font-medium rounded-full py-3.5 oak-motion-control active:scale-[0.98]"
          >
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// Exported for ManualSizeOnlySheet — same "pick a real size value" step,
// reused for categories with no illustrated chart yet. `systems` is a prop
// rather than the hardcoded SIZE_SYSTEMS because footwear picks from a
// different ladder (SHOE_SIZE_SYSTEMS); every chart category still gets the
// clothing default.
export function SizePicker({
  system,
  systems = SIZE_SYSTEMS,
  onChangeSystem,
  onPick,
}: {
  system: string;
  systems?: Record<string, readonly string[]>;
  onChangeSystem: (s: string) => void;
  onPick: (value: string) => void;
}) {
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[15px] font-semibold text-gray-900 mb-1">Pick a size</p>
        <p className="text-xs text-gray-500">
          Optional — only needed if this product isn't already split into Size variants.
        </p>
      </div>

      <div className="relative flex justify-end">
        <button
          type="button"
          onClick={() => setSystemMenuOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5"
        >
          {system}
          <ChevronDown size={13} className="text-gray-400" />
        </button>
        {systemMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close unit menu"
              onClick={() => setSystemMenuOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-28">
              {Object.keys(systems).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChangeSystem(key);
                    setSystemMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left ${
                    key === system ? "text-gray-900 font-medium" : "text-gray-600"
                  }`}
                >
                  {key}
                  {key === system && <Check size={14} />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {systems[system].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left oak-motion-control"
          >
            <span className="text-[15px] text-gray-900 truncate">{v}</span>
            <span className="ml-auto w-5 h-5 rounded-full border border-gray-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
