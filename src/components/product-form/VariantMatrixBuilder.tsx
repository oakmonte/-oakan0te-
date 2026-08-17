import { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";

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
  const [valueDrafts, setValueDrafts] = useState<string[]>(options.map(() => ""));

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

  function addOption() {
    if (options.length >= 2) return;
    setOptions((prev) => [...prev, { name: "", values: [] }]);
    setValueDrafts((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setValueDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOptionName(index: number, name: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, name } : o)));
  }

  function addValue(index: number) {
    const draft = valueDrafts[index]?.trim();
    if (!draft) return;
    setOptions((prev) =>
      prev.map((o, i) =>
        i === index && !o.values.includes(draft) ? { ...o, values: [...o.values, draft] } : o
      )
    );
    setValueDrafts((prev) => prev.map((d, i) => (i === index ? "" : d)));
  }

  function removeValue(index: number, value: string) {
    setOptions((prev) =>
      prev.map((o, i) => (i === index ? { ...o, values: o.values.filter((v) => v !== value) } : o))
    );
  }

  function updateRow(key: string, patch: Partial<VariantRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="border-b-8 border-gray-50">
      <p className="px-4 pt-4 text-[15px] font-semibold text-gray-900">Options</p>

      <div className="px-4 py-4 flex flex-col gap-4">
        {options.map((opt, i) => (
          <div key={i} className="border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                value={opt.name}
                onChange={(e) => updateOptionName(i, e.target.value)}
                placeholder={i === 0 ? "e.g. Size" : "e.g. Color"}
                className="text-base font-medium flex-1 outline-none"
              />
              <button type="button" onClick={() => removeOption(i)} className="text-gray-400 p-1">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {opt.values.map((v) => (
                <span
                  key={v}
                  className="flex items-center gap-1 bg-gray-100 text-sm text-gray-700 rounded-full pl-3 pr-2 py-1"
                >
                  {v}
                  <button type="button" onClick={() => removeValue(i, v)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            <input
              value={valueDrafts[i] ?? ""}
              onChange={(e) =>
                setValueDrafts((prev) => prev.map((d, idx) => (idx === i ? e.target.value : d)))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addValue(i);
                }
              }}
              placeholder="Type a value, press Enter"
              className="text-base border border-gray-200 rounded-lg px-2 py-2 outline-none w-full"
            />
          </div>
        ))}

        {options.length < 2 && (
          <button
            type="button"
            onClick={addOption}
            className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500"
          >
            <Plus size={16} /> Add option
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-400 mb-2">{rows.length} variants</p>
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
      )}
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