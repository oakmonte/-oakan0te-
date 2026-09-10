import { Check, ChevronDown, X } from "lucide-react";

// The two building blocks of every value picker in the product form: the
// genre/unit switcher pill, and the full-width selectable row.
//
// They live here rather than inside OptionEditorSheet because the Necessities
// checklist's MaterialSheet renders the same picker over the same vocabulary.
// A visual copy there drifted from this one within a single session (small
// wrapping chips vs. these rows), so the fix is to share the components, not
// to re-describe the design in two places.

// Extracted so it can render either before or after the value-entry input
// (Weight/Volume wants it first, everything else wants it last) without
// duplicating the ~35 lines of dropdown markup for each order.
export function SystemMenu({
  activeSystem,
  systemKeys,
  locked,
  open,
  onToggle,
  onSelect,
}: {
  activeSystem: string;
  systemKeys: string[];
  // Once true, every system but the active one is disabled rather than
  // removed -- visibly still there, but blocked, so switching mid-pick can't
  // silently mix values from two rival scales into one option. Only ever set
  // for the exclusive options; Material stays switchable throughout.
  locked: boolean;
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
              const disabled = locked && key !== activeSystem;
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

export function ValueRow({
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
