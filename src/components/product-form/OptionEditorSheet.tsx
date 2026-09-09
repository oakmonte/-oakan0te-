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
};
const DEFAULT_SYSTEM: Record<string, string> = { Size: "XXL", "Weight/Volume": "g" };

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
// else. Material lives in its own module (material-options.ts): MaterialSheet
// reuses that exact list for a regular product's material field, and a
// second export here (alongside this file's component export) breaks Fast
// Refresh for it.
const VALUE_PRESETS: Record<string, string[]> = {
  Color: [
    // Black / white / grey
    "Black",
    "Jet Black",
    "Onyx",
    "Ebony",
    "Charcoal",
    "Graphite",
    "Gunmetal",
    "Slate",
    "Grey",
    "Ash Grey",
    "Steel Grey",
    "Dove Grey",
    "Pewter",
    "Smoke",
    "Stone",
    "Silver",
    "White",
    "Off White",
    "Ivory",
    "Cream",
    "Eggshell",
    "Pearl",
    "Bone",
    // Brown / tan / beige
    "Brown",
    "Chocolate",
    "Espresso",
    "Coffee",
    "Mocha",
    "Umber",
    "Sienna",
    "Mahogany",
    "Walnut",
    "Chestnut",
    "Cognac",
    "Caramel",
    "Toffee",
    "Tan",
    "Camel",
    "Nude",
    "Khaki",
    "Taupe",
    "Sand",
    "Beige",
    "Terracotta",
    // Red
    "Red",
    "Crimson",
    "Scarlet",
    "Cherry",
    "Ruby",
    "Brick Red",
    "Wine",
    "Maroon",
    "Burgundy",
    "Garnet",
    "Rust",
    // Orange
    "Orange",
    "Burnt Orange",
    "Tangerine",
    "Apricot",
    "Coral",
    "Salmon",
    "Peach",
    "Amber",
    "Copper",
    "Bronze",
    // Yellow
    "Yellow",
    "Mustard",
    "Gold",
    "Lemon",
    "Canary",
    "Honey",
    "Butter",
    "Ochre",
    // Green
    "Green",
    "Emerald",
    "Forest",
    "Hunter Green",
    "Sage",
    "Olive",
    "Moss",
    "Mint",
    "Seafoam",
    "Pistachio",
    "Lime",
    "Jade",
    "Teal",
    "Turquoise",
    // Blue
    "Sky",
    "Baby Blue",
    "Powder Blue",
    "Ice Blue",
    "Cerulean",
    "Blue",
    "Royal Blue",
    "Cobalt",
    "Denim",
    "Steel Blue",
    "Periwinkle",
    "Navy",
    "Indigo",
    // Purple
    "Violet",
    "Purple",
    "Lilac",
    "Lavender",
    "Wisteria",
    "Orchid",
    "Amethyst",
    "Plum",
    "Eggplant",
    "Grape",
    "Mauve",
    // Pink
    "Pink",
    "Blush",
    "Baby Pink",
    "Dusty Pink",
    "Bubblegum",
    "Hot Pink",
    "Rose",
    "Magenta",
    "Fuchsia",
    // Metallic / other
    "Rose Gold",
    "Champagne",
    "Multicolor",
  ],
  Material: MATERIAL_PRESETS,
};

