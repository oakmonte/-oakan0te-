import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { CategoryNode, ROOT_CATEGORY } from "@/lib/categories";

export function CategoryPicker({
  onSelect,
  onClose,
}: {
  onSelect: (path: CategoryNode[]) => void;
  onClose: () => void;
}) {
  const [stack, setStack] = useState<CategoryNode[]>([ROOT_CATEGORY]);
  const [search, setSearch] = useState("");
  const current = stack[stack.length - 1];

  const visibleChildren = useMemo(() => {
    const children = current.children ?? [];
    if (!search.trim()) return children;
    const q = search.trim().toLowerCase();
    return children.filter((c) => c.name.toLowerCase().includes(q));
  }, [current, search]);

  function goBack() {
    if (stack.length === 1) {
      onClose();
      return;
    }
    setStack((prev) => prev.slice(0, -1));
    setSearch("");
  }

  function handleRowTap(node: CategoryNode) {
    if (node.children && node.children.length > 0) {
      setStack((prev) => [...prev, node]);
      setSearch("");
    } else {
      onSelect([...stack.slice(1), node]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1" type="button">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-[15px] flex-1 text-center -ml-6">
          {current.name}
        </span>
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories"
            className="bg-transparent text-base flex-1 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        <button
          onClick={() => onSelect([...stack.slice(1), current])}
          className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50"
          type="button"
        >
          <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
          <span className="text-[15px] font-semibold text-gray-900">{current.name}</span>
        </button>

        {visibleChildren.map((child) => {
          const hasChildren = !!child.children && child.children.length > 0;
          return (
            <button
              key={child.id}
              onClick={() => handleRowTap(child)}
              className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-50"
              type="button"
            >
              <span className="flex items-center gap-3 text-[15px] text-gray-900">
                {!hasChildren && (
                  <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                )}
                {child.name}
              </span>
              {hasChildren && <ChevronRight size={16} className="text-gray-300" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}