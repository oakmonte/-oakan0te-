import { useState } from "react";
import { X } from "lucide-react";

const PRESETS = ["Size", "Color", "Material", "Weight/Volume"] as const;

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
  const [customMode, setCustomMode] = useState(
    initialName !== "" && !PRESETS.includes(initialName as (typeof PRESETS)[number])
  );

  function addValue() {
    const v = valueDraft.trim();
    if (!v || values.includes(v)) return;
    setValues((prev) => [...prev, v]);
    setValueDraft("");
  }

  function removeValue(v: string) {
    setValues((prev) => prev.filter((x) => x !== v));
  }

  function handleDone() {
    if (!name.trim() || values.length === 0) return;
    onSave(name.trim(), values);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Option</span>
        <button
          onClick={handleDone}
          type="button"
          disabled={!name.trim() || values.length === 0}
          className="text-sm font-medium text-black disabled:text-gray-300"
        >
          Done
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {!customMode ? (
          <>
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
              <button
                type="button"
                onClick={() => {
                  setCustomMode(true);
                  setName("");
                }}
                className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-300 text-gray-500"
              >
                Custom…
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoFocus
              className="w-full text-base border border-gray-300 rounded-lg px-3 py-3 outline-none mb-1"
            />
            <button
              type="button"
              onClick={() => setCustomMode(false)}
              className="text-xs text-gray-400 mb-3"
            >
              Choose from presets instead
            </button>
          </>
        )}

        {name && (
          <>
            <p className="text-xs text-gray-400 mt-4 mb-2">Values</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {values.map((v) => (
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