// Real swatches for Color — a dot per name reads as "this app understands
// color" where a plain text row reads generic. Multicolor gets a gradient.
const COLOR_SWATCHES: Record<string, string> = {
  Black: "#111111",
  "Jet Black": "#060606",
  Onyx: "#0F0F0F",
  Ebony: "#3D2B1F",
  Charcoal: "#36454F",
  Graphite: "#4B4B4B",
  Gunmetal: "#2A3439",
  Slate: "#708090",
  Grey: "#9CA3AF",
  "Ash Grey": "#B2BEB5",
  "Steel Grey": "#71797E",
  "Dove Grey": "#6E6E6E",
  Pewter: "#96A8A1",
  Smoke: "#848884",
  Stone: "#928E85",
  Silver: "#C0C0C0",
  White: "#FFFFFF",
  "Off White": "#F5F5F0",
  Ivory: "#FFFFF0",
  Cream: "#F5EEDC",
  Eggshell: "#F0EAD6",
  Pearl: "#EAE0C8",
  Bone: "#E3DAC9",
  Brown: "#7B4B2A",
  Chocolate: "#4E2A1E",
  Espresso: "#3C2415",
  Coffee: "#4B3621",
  Mocha: "#6F4E37",
  Umber: "#635147",
  Sienna: "#A0522D",
  Mahogany: "#4A2511",
  Walnut: "#5C4033",
  Chestnut: "#954535",
  Cognac: "#9A463D",
  Caramel: "#C68E3F",
  Toffee: "#7C4A2D",
  Tan: "#D2B48C",
  Camel: "#C19A6B",
  Nude: "#E3BFA0",
  Khaki: "#BDB76B",
  Taupe: "#8B7D6B",
  Sand: "#C2B280",
  Beige: "#D9C7AA",
  Terracotta: "#E2725B",
  Red: "#DC2626",
  Crimson: "#DC143C",
  Scarlet: "#FF2400",
  Cherry: "#9E1B32",
  Ruby: "#9B111E",
  "Brick Red": "#B04A3B",
  Wine: "#722F37",
  Maroon: "#800000",
  Burgundy: "#6D071A",
  Garnet: "#733635",
  Rust: "#B7410E",
  Orange: "#F97316",
  "Burnt Orange": "#CC5500",
  Tangerine: "#F28500",
  Apricot: "#FBCEB1",
  Coral: "#FF7F50",
  Salmon: "#FA8072",
  Peach: "#FFCBA4",
  Amber: "#FFBF00",
  Copper: "#B87333",
  Bronze: "#CD7F32",
  Yellow: "#FACC15",
  Mustard: "#E1AD01",
  Gold: "#D4AF37",
  Lemon: "#FFF44F",
  Canary: "#FFFF99",
  Honey: "#E8A33D",
  Butter: "#FFF1A8",
  Ochre: "#CC7722",
  Green: "#16A34A",
  Emerald: "#10B981",
  Forest: "#228B22",
  "Hunter Green": "#355E3B",
  Sage: "#9CAF88",
  Olive: "#6B8E23",
  Moss: "#8A9A5B",
  Mint: "#6EE7B7",
  Seafoam: "#9FE2BF",
  Pistachio: "#93C572",
  Lime: "#A8C33B",
  Jade: "#00A86B",
  Teal: "#14B8A6",
  Turquoise: "#40E0D0",
  Sky: "#87CEEB",
  "Baby Blue": "#89CFF0",
  "Powder Blue": "#B0E0E6",
  "Ice Blue": "#D6ECF0",
  Cerulean: "#007BA7",
  Blue: "#2563EB",
  "Royal Blue": "#4169E1",
  Cobalt: "#0047AB",
  Denim: "#1560BD",
  "Steel Blue": "#4682B4",
  Periwinkle: "#CCCCFF",
  Navy: "#1E3A8A",
  Indigo: "#4338CA",
  Violet: "#7C3AED",
  Purple: "#9333EA",
  Lilac: "#C8A2C8",
  Lavender: "#C4B5FD",
  Wisteria: "#C9A0DC",
  Orchid: "#DA70D6",
  Amethyst: "#9966CC",
  Plum: "#8E4585",
  Eggplant: "#614051",
  Grape: "#6F2DA8",
  Mauve: "#B784A7",
  Pink: "#EC4899",
  Blush: "#F7C6C7",
  "Baby Pink": "#F4C2C2",
  "Dusty Pink": "#D8A7B1",
  Bubblegum: "#FFC1CC",
  "Hot Pink": "#FF69B4",
  Rose: "#E0708C",
  Magenta: "#C2185B",
  Fuchsia: "#D946EF",
  "Rose Gold": "#B76E79",
  Champagne: "#F7E7CE",
};

