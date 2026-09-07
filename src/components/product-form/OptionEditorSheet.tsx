import { useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import type { VariantOption } from "./VariantMatrixBuilder";
import { MATERIAL_PRESETS } from "@/lib/material-options";

const PRESETS = ["Size", "Color", "Material", "Weight/Volume"] as const;

// Size and Weight/Volume are the two options where the *same* thing is
// described by different scales depending on the seller/market — so they get
// a switchable system rather than one hardcoded list.
// Every system in a group stays index-independent (no code cross-references
// them positionally), but they're kept the same *length* here on purpose —
// XXL/US/UK/EU/Words are the same real-world size ladder in different
// notations, and a mismatched length would be the first sign one of them
// drifted. EU follows the standard EU = US + 32 conversion (EU 32 = US 0).
export const SIZE_SYSTEMS = {
  XXL: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"],
  US: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20"],
  UK: ["4", "6", "8", "10", "12", "14", "16", "18", "20", "22", "24"],
  EU: ["32", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52"],
  Words: ["Small", "Medium", "Large", "Extra Large", "2X Large", "3X Large"],
} as const;

export const WEIGHT_VOLUME_SYSTEMS = {
  g: ["25 g", "50 g", "100 g", "250 g", "500 g", "750 g", "1000 g"],
  kg: ["0.5 kg", "1 kg", "1.5 kg", "2 kg", "3 kg", "5 kg", "10 kg", "15 kg", "20 kg", "30 kg"],
  oz: ["1 oz", "2 oz", "4 oz", "8 oz", "16 oz", "32 oz", "64 oz"],
  lb: ["0.5 lb", "1 lb", "2 lb", "5 lb", "10 lb", "20 lb", "50 lb", "75 lb", "100 lb"],
  mL: ["30 ml", "50 ml", "100 ml", "250 ml", "500 ml", "750 ml", "1000 ml"],
  "fl oz": ["1 fl oz", "2 fl oz", "4 fl oz", "8 fl oz", "16 fl oz", "32 fl oz", "64 fl oz"],
  L: ["0.5 L", "1 L", "1.5 L", "2 L", "3 L", "5 L", "10 L"],
} as const;

// Options whose values are picked via a switchable unit/system, and the
// system each defaults to when the seller first picks that option name.
const OPTION_SYSTEMS: Record<string, Record<string, readonly string[]>> = {
  Size: SIZE_SYSTEMS,
  "Weight/Volume": WEIGHT_VOLUME_SYSTEMS,
};
const DEFAULT_SYSTEM: Record<string, string> = { Size: "XXL", "Weight/Volume": "g" };

// Synthetic system a seller lands on the moment they type a free-text value —
// shows just what they've picked, with none of the current unit's untouched
// presets crowding underneath for no reason.
const CUSTOM_SYSTEM = "Custom";

// One-tap values for the non-systemed presets — covers apparel/accessories/
// cosmetics/art without forcing typing. Free text still works for anything
// else. Material lives in its own module (material-options.ts): MaterialSheet
// reuses that exact list for a regular product's material field, and a
// second export here (alongside this file's component export) breaks Fast
// Refresh for it.
const VALUE_PRESETS: Record<string, string[]> = {
  Color: [
    "Black",
    "White",
    "Grey",
    "Charcoal",
    "Stone",
    "Ivory",
    "Cream",
    "Beige",
    "Sand",
    "Taupe",
    "Tan",
    "Camel",
    "Nude",
    "Khaki",
    "Brown",
    "Chocolate",
    "Mocha",
    "Copper",
    "Bronze",
    "Rust",
    "Red",
    "Wine",
    "Maroon",
    "Burgundy",
    "Orange",
    "Coral",
    "Salmon",
    "Peach",
    "Blush",
    "Yellow",
    "Mustard",
    "Gold",
    "Green",
    "Emerald",
    "Forest",
    "Sage",
    "Olive",
    "Mint",
    "Teal",
    "Turquoise",
    "Sky",
    "Blue",
    "Cobalt",
    "Navy",
    "Indigo",
    "Violet",
    "Purple",
    "Plum",
    "Mauve",
    "Lavender",
    "Pink",
    "Rose",
    "Magenta",
    "Fuchsia",
    "Silver",
    "Multicolor",
  ],
  Material: MATERIAL_PRESETS,
};

// Real swatches for Color — a dot per name reads as "this app understands
// color" where a plain text row reads generic. Multicolor gets a gradient.
const COLOR_SWATCHES: Record<string, string> = {
  Black: "#111111",
  White: "#FFFFFF",
  Grey: "#9CA3AF",
  Charcoal: "#36454F",
  Stone: "#928E85",
  Ivory: "#FFFFF0",
  Cream: "#F5EEDC",
  Beige: "#D9C7AA",
  Sand: "#C2B280",
  Taupe: "#8B7D6B",
  Tan: "#D2B48C",
  Camel: "#C19A6B",
  Nude: "#E3BFA0",
  Khaki: "#BDB76B",
  Brown: "#7B4B2A",
  Chocolate: "#4E2A1E",
  Mocha: "#6F4E37",
  Copper: "#B87333",
  Bronze: "#CD7F32",
  Rust: "#B7410E",
  Red: "#DC2626",
  Wine: "#722F37",
  Maroon: "#800000",
  Burgundy: "#6D071A",
  Orange: "#F97316",
  Coral: "#FF7F50",
  Salmon: "#FA8072",
  Peach: "#FFCBA4",
  Blush: "#F7C6C7",
  Yellow: "#FACC15",
  Mustard: "#E1AD01",
  Gold: "#D4AF37",
  Green: "#16A34A",
  Emerald: "#10B981",
  Forest: "#228B22",
  Sage: "#9CAF88",
  Olive: "#6B8E23",
  Mint: "#6EE7B7",
  Teal: "#14B8A6",
  Turquoise: "#40E0D0",
  Sky: "#87CEEB",
  Blue: "#2563EB",
  Cobalt: "#0047AB",
  Navy: "#1E3A8A",
  Indigo: "#4338CA",
  Violet: "#7C3AED",
  Purple: "#9333EA",
  Plum: "#8E4585",
  Mauve: "#B784A7",
  Lavender: "#C4B5FD",
  Pink: "#EC4899",
  Rose: "#E0708C",
  Magenta: "#C2185B",
  Fuchsia: "#D946EF",
  Silver: "#C0C0C0",
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

// The pool for one system/unit — used while browsing (not actively searching).
function systemValues(name: string, systemKey: string): string[] {
  if (systemKey === CUSTOM_SYSTEM) return [];
  const systems = OPTION_SYSTEMS[name];
  if (systems) return [...(systems[systemKey] ?? Object.values(systems)[0])];
  return VALUE_PRESETS[name] ?? [];
}

// Every value across every system for this option, deduped — used while
// actively searching, so a query typed under one unit still finds matches
// that live under another (e.g. searching while on "US" still finds "UK" sizes).
function allValues(name: string): string[] {
  const systems = OPTION_SYSTEMS[name];
  if (!systems) return VALUE_PRESETS[name] ?? [];
  const seen = new Set<string>();
  for (const key of Object.keys(systems)) for (const v of systems[key]) seen.add(v);
  return [...seen];
}

function dropKey<T>(rec: Record<string, T>, key: string): Record<string, T> {
  if (!(key in rec)) return rec;
  const next = { ...rec };
  delete next[key];
  return next;
}

function moveKey<T>(rec: Record<string, T>, from: string, to: string): Record<string, T> {
  if (from === to || !(from in rec)) return rec;
  const next = { ...rec };
  next[to] = next[from];
  delete next[from];
  return next;
}

export function OptionEditorSheet({
  initialOptions,
  initialName,
  maxOptions = 2,
  onSave,
  onClose,
}: {
  initialOptions: VariantOption[];
  initialName: string;
  maxOptions?: number;
  onSave: (options: VariantOption[]) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  // Values are bucketed *per option name*, not held in one shared list: tapping
  // Color to peek and tapping Size again must bring Size's picks back, and
  // Size's "M"/"L" must never leak into Color. One flat list can't do both.
  const [valuesByName, setValuesByName] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialOptions.map((o) => [o.name, o.values])),
  );
  // Which option is option1 vs option2 is positional in the DB, so the order
  // names were first given values has to survive edits and renames.
  const [nameOrder, setNameOrder] = useState<string[]>(() => initialOptions.map((o) => o.name));
  // Anything handed in already has saved values from a prior pass through
  // this sheet — starting it unconfirmed locked navigation behind a
  // redundant Save on every pill, and turned an accidental Cancel into data
  // loss for values that were never actually being edited.
  const [confirmedByName, setConfirmedByName] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      initialOptions.filter((o) => o.values.length > 0).map((o) => [o.name, true]),
    ),
  );
  const [valueDraft, setValueDraft] = useState("");
  const [selectedSystems, setSelectedSystems] = useState<Record<string, string>>(DEFAULT_SYSTEM);
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Keyboard should overlay this sheet, not resize/push it — same fix already
  // used on the camera/after-shot routes for the identical iOS Safari behavior.
  useLockedViewport();

  const values = valuesByName[name] ?? [];
  // Starts unconfirmed whenever there's anything to lose — including pre-existing
  // values on an option being edited — so a stray tap can't silently strand them.
  const confirmed = confirmedByName[name] ?? false;

  const isColorOption = name === "Color";
  const systems = OPTION_SYSTEMS[name];
  const hasChosen = values.length > 0;
  const systemKeys = systems
    ? [...Object.keys(systems), ...(hasChosen ? [CUSTOM_SYSTEM] : [])]
    : [];
  const activeSystem = selectedSystems[name] ?? DEFAULT_SYSTEM[name] ?? systemKeys[0];

  const query = valueDraft.trim();
  const q = query.toLowerCase();
  const matches = (v: string) => !q || v.toLowerCase().includes(q);

  // Browsing stays scoped to the active unit; searching looks across every
  // unit at once so e.g. a size doesn't hide just because you're on "US".
  const pool = query ? allValues(name) : systemValues(name, activeSystem);

  // Every chosen value pins to the top regardless of which system it came
  // from; the pool below only lists what's left to pick.
  const chosen = values.filter(matches);
  const remaining = pool.filter((v) => !values.includes(v) && matches(v));

  const exactExists = [...values, ...pool].some((v) => v.toLowerCase() === q);
  const canCreate = !!query && !exactExists;

  // Every name that actually holds values — these are the options that will be
  // emitted, not just whichever one happens to be on screen when "Next" is hit.
  const definedNames = nameOrder.filter((n) => n.trim() && (valuesByName[n]?.length ?? 0) > 0);
  const atCap = definedNames.length >= maxOptions;
  const canSave = definedNames.length > 0;
  // Unconfirmed picks block switching to a different option name — the seller
  // has to Save or Cancel them first, so moving on is always a deliberate act.
  const nameLocked = hasChosen && !confirmed;

  // Confirmed custom names ride alongside the presets in the same pill row —
  // once saved they're just another option you can tap back into, same as
  // Size or Color. Unconfirmed ones don't show yet; the pill is the "saved" cue.
  const customPills = nameOrder.filter(
    (n) => n.trim() && !(PRESETS as readonly string[]).includes(n) && confirmedByName[n],
  );
  const allPills: string[] = [...PRESETS, ...customPills];

  function updateValues(updater: (prev: string[]) => string[]) {
    setValuesByName((prev) => ({ ...prev, [name]: updater(prev[name] ?? []) }));
    setConfirmedByName((prev) => ({ ...prev, [name]: false }));
    setNameOrder((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  function toggleValue(v: string) {
    updateValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  function createValue() {
    if (!canCreate) return;
    updateValues((prev) => [...prev, query]);
    setValueDraft("");
    if (systems) setSelectedSystems((prev) => ({ ...prev, [name]: CUSTOM_SYSTEM }));
  }

  function removeValue(v: string) {
    updateValues((prev) => prev.filter((x) => x !== v));
  }

  // Emits *every* option defined in this sheet, not just the visible one — a
  // seller who fills in Size, then Color, then taps Next expects both to land.
  function handleSave() {
    if (!canSave) return;
    const seen = new Set<string>();
    const out: VariantOption[] = [];
    for (const n of definedNames) {
      const trimmed = n.trim();
      if (seen.has(trimmed.toLowerCase())) continue;
      seen.add(trimmed.toLowerCase());
      out.push({ name: trimmed, values: valuesByName[n] });
      if (out.length >= maxOptions) break;
    }
    onSave(out);
  }

  function confirmValues() {
    setConfirmedByName((prev) => ({ ...prev, [name]: true }));
    // Clear the slate so the seller can start the next option right away —
    // its pill now lives in the row above, already marked done.
    setName("");
    setValueDraft("");
    nameInputRef.current?.focus();
  }

  // Clears only the current name's bucket — other names keep whatever they hold.
  function cancelValues() {
    setValuesByName((prev) => dropKey(prev, name));
    setConfirmedByName((prev) => dropKey(prev, name));
    setSelectedSystems((prev) => dropKey(prev, name));
    setNameOrder((prev) => prev.filter((n) => n !== name));
    setValueDraft("");
  }

  // Tapping a different preset chip *switches* options — each name keeps its
  // own values, so switching back restores exactly what was there.
  function selectName(p: string) {
    if (p === name) return;
    if (nameLocked) return;
    setName(p);
    setValueDraft("");
  }

  // Typing in the name field is a *rename*, not a switch, so the values the
  // seller already picked follow the name they're still in the middle of typing.
  function renameName(next: string) {
    setValuesByName((prev) => moveKey(prev, name, next));
    setConfirmedByName((prev) => moveKey(prev, name, next));
    setSelectedSystems((prev) => moveKey(prev, name, next));
    setNameOrder((prev) => prev.map((n) => (n === name ? next : n)));
    setName(next);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
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
          Next
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <input
          ref={nameInputRef}
          value={name}
          onChange={(e) => renameName(e.target.value)}
          placeholder="Option name e.g size, colour... etc"
          autoFocus={!initialName}
          className="w-full text-lg font-medium text-gray-900 border border-gray-200 rounded-xl px-4 py-4 outline-none focus:border-gray-400 mb-3"
        />
        <div className="flex flex-wrap gap-2">
          {allPills.map((p) => {
            // Tapping an already-defined name now *edits* it rather than being
            // blocked, so the only hard stop is the option cap itself.
            const disabled =
              (nameLocked && p !== name) || (atCap && !definedNames.includes(p) && p !== name);
            // Black fill means values are actually saved for this name — not
            // just that it's the one currently open. Being open with nothing
            // confirmed yet only gets a blue outline, so the seller can tell
            // "editing" apart from "done" at a glance.
            const isConfirmed = confirmedByName[p] ?? false;
            const isActive = name === p && !isConfirmed;
            return (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => selectName(p)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  isConfirmed
                    ? "bg-black text-white border-black"
                    : isActive
                      ? "bg-white text-gray-900 border-blue-500"
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

            {systems && (
              <div className="relative flex justify-end mt-3">
                <button
                  type="button"
                  onClick={() => setSystemMenuOpen((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5"
                >
                  {activeSystem}
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
                      {systemKeys.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setSelectedSystems((prev) => ({ ...prev, [name]: key }));
                            setSystemMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left ${
                            key === activeSystem ? "text-gray-900 font-medium" : "text-gray-600"
                          }`}
                        >
                          {key}
                          {key === activeSystem && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 mt-3">
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

              {chosen.map((v) => (
                <ValueRow
                  key={v}
                  label={v}
                  selected
                  swatch={isColorOption ? <ColorSwatch name={v} /> : null}
                  onToggle={() => toggleValue(v)}
                  onRemove={() => removeValue(v)}
                />
              ))}

              {/* Demarcation between what's chosen and what's still pickable — also
                  the checkpoint a seller must clear before switching option names. */}
              {hasChosen && (
                <div className="flex items-center gap-2 pt-1 pb-4">
                  <button
                    type="button"
                    onClick={confirmValues}
                    className="flex-1 bg-black text-white text-sm font-medium rounded-lg py-2.5"
                  >
                    {confirmed ? <Check size={16} className="mx-auto" /> : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelValues}
                    className="flex-1 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg py-2.5"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {remaining.map((v) => (
                <ValueRow
                  key={v}
                  label={v}
                  selected={false}
                  swatch={isColorOption ? <ColorSwatch name={v} /> : null}
                  onToggle={() => toggleValue(v)}
                />
              ))}

              {!canCreate && chosen.length === 0 && remaining.length === 0 && (
                <p className="text-sm text-gray-400 py-6 text-center">
                  {pool.length === 0
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
