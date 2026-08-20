import { useEffect, useState } from "react";
import { ArrowUpDown, Check, MoreHorizontal, Search, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";

// TODO: dev-only, matches store.products_.new.tsx / store.products.tsx.
// Revert before launch.
const DEV_STORE_ID = "4a492d4d-66bd-4d14-a5dc-e6d8d1723023";

type TagRow = { id: string; title: string };

// Selection here is live — every tap calls onToggle straight through to the
// parent's tagIds state, so there's no separate Save step. Closing the sheet
// never discards anything; it's just leaving the picker.
export function TagsSheet({
  selectedIds,
  onToggle,
  onClose,
}: {
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [tags, setTags] = useState<TagRow[] | null>(null); // null = loading
  const [query, setQuery] = useState("");
  const [sortDesc, setSortDesc] = useState(false);
  const [selectedPanelOpen, setSelectedPanelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tags")
        .select("id, title")
        .eq("store_id", DEV_STORE_ID)
        .order("title", { ascending: true });
      if (!cancelled) setTags(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = new Set(selectedIds);
  const q = query.trim().toLowerCase();

  const visible = (tags ?? [])
    .filter((t) => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => (sortDesc ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title)));

  const selectedTitles = (tags ?? []).filter((t) => selected.has(t.id)).map((t) => t.title);

  const exactExists = (tags ?? []).some((t) => t.title.toLowerCase() === q);
  const canCreate = !!q && !exactExists;

  async function createTag() {
    if (!canCreate || creating) return;
    const title = query.trim();
    setCreating(true);
    const { data: created, error } = await supabase
      .from("tags")
      .insert({ store_id: DEV_STORE_ID, title })
      .select("id, title")
      .single();
    setCreating(false);
    if (error || !created) return;
    setTags((prev) => [...(prev ?? []), created]);
    onToggle(created.id);
    setQuery("");
  }

  function selectAll() {
    for (const t of visible) if (!selected.has(t.id)) onToggle(t.id);
    setMenuOpen(false);
  }

  function clearAll() {
    for (const id of selectedIds) onToggle(id);
    setMenuOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Tags</span>
        <span className="w-5" />
      </div>

      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          aria-label={sortDesc ? "Sort A to Z" : "Sort Z to A"}
          className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-500"
        >
          <ArrowUpDown size={16} />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createTag();
              }
            }}
            placeholder="Search or add tags"
            className="bg-transparent text-base flex-1 outline-none min-w-0"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {canCreate && (
          <button
            type="button"
            onClick={createTag}
            disabled={creating}
            className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-left"
          >
            <span className="w-5 h-5 rounded-md border border-dashed border-gray-300 shrink-0" />
            <span className="text-[15px] text-gray-900">
              Add “<span className="font-medium">{query.trim()}</span>”
            </span>
          </button>
        )}

        {tags !== null &&
          visible.map((t) => {
            const isSelected = selected.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onToggle(t.id)}
                aria-label={`${isSelected ? "Deselect" : "Select"} ${t.title}`}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-left"
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-black border-black" : "border-gray-300"
                  }`}
                >
                  {isSelected && <Check size={13} className="text-white" />}
                </span>
                <span className="text-[15px] text-gray-900 font-medium">{t.title}</span>
              </button>
            );
          })}

        {tags !== null && !canCreate && visible.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No tags yet.</p>
        )}
      </div>

      <div className="sticky bottom-0 px-3 pb-3 pt-2 shrink-0">
        <div className="bg-black text-white rounded-full px-4 h-12 flex items-center justify-between shadow-lg">
          <span className="text-sm text-gray-300">{selectedIds.length} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedPanelOpen(true)}
              className="text-sm font-medium bg-white/15 rounded-full px-4 py-2"
            >
              View selected
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="More actions"
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center px-3 pb-24"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-sm font-semibold text-gray-900 py-3 border-b border-gray-100">
              Actions
            </p>
            <button
              type="button"
              onClick={selectAll}
              className="w-full px-4 py-3.5 text-[15px] text-gray-900 text-center border-b border-gray-100"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={selectedIds.length === 0}
              className="w-full px-4 py-3.5 text-[15px] text-gray-900 text-center border-b border-gray-100 disabled:text-gray-300"
            >
              Deselect all
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-full px-4 py-3.5 text-[15px] text-gray-500 text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedPanelOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center px-3 pb-24"
          onClick={() => setSelectedPanelOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xs p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-900 mb-2">Selected tags</p>
            <p className="text-[15px] text-gray-600">
              {selectedTitles.length > 0 ? selectedTitles.join(", ") : "No tags selected yet."}
            </p>
            <button
              type="button"
              onClick={() => setSelectedPanelOpen(false)}
              className="mt-4 w-full bg-black text-white text-sm font-medium rounded-lg py-2.5"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