// Broad, everyday color words a seller is likely to type (blue, brown,
// purple...) mapped to every preset shade that actually belongs to that
// family -- named shades rarely contain the family word in their own string
// (e.g. "Cobalt" has no "blue" in it, "Lilac" has no "purple" in it), so a
// plain substring search alone would never surface them. One shade can sit
// in more than one family on purpose (Fuchsia reads as both pink and
// purple, Rust as both red and orange) -- these are fashion groupings, not
// a strict color-wheel partition.
const COLOR_FAMILIES: Record<string, string[]> = {
  black: ["Black", "Jet Black", "Onyx", "Ebony", "Charcoal"],
  white: ["White", "Off White", "Ivory", "Cream", "Eggshell", "Pearl", "Bone"],
  grey: [
    "Grey",
    "Charcoal",
    "Graphite",
    "Gunmetal",
    "Slate",
    "Ash Grey",
    "Steel Grey",
    "Dove Grey",
    "Silver",
    "Pewter",
    "Smoke",
    "Stone",
  ],
  gray: [
    "Grey",
    "Charcoal",
    "Graphite",
    "Gunmetal",
    "Slate",
    "Ash Grey",
    "Steel Grey",
    "Dove Grey",
    "Silver",
    "Pewter",
    "Smoke",
    "Stone",
  ],
  brown: [
    "Brown",
    "Chocolate",
    "Espresso",
    "Coffee",
    "Mocha",
    "Umber",
    "Sienna",
    "Mahogany",
    "Walnut",
    "Chestnut",
    "Cognac",
    "Caramel",
    "Toffee",
    "Tan",
    "Camel",
    "Taupe",
  ],
  tan: ["Tan", "Camel", "Khaki", "Taupe", "Sand", "Beige", "Nude"],
  beige: ["Beige", "Sand", "Cream", "Nude", "Taupe", "Ivory"],
  red: [
    "Red",
    "Crimson",
    "Scarlet",
    "Cherry",
    "Ruby",
    "Brick Red",
    "Wine",
    "Maroon",
    "Burgundy",
    "Garnet",
    "Rust",
  ],
  orange: [
    "Orange",
    "Burnt Orange",
    "Tangerine",
    "Apricot",
    "Coral",
    "Peach",
    "Amber",
    "Rust",
    "Copper",
    "Terracotta",
  ],
  yellow: ["Yellow", "Mustard", "Gold", "Lemon", "Canary", "Honey", "Butter", "Ochre"],
  green: [
    "Green",
    "Emerald",
    "Forest",
    "Hunter Green",
    "Sage",
    "Olive",
    "Moss",
    "Mint",
    "Seafoam",
    "Pistachio",
    "Lime",
    "Jade",
  ],
  teal: ["Teal", "Turquoise", "Jade", "Seafoam"],
  blue: [
    "Sky",
    "Baby Blue",
    "Powder Blue",
    "Ice Blue",
    "Cerulean",
    "Blue",
    "Royal Blue",
    "Cobalt",
    "Denim",
    "Steel Blue",
    "Periwinkle",
    "Navy",
    "Indigo",
    "Turquoise",
    "Teal",
  ],
  navy: ["Navy", "Indigo", "Royal Blue"],
  purple: [
    "Violet",
    "Purple",
    "Lilac",
    "Lavender",
    "Wisteria",
    "Orchid",
    "Amethyst",
    "Plum",
    "Eggplant",
    "Grape",
    "Mauve",
    "Fuchsia",
  ],
  violet: ["Violet", "Purple", "Lavender", "Lilac", "Wisteria", "Amethyst"],
  pink: [
    "Pink",
    "Blush",
    "Baby Pink",
    "Dusty Pink",
    "Bubblegum",
    "Hot Pink",
    "Rose",
    "Magenta",
    "Fuchsia",
    "Salmon",
    "Mauve",
  ],
  gold: ["Gold", "Bronze", "Copper", "Rose Gold", "Champagne", "Mustard"],
  silver: ["Silver", "Pewter", "Steel Grey", "Gunmetal"],
  metallic: ["Gold", "Silver", "Bronze", "Copper", "Rose Gold", "Champagne", "Pewter", "Gunmetal"],
};

