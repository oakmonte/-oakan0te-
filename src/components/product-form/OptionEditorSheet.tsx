import { useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { SystemMenu, ValueRow } from "./value-picker";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import type { VariantOption } from "./VariantMatrixBuilder";
import { MATERIAL_SYSTEMS, DEFAULT_MATERIAL_SYSTEM } from "@/lib/material-options";
import { COLOR_PRESETS, colorSwatchStyle, colorFamilyMembers } from "@/lib/color-options";
import { fuzzyScore } from "@/lib/fuzzy-search";

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
  Words: ["Extra Small", "Small", "Medium", "Large", "Extra Large", "2X Large", "3X Large"],
} as const;

// Footwear is numbered, not laddered: "M" is not a shoe size, and US 8 in
// shoes is not US 8 in dresses. Kept as its own map rather than folded into
// SIZE_SYSTEMS because that object is also OPTION_SYSTEMS.Size — the Size
// axis every apparel category shares — so adding shoe numbers to its US/UK/EU
// keys would offer them when sizing a t-shirt. Only the manual Size necessity
// (ManualSizeOnlySheet) switches between the two, on category.
export const SHOE_SIZE_SYSTEMS = {
  US: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "11", "12", "13"],
  UK: ["2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "8.5", "9.5", "10.5", "11.5"],
  EU: ["35", "36", "37", "38", "38.5", "39", "40", "41", "42", "43", "44", "45", "46", "47"],
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

// The unit actually appended to a typed digit ("275" -> "275 g") -- note mL's
// own preset strings are lowercase "ml" while the system key is "mL", so this
// can't just reuse the key verbatim or typed values would never dedupe
// against the presets.
const UNIT_SUFFIX: Record<string, string> = {
  g: "g",
  kg: "kg",
  oz: "oz",
  lb: "lb",
  mL: "ml",
  "fl oz": "fl oz",
  L: "L",
};

// For the "Write in the specific ___" placeholder on the typed-value row.
const UNIT_LABEL_PLURAL: Record<string, string> = {
  g: "grams",
  kg: "kilograms",
  oz: "ounces",
  lb: "pounds",
  mL: "milliliters",
  "fl oz": "fluid ounces",
  L: "liters",
};

// Options whose values are picked via a switchable unit/system, and the
// system each defaults to when the seller first picks that option name.
const OPTION_SYSTEMS: Record<string, Record<string, readonly string[]>> = {
  Size: SIZE_SYSTEMS,
  "Weight/Volume": WEIGHT_VOLUME_SYSTEMS,
  Material: MATERIAL_SYSTEMS,
};
const DEFAULT_SYSTEM: Record<string, string> = {
  Size: "XXL",
  "Weight/Volume": "g",
  Material: DEFAULT_MATERIAL_SYSTEM,
};

// Options whose systems are mutually EXCLUSIVE: once a value is picked, every
// other system is locked out, because they are competing notations for one
// thing and mixing them produces nonsense ("S" alongside "UK 12", "250 g"
// alongside "8 oz").
//
// Material is deliberately absent. Its genres are shelves in a single
// vocabulary, not rival scales -- a tote really is sold in "Canvas or
// Leather", and a beaded piece in "Brass or Pearl". Those cross two genres
// and are ordinary products, so Material gets the switcher purely as a way to
// browse 87 values without one endless scroll, and none of the locking.
const EXCLUSIVE_SYSTEM_OPTIONS = new Set(["Size", "Weight/Volume"]);

// Synthetic system a seller lands on the moment they type a free-text value —
// shows just what they've picked, with none of the current unit's untouched
// presets crowding underneath for no reason.
const CUSTOM_SYSTEM = "Custom";

// Module-level (not closed over the sheet's current `name`) so it can seed
// `selectedSystems` for EVERY option being reopened, not just whichever one
// happens to be open right now -- see the selectedSystems initializer below.
function ownerSystemForOption(optionName: string, value: string): string | null {
  const systems = OPTION_SYSTEMS[optionName];
  if (!systems) return null;
  for (const key of Object.keys(systems)) {
    if ((systems[key] as readonly string[]).includes(value)) return key;
  }
  return null;
}

// A Weight/Volume value typed through the numeric row ("275 g") is never a
// member of WEIGHT_VOLUME_SYSTEMS's own preset lists, so ownerSystemForOption
// above always returns null for it -- but it's still very much NOT a custom
// value the way a free-typed Size is: a live pick of it leaves the option's
// system exactly wherever it already was (see addValue's non-forced branch),
// which for the numeric row is always the unit whose suffix got appended to
// the digits. Reopening has to reconstruct that same unit from the value's
// own trailing suffix, or it wrongly falls back to CUSTOM_SYSTEM -- which
// then also breaks the numeric row itself (UNIT_SUFFIX has no "Custom" entry,
// so it appends the literal word "Custom" to whatever's typed next).
function unitKeyFromTypedValue(value: string): string | null {
  const match = value.trim().match(/^[\d.]+\s*(.+)$/);
  if (!match) return null;
  const unitPart = match[1].trim();
  const entry = Object.entries(UNIT_SUFFIX).find(([, suffix]) => suffix === unitPart);
  return entry ? entry[0] : null;
}

// One-tap values for the non-systemed presets — covers apparel/accessories/
// cosmetics/art without forcing typing. Free text still works for anything
// else. Both lists live in their own modules (color-options.ts,
// material-options.ts) because the Necessities checklist's own ColorSheet/
// MaterialSheet reuse those exact lists — and a second export here, alongside
// this file's component export, breaks Fast Refresh for it. Material is no
// longer here at all: it went to OPTION_SYSTEMS above once it grew genres.
const VALUE_PRESETS: Record<string, string[]> = {
  Color: COLOR_PRESETS,
};

function ColorSwatch({ name }: { name: string }) {
  return (
    <span
      className="w-5 h-5 rounded-full border border-black/10 shrink-0"
      style={{ background: colorSwatchStyle(name) }}
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
  // Weight/Volume's own typed-entry row (digits only, unit appended
  // automatically) -- kept separate from valueDraft since that one still
  // doubles as a search query for every other option type, and this one
  // never does.
  const [numericDraft, setNumericDraft] = useState("");
  // Values typed into the Weight/Volume numeric row, bucketed per option name
  // like everything else here. These are ADDED TO THE POOL, not selected --
  // tapping "Enter" below the box offers a new option alongside the existing
  // ones (pinned above them), the same as any other unselected preset; the
  // seller still has to tap it to actually choose it.
  const [customPoolByName, setCustomPoolByName] = useState<Record<string, string[]>>({});
  // Seeded from initialOptions, not just DEFAULT_SYSTEM -- reopening an
  // option that already has values (editing an existing product, or a
  // restored draft) has to pin to the system its FIRST value actually
  // belongs to, exactly like a live pick does via addValue below. Without
  // this, reopening e.g. an EU-sized Size option opened back on the XXL
  // ladder while hasChosen's lock disabled every other system -- the seller
  // could no longer add another EU size at all.
  const [selectedSystems, setSelectedSystems] = useState<Record<string, string>>(() => {
    const seeded: Record<string, string> = { ...DEFAULT_SYSTEM };
    for (const o of initialOptions) {
      if (o.values.length === 0 || !OPTION_SYSTEMS[o.name]) continue;
      // Preset value -> its owning system. Typed Weight/Volume value (never
      // a preset) -> the unit its own suffix names, same as a live pick
      // would leave it at -- see unitKeyFromTypedValue. That recovered unit
      // has to actually be a system of THIS option before it's trusted --
      // UNIT_SUFFIX's keys aren't scoped to Weight/Volume (e.g. "L" is also
      // a plausible trailing token on a free-typed Size like "20L" or "32 L"
      // for bag capacity/denim length), and pinning a Size option to a
      // nonexistent "L" system silently hides the system chip and disables
      // "Create" entirely -- the exact lockout this seeding exists to avoid.
      // Any other case (including a genuinely free-typed Size value, which a
      // live pick DOES force to Custom via createValue's forceCustomSystem)
      // falls through to CUSTOM_SYSTEM here.
      {
        const typedUnit = unitKeyFromTypedValue(o.values[0]);
        // CUSTOM_SYSTEM is only a valid landing spot for an option that can
        // actually offer it -- systemKeys only includes it while locked, i.e.
        // for the exclusive options. Seeding a non-exclusive one (Material)
        // to "Custom" pinned it to a genre absent from its own menu, whose
        // systemValues() is empty by definition: reopening a Material axis
        // whose first value was free-typed showed a phantom "Custom" pill
        // above an empty list, with no way back to any real genre.
        const fallback = EXCLUSIVE_SYSTEM_OPTIONS.has(o.name)
          ? CUSTOM_SYSTEM
          : (DEFAULT_SYSTEM[o.name] ?? Object.keys(OPTION_SYSTEMS[o.name])[0]);
        seeded[o.name] =
          ownerSystemForOption(o.name, o.values[0]) ??
          (typedUnit && OPTION_SYSTEMS[o.name][typedUnit] ? typedUnit : fallback);
      }
    }
    return seeded;
  });
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
  const isWeightVolume = name === "Weight/Volume";
  const systems = OPTION_SYSTEMS[name];
  const hasChosen = values.length > 0;
  // The "one system only" lock, and everything that follows from it. Applies
  // to Size and Weight/Volume; never to Material, whose genres are browsing
  // shelves rather than rival scales (see EXCLUSIVE_SYSTEM_OPTIONS).
  const systemsLocked = hasChosen && EXCLUSIVE_SYSTEM_OPTIONS.has(name);
  // Custom exists purely as the escape hatch FROM that lock, so an unlocked
  // option has no use for it -- free text is already always allowed there.
  const systemKeys = systems
    ? [...Object.keys(systems), ...(systemsLocked ? [CUSTOM_SYSTEM] : [])]
    : [];
  const activeSystem = selectedSystems[name] ?? DEFAULT_SYSTEM[name] ?? systemKeys[0];

  const query = valueDraft.trim();
  const q = query.toLowerCase();
  // Color gets a second, family-aware pass: "blue" also matches "Cobalt"/
  // "Navy"/"Sky" etc, on top of the plain substring check every other
  // option still uses.
  const colorFamilySet = isColorOption ? colorFamilyMembers(q) : null;
  // Substring first (cheap, and the exact behaviour sellers already expect),
  // then colour families, then a typo-tolerant pass so "chifon"/"polyster"
  // still find their value here -- the same forgiveness MaterialSheet has, so
  // the two pickers over the same vocabulary don't answer differently.
  const matches = (v: string) =>
    !q || v.toLowerCase().includes(q) || !!colorFamilySet?.has(v) || fuzzyScore(q, v) !== null;

  // Browsing stays scoped to the active unit; searching looks across every
  // unit at once so e.g. a size doesn't hide just because you're on "US" --
  // but only BEFORE anything's picked. Once a value's chosen, the option is
  // locked to that value's system (see addValue below), and letting search
  // reach across systems here would be the one remaining way to still slip a
  // cross-system value in despite the lock.
  const pool =
    systems && systemsLocked
      ? systemValues(name, activeSystem)
      : query
        ? allValues(name)
        : systemValues(name, activeSystem);

  // Every chosen value pins to the top regardless of which system it came
  // from; the pool below only lists what's left to pick.
  const chosen = values.filter(matches);
  // Seller-typed values (Weight/Volume's numeric row) pin above the regular
  // pool, same shelf position a chosen value gets among chosen ones -- newest
  // typed value first, so "20.56" lands above the default-first "25 g".
  const customPool = customPoolByName[name] ?? [];
  const remaining = [
    ...customPool.filter((v) => !values.includes(v) && matches(v)),
    ...pool.filter((v) => !values.includes(v) && !customPool.includes(v) && matches(v)),
  ];

  const exactExists = [...values, ...pool].some((v) => v.toLowerCase() === q);
  // Once locked to a system, typing a free-text value is only still allowed
  // if the lock itself is already "Custom" -- otherwise a typed string would
  // silently relabel the whole option's system out from under its existing
  // picks, the same mixing this is meant to prevent.
  const canCreate =
    !!query && !exactExists && (!systems || !systemsLocked || activeSystem === CUSTOM_SYSTEM);

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
  // The name being typed right now, if it's a genuinely new custom one, gets
  // its own live pill immediately -- appended last, blue-outlined via the
  // existing isActive styling below -- rather than waiting until values are
  // saved to appear at all.
  const showLivePill =
    name.trim().length > 0 &&
    !(PRESETS as readonly string[]).includes(name) &&
    !confirmedByName[name];
  const allPills: string[] = showLivePill
    ? [...PRESETS, ...customPills, name]
    : [...PRESETS, ...customPills];

  function updateValues(updater: (prev: string[]) => string[]) {
    setValuesByName((prev) => ({ ...prev, [name]: updater(prev[name] ?? []) }));
    setConfirmedByName((prev) => ({ ...prev, [name]: false }));
    setNameOrder((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  // Which system a preset value actually belongs to -- needed because e.g.
  // US and UK size numbers overlap, so activeSystem alone isn't reliable if
  // a value got picked while searching across every system at once.
  function ownerSystemFor(value: string): string | null {
    return ownerSystemForOption(name, value);
  }

  // Single add path for every way a value can be picked (tapping a preset,
  // typing a free-text one, or the Weight/Volume numeric row) -- so the
  // "no mixing genres" lock only has to be enforced in one place. On the
  // FIRST value for a systemed option, pins selectedSystems to whichever
  // system actually owns it (not just whatever activeSystem happens to say),
  // so every later pick in this session is confined to that same system.
  function addValue(
    v: string,
    { forceCustomSystem = false }: { forceCustomSystem?: boolean } = {},
  ) {
    if (values.includes(v)) return;
    if (systems && values.length === 0 && EXCLUSIVE_SYSTEM_OPTIONS.has(name)) {
      if (forceCustomSystem) {
        setSelectedSystems((prev) => ({ ...prev, [name]: CUSTOM_SYSTEM }));
      } else {
        const owner = ownerSystemFor(v);
        if (owner && owner !== activeSystem) {
          setSelectedSystems((prev) => ({ ...prev, [name]: owner }));
        }
      }
    }
    updateValues((prev) => [...prev, v]);
  }

  function toggleValue(v: string) {
    if (values.includes(v)) {
      updateValues((prev) => prev.filter((x) => x !== v));
    } else {
      addValue(v);
    }
  }

  function createValue() {
    if (!canCreate) return;
    addValue(query, { forceCustomSystem: true });
    setValueDraft("");
  }

  // Adds the typed number to the pool as a new, UNSELECTED option -- not to
  // `values` -- so it shows up alongside "25 g" etc. rather than being
  // auto-picked. The seller taps it afterward, same as any preset, if they
  // actually want it.
  function addNumericPoolValue() {
    const digits = numericDraft.trim();
    if (!digits) return;
    // Built from the normalized number, not the raw typed string -- a value
    // like "1.2.3" (an easy fat-finger on a decimal keypad) would otherwise
    // slip past the onChange filter below (which only excludes non-digit/dot
    // characters, not a second dot) and create an option whose visible label
    // and parsed weight_grams silently disagree.
    const amount = Number(digits);
    if (!isFinite(amount) || amount <= 0) return;
    const v = `${amount} ${UNIT_SUFFIX[activeSystem] ?? activeSystem}`;
    if (!values.includes(v) && !systemValues(name, activeSystem).includes(v)) {
      setCustomPoolByName((prev) => {
        const existing = prev[name] ?? [];
        if (existing.includes(v)) return prev;
        return { ...prev, [name]: [v, ...existing] };
      });
    }
    setNumericDraft("");
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
    setNumericDraft("");
    nameInputRef.current?.focus();
  }

  // Clears only the current name's bucket — other names keep whatever they hold.
  function cancelValues() {
    setValuesByName((prev) => dropKey(prev, name));
    setConfirmedByName((prev) => dropKey(prev, name));
    setSelectedSystems((prev) => dropKey(prev, name));
    setCustomPoolByName((prev) => dropKey(prev, name));
    setNameOrder((prev) => prev.filter((n) => n !== name));
    setValueDraft("");
    setNumericDraft("");
  }

  // Tapping a different preset chip *switches* options — each name keeps its
  // own values, so switching back restores exactly what was there.
  function selectName(p: string) {
    if (p === name) return;
    if (nameLocked) return;
    setName(p);
    setValueDraft("");
    setNumericDraft("");
  }

  // Typing in the name field is a *rename*, not a switch, so the values the
  // seller already picked follow the name they're still in the middle of typing.
  function renameName(next: string) {
    setValuesByName((prev) => moveKey(prev, name, next));
    setConfirmedByName((prev) => moveKey(prev, name, next));
    setSelectedSystems((prev) => moveKey(prev, name, next));
    // Without this, a value typed into the Weight/Volume numeric row (which
    // lives under the CURRENT name in customPoolByName) orphans the instant
    // the name field is edited -- the pool entry vanishes on the first
    // keystroke, unrecoverable unless the name is typed back to exactly
    // what it was.
    setCustomPoolByName((prev) => moveKey(prev, name, next));
    setNameOrder((prev) => prev.map((n) => (n === name ? next : n)));
    setName(next);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
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

            {isWeightVolume ? (
              <>
                {systems && (
                  <div className="mb-3">
                    <SystemMenu
                      activeSystem={activeSystem}
                      systemKeys={systemKeys}
                      locked={systemsLocked}
                      open={systemMenuOpen}
                      onToggle={() => setSystemMenuOpen((v) => !v)}
                      onSelect={(key) => {
                        setSelectedSystems((prev) => ({ ...prev, [name]: key }));
                        setSystemMenuOpen(false);
                      }}
                    />
                  </div>
                )}
                {/* Digits only, unit appended as a fixed suffix rather than
                    live-mutated inside the input -- avoids cursor-position
                    fights while still reading as "275 g" as they type. The
                    Enter button below (not an icon inside the box) is how
                    this gets added -- a decimal-only mobile keyboard often
                    has no working Enter/Go key at all, so the keydown
                    handler below is a bonus for keyboards that do send one,
                    never the only way in. */}
                <div className="flex items-center border border-gray-200 rounded-xl px-4 py-4 focus-within:border-gray-400">
                  <input
                    value={numericDraft}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/[^0-9.]/g, "");
                      // Collapse to at most one decimal point -- a stray
                      // second dot (easy to fat-finger on a decimal keypad)
                      // would otherwise sit in the field looking normal.
                      const firstDot = digitsOnly.indexOf(".");
                      setNumericDraft(
                        firstDot === -1
                          ? digitsOnly
                          : digitsOnly.slice(0, firstDot + 1) +
                              digitsOnly.slice(firstDot + 1).replace(/\./g, ""),
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addNumericPoolValue();
                      }
                    }}
                    inputMode="decimal"
                    placeholder={`Write in the specific ${UNIT_LABEL_PLURAL[activeSystem] ?? activeSystem}`}
                    className="flex-1 min-w-0 text-base outline-none bg-transparent"
                  />
                  {numericDraft && (
                    <span className="text-base text-gray-400 shrink-0 ml-1">
                      {UNIT_SUFFIX[activeSystem] ?? activeSystem}
                    </span>
                  )}
                </div>
                {numericDraft.trim() && (
                  <button
                    type="button"
                    onClick={addNumericPoolValue}
                    className="mt-2 w-full bg-black text-white text-sm font-medium rounded-xl py-3"
                  >
                    Enter
                  </button>
                )}
              </>
            ) : (
              <>
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
                  <div className="mt-3">
                    <SystemMenu
                      activeSystem={activeSystem}
                      systemKeys={systemKeys}
                      locked={systemsLocked}
                      open={systemMenuOpen}
                      onToggle={() => setSystemMenuOpen((v) => !v)}
                      onSelect={(key) => {
                        setSelectedSystems((prev) => ({ ...prev, [name]: key }));
                        setSystemMenuOpen(false);
                      }}
                    />
                  </div>
                )}
              </>
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
                    : query
                      ? "No values match your search."
                      : "You've added every preset value."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
