import { useState } from "react";
import { X } from "lucide-react";

export type PickItem = { code: string; name: string };

// A dark full-screen list for country / state, fed by the same region data the
// seller's location form uses. (That form's own picker is styled with the
// seller-dashboard tokens, which don't exist out here.)
export function ListPicker({
  title,
  items,
  allowCustom,
  onSelect,
  onClose,
}: {
  title: string;
  items: PickItem[];
  allowCustom?: boolean;
  onSelect: (item: PickItem) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = query
    ? items.filter((i) => i.name.toLowerCase().includes(query))
    : items.slice(0, 200);
  const exact = items.some((i) => i.name.toLowerCase() === query);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center gap-3 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
        >
          <X size={20} />
        </button>
        <span className="text-[17px] font-semibold">{title}</span>
      </div>
      <div className="px-4 pb-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}`}
          className="w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-[16px] outline-none placeholder:text-white/35"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {allowCustom && query && !exact && (
          <button
            type="button"
            onClick={() => onSelect({ code: "", name: q.trim() })}
            className="w-full border-b border-white/10 px-4 py-3.5 text-left text-[16px]"
          >
            Use &ldquo;{q.trim()}&rdquo;
          </button>
        )}
        {shown.map((i) => (
          <button
            key={i.code + i.name}
            type="button"
            onClick={() => onSelect(i)}
            className="w-full border-b border-white/10 px-4 py-3.5 text-left text-[16px]"
          >
            {i.name}
          </button>
        ))}
      </div>
    </div>
  );
}