// Only expands into a whole family once the query is a real word fragment --
// under 3 characters, most family keys contain it as a substring (e.g. "b"
// is inside "black", "blue", AND "brown"), which would explode the list
// instead of narrowing it. startsWith in both directions (not includes)
// covers a partial type-ahead ("pur" -> "purple") and a plural/longer form
// ("blues"/"purples" -> "blue"/"purple") without that false-positive.
function colorFamilyMembers(q: string): Set<string> | null {
  if (q.length < 3) return null;
  let members: Set<string> | null = null;
  for (const [family, list] of Object.entries(COLOR_FAMILIES)) {
    // family.startsWith(q) is the type-ahead direction ("pur" -> "purple").
    // q === family + "s" is a plural ("blues" -> "blue"). q's words
    // including family whole is a multi-word descriptive query ("navy
    // blue", "light blue" -> "blue") -- checked as a WHOLE word, not
    // q.startsWith(family)/q.includes(family), because either of those
    // would also fire on any preset name that happens to start with or
    // contain a short family key (e.g. "tangerine" contains "tan"),
    // pulling in that whole unrelated family right as the seller finishes
    // typing an exact match.
    if (family.startsWith(q) || q === family + "s" || q.split(/\s+/).includes(family)) {
      members ??= new Set();
      for (const v of list) members.add(v);
    }
  }
  return members;
}

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
        seeded[o.name] =
          ownerSystemForOption(o.name, o.values[0]) ??
          (typedUnit && OPTION_SYSTEMS[o.name][typedUnit] ? typedUnit : CUSTOM_SYSTEM);
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
  const systemKeys = systems
    ? [...Object.keys(systems), ...(hasChosen ? [CUSTOM_SYSTEM] : [])]
    : [];
  const activeSystem = selectedSystems[name] ?? DEFAULT_SYSTEM[name] ?? systemKeys[0];

  const query = valueDraft.trim();
  const q = query.toLowerCase();
  // Color gets a second, family-aware pass: "blue" also matches "Cobalt"/
  // "Navy"/"Sky" etc, on top of the plain substring check every other
  // option still uses.
  const colorFamilySet = isColorOption ? colorFamilyMembers(q) : null;
  const matches = (v: string) => !q || v.toLowerCase().includes(q) || !!colorFamilySet?.has(v);

  // Browsing stays scoped to the active unit; searching looks across every
  // unit at once so e.g. a size doesn't hide just because you're on "US" --
  // but only BEFORE anything's picked. Once a value's chosen, the option is
  // locked to that value's system (see addValue below), and letting search
  // reach across systems here would be the one remaining way to still slip a
  // cross-system value in despite the lock.
  const pool =
    systems && hasChosen
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
    !!query && !exactExists && (!systems || !hasChosen || activeSystem === CUSTOM_SYSTEM);

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
    if (systems && values.length === 0) {
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

            {isWeightVolume ? (
              <>
                {systems && (
                  <div className="mb-3">
                    <UnitSystemMenu
                      activeSystem={activeSystem}
                      systemKeys={systemKeys}
                      hasChosen={hasChosen}
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
                    <UnitSystemMenu
                      activeSystem={activeSystem}
                      systemKeys={systemKeys}
                      hasChosen={hasChosen}
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

// Extracted so it can render either before or after the value-entry input
// (Weight/Volume wants it first, everything else wants it last) without
// duplicating the ~35 lines of dropdown markup for each order.
function UnitSystemMenu({
  activeSystem,
  systemKeys,
  hasChosen,
  open,
  onToggle,
  onSelect,
}: {
  activeSystem: string;
  systemKeys: string[];
  // Once true, every system but the active one is disabled rather than
  // removed -- visibly still there, but blocked, so switching mid-pick can't
  // silently mix values from two different genres into one option.
  hasChosen: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5"
      >
        {activeSystem}
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close unit menu"
            onClick={onToggle}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-28">
            {systemKeys.map((key) => {
              const disabled = hasChosen && key !== activeSystem;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(key)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left ${
                    key === activeSystem
                      ? "text-gray-900 font-medium"
                      : disabled
                        ? "text-gray-300"
                        : "text-gray-600"
                  }`}
                >
                  {key}
                  {key === activeSystem && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </>
      )}
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
