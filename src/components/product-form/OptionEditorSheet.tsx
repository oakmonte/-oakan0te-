import { useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

const PRESETS = ["Size", "Color", "Material", "Weight/Volume"] as const;

// Size is the one option where the *same* garment is described by different
// scales depending on the seller/market — so it gets a switchable system
// rather than one hardcoded list. cm/in are real body measurements, which is
// what the universal size chart will eventually key off.
export const SIZE_SYSTEMS = {
  XXL: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  US: ["0", "2", "4", "6", "8", "10", "12", "14", "16"],
  UK: ["4", "6", "8", "10", "12", "14", "16", "18", "20"],
  cm: ["81 cm", "86 cm", "91 cm", "97 cm", "102 cm", "107 cm", "112 cm"],
  in: ['32"', '34"', '36"', '38"', '40"', '42"', '44"'],
} as const;

type SizeSystem = keyof typeof SIZE_SYSTEMS;
const SIZE_SYSTEM_KEYS = Object.keys(SIZE_SYSTEMS) as SizeSystem[];

// One-tap values for the non-Size presets — covers apparel/accessories/
// cosmetics/art without forcing typing. Free text still works for anything else.
const VALUE_PRESETS: Record<string, string[]> = {
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

// Real swatches for Color — a dot per name reads as "this app understands
// color" where a plain text row reads generic. Multicolor gets a gradient.
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

const MULTICOLOR_GRADIENT =
  "conic-gradient(from 0deg, #DC2626, #F97316, #FACC15, #16A34A, #2563EB, #9333EA, #DC2626)";

function ColorSwatch({ name }: { name: string }) {
  return (
    <span
      className="w-5 h-5 rounded-full border border-black/10 shrink-0"
      style={{ background: COLOR_SWATCHES[name] ?? MULTICOLOR_GRADIENT }}
    />
  );
}

function valuesForName(name: string, sizeSystem: SizeSystem): string[] {
  if (name === "Size") return [...SIZE_SYSTEMS[sizeSystem]];
  return VALUE_PRESETS[name] ?? [];
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
  const [sizeSystem, setSizeSystem] = useState<SizeSystem>("XXL");
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);

  // Keyboard should overlay this sheet, not resize/push it — same fix already
  // used on the camera/after-shot routes for the identical iOS Safari behavior.
  useLockedViewport();

  const isSizeOption = name === "Size";
  const isColorOption = name === "Color";
  const presetValues = valuesForName(name, sizeSystem);

  // Anything the seller typed (or picked under a different size system) stays
  // pinned above the presets so it never gets lost when the list swaps.
  const customValues = values.filter((v) => !presetValues.includes(v));

  const query = valueDraft.trim();
  const q = query.toLowerCase();
  const matches = (v: string) => !q || v.toLowerCase().includes(q);
  const visibleCustom = customValues.filter(matches);
  const visiblePresets = presetValues.filter(matches);
  const exactExists = [...customValues, ...presetValues].some((v) => v.toLowerCase() === q);
  const canCreate = !!query && !exactExists;

  const trimmedName = name.trim();
  const nameTaken = disabledNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase());
  const canSave = !!trimmedName && !nameTaken && values.length > 0;

  function toggleValue(v: string) {
    setValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  function createValue() {
    if (!canCreate) return;
    setValues((prev) => [...prev, query]);
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
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
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
            {/* Hard break between naming the option and choosing its values. */}
            <div className="-mx-4 h-2 bg-gray-50 my-6" />

            <div className="flex items-center justify-between mb-3">
              <p className="text-[15px] font-semibold text-gray-900">Values</p>
              {values.length > 0 && (
                <span className="text-xs text-gray-400">{values.length} selected</span>
              )}
            </div>

            <input
              value={valueDraft}
              onChange={(e) => setValueDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createValue();
                }
              }}
              placeholder="Add or search a value"
              className="w-full text-base border border-gray-200 rounded-xl px-4 py-4 outline-none focus:border-gray-400"
            />

            {isSizeOption && (
              <div className="relative flex justify-end mt-3">
                <button
                  type="button"
                  onClick={() => setSystemMenuOpen((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5"
                >
                  {sizeSystem}
                  <ChevronDown size={13} className="text-gray-400" />
                </button>
                {systemMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close size system menu"
                      onClick={() => setSystemMenuOpen(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-28">
                      {SIZE_SYSTEM_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSizeSystem(key);
                            setSystemMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left ${
                            key === sizeSystem ? "text-gray-900 font-medium" : "text-gray-600"
                          }`}
                        >
                          {key}
                          {key === sizeSystem && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className={`flex flex-col gap-2 ${isSizeOption ? "mt-3" : "mt-3"}`}>
              {canCreate && (
                <button
                  type="button"
                  onClick={createValue}
                  className="w-full flex items-center gap-3 border border-dashed border-gray-300 rounded-xl px-4 py-3.5 text-left"
                >
                  <Plus size={18} className="text-gray-400 shrink-0" />
                  <span className="text-[15px] text-gray-900">
                    Add “<span className="font-medium">{query}</span>”
                  </span>
                </button>
              )}

              {visibleCustom.map((v) => (
                <ValueRow
                  key={v}
                  label={v}
                  selected={values.includes(v)}
                  swatch={isColorOption ? <ColorSwatch name={v} /> : null}
                  onToggle={() => toggleValue(v)}
                  onRemove={() => removeValue(v)}
                />
              ))}

              {visiblePresets.map((v) => (
                <ValueRow
                  key={v}
                  label={v}
                  selected={values.includes(v)}
                  swatch={isColorOption ? <ColorSwatch name={v} /> : null}
                  onToggle={() => toggleValue(v)}
                />
              ))}

              {!canCreate && visibleCustom.length === 0 && visiblePresets.length === 0 && (
                <p className="text-sm text-gray-400 py-6 text-center">
                  {presetValues.length === 0
                    ? "Type a value above to add your first one."
                    : "No values match your search."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ValueRow({
  label,
  selected,
  swatch,
  onToggle,
  onRemove,
}: {
  label: string;
  selected: boolean;
  swatch: React.ReactNode;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`flex items-center rounded-xl border ${
        selected ? "border-black bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left min-w-0"
      >
        {swatch}
        <span className="text-[15px] text-gray-900 truncate">{label}</span>
        <span
          className={`ml-auto w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
            selected ? "bg-black border-black" : "border-gray-300"
          }`}
        >
          {selected && <Check size={13} className="text-white" />}
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="px-3 py-3.5 text-gray-300"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
