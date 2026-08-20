import { Fragment, useState } from "react";
import { X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import {
  cmToDisplay,
  displayToCm,
  type SizeChartDefinition,
  type SizeMeasurements,
} from "@/lib/size-chart-config";
import { TshirtShortSleeveDiagram } from "@/components/product-form/size-chart/TshirtOutline";

type Unit = "cm" | "in";
// sizeValue -> measurementKey -> raw typed string, in whatever `unit` currently is
type Draft = Record<string, Record<string, string>>;

function formatNum(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export function SizeChartSheet({
  sizeValues,
  chart,
  initialMeasurements,
  onSave,
  onClose,
}: {
  sizeValues: string[];
  chart: SizeChartDefinition;
  initialMeasurements: SizeMeasurements;
  onSave: (measurements: SizeMeasurements) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  const [unit, setUnit] = useState<Unit>("cm");
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [values, setValues] = useState<Draft>(() => {
    const init: Draft = {};
    for (const sv of sizeValues) {
      init[sv] = {};
      for (const line of chart.lines) {
        const cm = initialMeasurements[sv]?.[line.key];
        init[sv][line.key] = cm != null ? formatNum(cm) : "";
      }
    }
    return init;
  });

  function setCell(sizeValue: string, key: string, raw: string) {
    setValues((prev) => ({
      ...prev,
      [sizeValue]: { ...prev[sizeValue], [key]: raw },
    }));
  }

  function switchUnit(next: Unit) {
    if (next === unit) return;
    setValues((prev) => {
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

  function handleSave() {
    const measurements: SizeMeasurements = {};
    for (const sv of sizeValues) {
      for (const line of chart.lines) {
        const raw = values[sv]?.[line.key];
        const num = raw ? parseFloat(raw) : NaN;
        if (isNaN(num)) continue;
        measurements[sv] ??= {};
        measurements[sv][line.key] = displayToCm(num, unit);
      }
    }
    onSave(measurements);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Size chart
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {sizeValues.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center py-16">
            <p className="text-[15px] text-gray-900 font-medium">Add Size values first</p>
            <p className="text-xs text-gray-500">
              Go to Variants and add a Size option with at least one value, then come back here to
              fill in measurements.
            </p>
          </div>
        ) : (
          <>
            <div className="aspect-square w-full bg-gray-50 rounded-2xl p-4">
              <TshirtShortSleeveDiagram activeKey={focusedKey} onSelectLine={setFocusedKey} />
            </div>

            <div className="flex items-center justify-center gap-3">
              <div className="flex bg-gray-100 rounded-full p-1">
                {(["cm", "in"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => switchUnit(u)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium oak-motion-surface ${
                      unit === u ? "bg-black text-white" : "text-gray-500"
                    }`}
                  >
                    {u === "cm" ? "cm" : "in"}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div
                className="grid"
                style={{ gridTemplateColumns: `72px repeat(${chart.lines.length}, 1fr)` }}
              >
                <div className="bg-gray-50 px-2 py-2.5" />
                {chart.lines.map((line) => (
                  <button
                    key={line.key}
                    type="button"
                    onClick={() => setFocusedKey(line.key)}
                    className={`px-2 py-2.5 text-center text-xs font-medium transition-colors duration-150 ${
                      focusedKey === line.key
                        ? "bg-gray-900 text-white"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {line.label}
                    <span className="block text-[10px] opacity-70">({unit})</span>
                  </button>
                ))}

                {sizeValues.map((sv) => (
                  <Fragment key={sv}>
                    <div className="px-2 py-2.5 flex items-center justify-center text-sm font-medium text-gray-900 border-t border-gray-100">
                      {sv}
                    </div>
                    {chart.lines.map((line) => (
                      <div
                        key={line.key}
                        className={`border-t border-l border-gray-100 transition-colors duration-150 ${
                          focusedKey === line.key ? "bg-gray-50" : ""
                        }`}
                      >
                        <input
                          value={values[sv]?.[line.key] ?? ""}
                          onChange={(e) =>
                            setCell(sv, line.key, e.target.value.replace(/[^0-9.]/g, ""))
                          }
                          onFocus={() => setFocusedKey(line.key)}
                          inputMode="decimal"
                          placeholder="0"
                          className="w-full text-center text-[15px] py-2.5 outline-none bg-transparent"
                        />
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={sizeValues.length === 0}
          className="w-full bg-black text-white text-sm font-medium rounded-full py-3.5 disabled:opacity-50 oak-motion-control active:scale-[0.98]"
        >
          Save size chart
        </button>
      </div>
    </div>
  );
}
