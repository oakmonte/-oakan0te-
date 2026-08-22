import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { CategoryNode, ROOT_CATEGORY } from "@/lib/categories";

type FlatEntry = {
  node: CategoryNode;
  pathNodes: CategoryNode[]; // path from root's children down to and including this node
};

function flattenTree(node: CategoryNode, pathNodes: CategoryNode[] = []): FlatEntry[] {
  const children = node.children ?? [];
  let results: FlatEntry[] = [];
  for (const child of children) {
    const entryPath = [...pathNodes, child];
    results.push({ node: child, pathNodes: entryPath });
    if (child.children && child.children.length > 0) {
      results = results.concat(flattenTree(child, entryPath));
    }
  }
  return results;
}

// Built once at module load — the tree is static.
const ALL_ENTRIES = flattenTree(ROOT_CATEGORY);

// Strips spaces/punctuation and lowercases, so "T-Shirts", "t shirt" and
// "tshirt" all collapse to the same "tshirts"/"tshirt" comparison — sellers
// shouldn't be punished for skipping a hyphen or space.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// Precomputed once per entry: normalized leaf name, and normalized full
// breadcrumb (ancestors + self) for multi-word queries like "activewear tee".
const SEARCH_INDEX = ALL_ENTRIES.map((entry) => ({
  entry,
  nameNorm: normalize(entry.node.name),
  pathNorm: normalize(entry.pathNodes.map((n) => n.name).join(" ")),
}));

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
  const visibleChildren = current.children ?? [];

  const searchResults = useMemo(() => {
    // Tokenized so multi-word queries (e.g. "activewear tee") require every
    // word to appear somewhere in the entry's breadcrumb, in any order —
    // not just one contiguous substring.
    const tokens = search.trim().toLowerCase().split(/\s+/).map(normalize).filter(Boolean);
    if (tokens.length === 0) return null;

    const scored: { entry: FlatEntry; score: number }[] = [];
    for (const { entry, nameNorm, pathNorm } of SEARCH_INDEX) {
      if (!tokens.every((t) => pathNorm.includes(t))) continue;
      const joined = tokens.join("");
      // Lower score = more relevant: exact leaf name, then leaf name starts
      // with the query, then substring-in-leaf-name, then breadcrumb-only.
      const score =
        nameNorm === joined
          ? 0
          : nameNorm.startsWith(tokens[0])
            ? 1
            : nameNorm.includes(joined)
              ? 2
              : 3;
      scored.push({ entry, score });
    }
    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.entry);
  }, [search]);

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

  function handleSearchResultTap(entry: FlatEntry) {
    const hasChildren = !!entry.node.children && entry.node.children.length > 0;
    if (hasChildren) {
      // Jump straight to that node's screen so its own children/self-select are usable.
      setStack([ROOT_CATEGORY, ...entry.pathNodes]);
      setSearch("");
    } else {
      onSelect(entry.pathNodes);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button onClick={goBack} className="p-1 -ml-1" type="button">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-[15px] flex-1 text-center -ml-6">{current.name}</span>
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
        {searchResults ? (
          searchResults.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No categories found.</p>
          ) : (
            searchResults.map((entry) => {
              const hasChildren = !!entry.node.children && entry.node.children.length > 0;
              const breadcrumb = entry.pathNodes
                .slice(0, -1)
                .map((n) => n.name)
                .join(" > ");
              return (
                <button
                  key={entry.node.id}
                  onClick={() => handleSearchResultTap(entry)}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-50 text-left"
                  type="button"
                >
                  <span className="flex flex-col">
                    <span className="text-[15px] text-gray-900">{entry.node.name}</span>
                    {breadcrumb && (
                      <span className="text-xs text-gray-400 mt-0.5">{breadcrumb}</span>
                    )}
                  </span>
                  {hasChildren ? (
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                  )}
                </button>
              );
            })
          )
        ) : (
          <>
            {stack.length > 1 && (
              <button
                onClick={() => onSelect([...stack.slice(1), current])}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50"
                type="button"
              >
                <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                <span className="text-[15px] font-semibold text-gray-900">{current.name}</span>
              </button>
            )}

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
          </>
        )}
      </div>
    </div>
  );
}
