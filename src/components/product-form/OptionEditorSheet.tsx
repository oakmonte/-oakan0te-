import { useState } from "react";
import { X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

const PRESETS = ["Size", "Color", "Material", "Weight/Volume"] as const;

// One-tap common values per preset option — covers apparel/accessories/cosmetics/art
// without forcing typing. Free-text entry below still exists for anything not listed.
const VALUE_PRESETS: Record<string, string[]> = {
  Size: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  Color: [
    "Black",
    "White",
    "Grey",
    "Beige",
    "Brown",
    "Red",
    "Orange",
    "Yellow",
    "Green",
    "Blue",
    "Navy",
    "Purple",
    "Pink",
    "Multicolor",
  ],
  Material: ["Cotton", "Polyester", "Leather", "Suede", "Silk", "Wool", "Linen", "Denim", "Canvas"],
  "Weight/Volume": [
    "25g",
    "50g",
    "100g",
    "250g",
    "500g",
    "1kg",
    "30ml",
    "50ml",
    "100ml",
    "250ml",
    "500ml",
    "1L",
  ],
};

export function OptionEditorSheet({
  initialName,
  initialValues,
  onSave,
  onClose,
}: {
  initialName: string;
  initialValues: string[];
  onSave: (name: string, values: string[]) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [values, setValues] = useState<string[]>(initialValues);
  const [valueDraft, setValueDraft] = useState("");

  // Keyboard should overlay this sheet, not resize/push it — same fix already used
  // on the camera/after-shot routes for the identical iOS Safari behavior.
  useLockedViewport();

  const presetValues = VALUE_PRESETS[name] ?? [];
  const customValues = values.filter((v) => !presetValues.includes(v));

  function togglePresetValue(v: string) {
    setValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  function addValue() {
    const v = valueDraft.trim();
    if (!v || values.includes(v)) return;
    setValues((prev) => [...prev, v]);
    setValueDraft("");
  }

  function removeValue(v: string) {
    setValues((prev) => prev.filter((x) => x !== v));
  }

  function handleSave() {
    if (!name.trim() || values.length === 0) return;
    onSave(name.trim(), values);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="text-sm text-gray-500">
          Cancel
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Option</span>
        <button
          onClick={handleSave}
          type="button"
          disabled={!name.trim() || values.length === 0}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <p className="text-xs text-gray-400 mb-2">Option name</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setName(p)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                name === p
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-700 border-gray-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Or type your own, e.g. Fragrance"
          className="w-full text-base border border-gray-200 rounded-lg px-3 py-3 outline-none mb-1"
        />

        {name && (
          <>
            <p className="text-xs text-gray-400 mt-4 mb-2">Values</p>

            {presetValues.length > 0 && (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {presetValues.map((v) => {
                    const selected = values.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => togglePresetValue(v)}
                        className={`px-3 py-1.5 rounded-full text-sm border ${
                          selected
                            ? "bg-black text-white border-black"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mb-2">Something else? Type it below.</p>
              </>
            )}

            <div className="flex flex-wrap gap-2 mb-2">
              {customValues.map((v) => (
                <span
                  key={v}
                  className="flex items-center gap-1 bg-gray-100 text-sm text-gray-700 rounded-full pl-3 pr-2 py-1"
                >
                  {v}
                  <button type="button" onClick={() => removeValue(v)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <input
              value={valueDraft}
              onChange={(e) => setValueDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addValue();
                }
              }}
              placeholder="Add value, press Enter"
              className="w-full text-base border border-gray-200 rounded-lg px-3 py-3 outline-none"
            />
          </>
        )}
      </div>
    </div>
  );
}
