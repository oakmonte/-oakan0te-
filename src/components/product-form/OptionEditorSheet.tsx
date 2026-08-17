import { useState } from "react";
import { X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

const PRESETS = ["Size", "Color", "Material", "Weight/Volume"] as const;

// One-tap common values per preset option — covers apparel/accessories/cosmetics/art
// without forcing typing. Free-text entry still exists for anything not listed.
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

// Real swatches for the Color preset — plain text pills read as generic, an
// actual dot per name reads as "this app understands color." Multicolor gets
// a conic-gradient ring instead of a single hex.
const COLOR_SWATCHES: Record<string, string> = {
  Black: "#111111",
  White: "#FFFFFF",
  Grey: "#9CA3AF",
  Beige: "#D9C7AA",
  Brown: "#7B4B2A",
  Red: "#DC2626",
  Orange: "#F97316",
  Yellow: "#FACC15",
  Green: "#16A34A",
  Blue: "#2563EB",
  Navy: "#1E3A8A",
  Purple: "#9333EA",
  Pink: "#EC4899",
};

function ColorSwatch({ name }: { name: string }) {
  const hex = COLOR_SWATCHES[name];
  return (
    <span
      className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
      style={{
        background:
          hex ??
          "conic-gradient(from 0deg, #DC2626, #F97316, #FACC15, #16A34A, #2563EB, #9333EA, #DC2626)",
      }}
    />
  );
}

export function OptionEditorSheet({
  initialName,
  initialValues,
  disabledNames = [],
  onSave,
  onClose,
}: {
  initialName: string;
  initialValues: string[];
  disabledNames?: string[];
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
  const isColorOption = name === "Color";

  const trimmedName = name.trim();
  const nameTaken = disabledNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase());
  const canSave = !!trimmedName && !nameTaken && values.length > 0;

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
    if (!canSave) return;
    onSave(trimmedName, values);
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
          disabled={!canSave}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Option name"
          autoFocus={!initialName}
          className="w-full text-lg font-medium text-gray-900 border border-gray-200 rounded-xl px-4 py-4 outline-none focus:border-gray-400 mb-3"
        />
        {nameTaken && (
          <p className="text-xs text-red-500 -mt-2 mb-3">
            “{trimmedName}” is already used by your other option.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const disabled =
              disabledNames.some((n) => n.toLowerCase() === p.toLowerCase()) && name !== p;
            return (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => setName(p)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  name === p
                    ? "bg-black text-white border-black"
                    : disabled
                      ? "bg-white text-gray-300 border-gray-100"
                      : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {name && (
          <>
            {/* Obvious break between naming the option and picking its values. */}
            <div className="-mx-4 h-2 bg-gray-50 my-6" />

            <p className="text-[15px] font-semibold text-gray-900 mb-3">Values</p>

            <input
              value={valueDraft}
              onChange={(e) => setValueDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addValue();
                }
              }}
              placeholder="Add a value"
              className="w-full text-base border border-gray-200 rounded-xl px-4 py-4 outline-none focus:border-gray-400 mb-3"
            />

            {customValues.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
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
            )}

            {presetValues.length > 0 && (
              <>
                <p className="text-xs text-gray-400 mb-2">One-tap values for {name}</p>
                <div className="flex flex-wrap gap-2">
                  {presetValues.map((v) => {
                    const selected = values.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => togglePresetValue(v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${
                          selected
                            ? "bg-black text-white border-black"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        {isColorOption && <ColorSwatch name={v} />}
                        {v}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
