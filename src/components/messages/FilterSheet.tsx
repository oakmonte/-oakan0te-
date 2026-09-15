import { Check } from "lucide-react";
import type { FilterKey } from "@/lib/messages-seed";
import { FILTERS } from "@/lib/messages-filters";
import { glassPanel } from "./glass";

type Props = {
  selected: FilterKey[];
  onToggle: (key: FilterKey) => void;
  onClear: () => void;
  onApply: () => void;
  onDismiss: () => void;
};

export function FilterSheet({ selected, onToggle, onClear, onApply, onDismiss }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-chat-overlay"
      role="presentation"
      onClick={onDismiss}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-filter-title"
        className="w-full rounded-t-[34px] px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4 text-chat-text"
        style={{ ...glassPanel, animation: "messages-sheet-rise 280ms ease-out both" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/55" />
        <div className="flex items-center justify-between border-b border-chat-border pb-3">
          <div className="w-16" />
          <h2 id="message-filter-title" className="text-[21px] font-bold">
            Filter{selected.length > 0 ? ` · ${selected.length}` : ""}
          </h2>
          <button
            type="button"
            onClick={onClear}
            className="h-11 w-16 text-right text-[17px] font-semibold text-chat-accent active:opacity-60"
          >
            Clear
          </button>
        </div>
        <div className="max-h-[46vh] overflow-y-auto pt-1">
          {FILTERS.map(({ key, label, icon: Icon }) => {
            const active = selected.includes(key);
            return (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => onToggle(key)}
                className="flex w-full items-center gap-4 py-3 text-left text-[18px] font-medium active:opacity-70"
              >
                <Icon size={24} strokeWidth={1.8} />
                <span className="flex-1">{label}</span>
                <span
                  className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border transition-colors ${
                    active
                      ? "border-chat-text bg-chat-text text-chat-inverse"
                      : "border-white/40 text-transparent"
                  }`}
                >
                  <Check size={16} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onApply}
          className="mt-4 h-12 w-full rounded-full bg-chat-text text-[16px] font-semibold text-chat-inverse active:scale-[0.985]"
        >
          Apply{selected.length > 0 ? ` (${selected.length})` : ""}
        </button>
      </section>
    </div>
  );
}
