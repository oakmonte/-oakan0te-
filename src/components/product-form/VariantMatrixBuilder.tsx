import { useEffect, useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { OptionEditorSheet } from "./OptionEditorSheet";
import { VariantListSheet } from "./VariantListSheet";
import { VariantCombinationsSheet } from "./VariantCombinationsSheet";

export type VariantOption = { name: string; values: string[] };
export type VariantRow = {
  key: string; // "value1|value2" — stable identity across regeneration
  option1Value: string;
  option2Value: string | null;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stockQty: string;
  sku: string;
  mainImageUrl: string;
};

function buildKey(v1: string, v2: string | null) {
  return v2 ? `${v1}|${v2}` : v1;
}

function cartesian(options: VariantOption[]): { v1: string; v2: string | null }[] {
  const [opt1, opt2] = options;
  if (!opt1 || opt1.values.length === 0) return [];
  if (!opt2 || opt2.values.length === 0) {
    return opt1.values.map((v1) => ({ v1, v2: null }));
  }
  const combos: { v1: string; v2: string | null }[] = [];
  for (const v1 of opt1.values) {
    for (const v2 of opt2.values) {
      combos.push({ v1, v2 });
    }
  }
  return combos;
}

// The variant-building flow is a small wizard once at least one option
// exists: the inline row just opens it back up rather than rendering the
// full option list + combination grid inline in the scrolling product form.
type WizardStep = "list" | "combinations" | null;

export function VariantMatrixBuilder({
  options,
  setOptions,
  rows,
  setRows,
}: {
  options: VariantOption[];
  setOptions: (fn: (prev: VariantOption[]) => VariantOption[]) => void;
  rows: VariantRow[];
  setRows: (fn: (prev: VariantRow[]) => VariantRow[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>(null);

  // Regenerate rows whenever options/values change, preserving existing row data by key.
  useEffect(() => {
    const combos = cartesian(options);
    setRows((prevRows) => {
      const prevByKey = new Map(prevRows.map((r) => [r.key, r]));
      return combos.map(({ v1, v2 }) => {
        const key = buildKey(v1, v2);
        const existing = prevByKey.get(key);
        return (
          existing ?? {
            key,
            option1Value: v1,
            option2Value: v2,
            price: "",
            compareAtPrice: "",
            costPrice: "",
            stockQty: "",
            sku: "",
            mainImageUrl: "",
          }
        );
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(options)]);

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="border-b-8 border-gray-50">
      <p className="px-4 pt-4 text-[15px] font-semibold text-gray-900">Variants</p>

      <div className="px-4">
        {options.length === 0 ? (
          <button
            type="button"
            onClick={() => setEditingIndex(0)}
            className="w-full flex items-center justify-between py-4 border-b border-gray-100 text-left"
          >
            <span className="flex items-center gap-3 text-[15px] text-gray-900">
              <Plus size={18} className="text-gray-400" />
              Add options (color, size, material, etc.)
            </span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setWizardStep("list")}
            className="w-full flex items-center justify-between py-4 border-b border-gray-100 text-left"
          >
            <span className="flex flex-col items-start gap-0.5 min-w-0">
              <span className="text-[15px] text-gray-900 truncate">
                {options.map((o) => o.name || "Untitled option").join(" / ")}
              </span>
              <span className="text-xs text-gray-400">
                {rows.length} variant{rows.length === 1 ? "" : "s"}
              </span>
            </span>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </button>
        )}
      </div>

      {wizardStep === "list" && (
        <VariantListSheet
          options={options}
          onEdit={(i) => setEditingIndex(i)}
          onRemove={removeOption}
          onAddNew={() => setEditingIndex(options.length)}
          onContinue={() => setWizardStep("combinations")}
          onBack={() => setWizardStep(null)}
        />
      )}

      {wizardStep === "combinations" && (
        <VariantCombinationsSheet
          rows={rows}
          setRows={setRows}
          onBack={() => setWizardStep("list")}
          onDone={() => setWizardStep(null)}
        />
      )}

      {editingIndex !== null && (
        <OptionEditorSheet
          initialName={options[editingIndex]?.name ?? ""}
          initialValues={options[editingIndex]?.values ?? []}
          disabledNames={options
            .filter((_, i) => i !== editingIndex)
            .map((o) => o.name)
            .filter(Boolean)}
          onSave={(name, values) => {
            setOptions((prev) => {
              const next = [...prev];
              next[editingIndex] = { name, values };
              return next;
            });
            setEditingIndex(null);
            // "Next" always lands you on the variation list, whether this
            // was the very first option or an edit made from inside it.
            setWizardStep("list");
          }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}
