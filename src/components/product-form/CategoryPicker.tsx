import { useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import {
  CategoryNode,
  ROOT_CATEGORY,
  customCategoryNode,
  findCategoryByName,
} from "@/lib/categories";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

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
// breadcrumb (ancestors + self) for multi-word queries like "kids tee".
const SEARCH_INDEX = ALL_ENTRIES.map((entry) => ({
  entry,
  nameNorm: normalize(entry.node.name),
  pathNorm: normalize(entry.pathNodes.map((n) => n.name).join(" ")),
}));

// Where a custom category can hang. The branch decides which details the
// form asks for next (Clothing asks for Size, Accessories doesn't).
const FASHION = ROOT_CATEGORY.children?.[0];
const HOME_BRANCHES: CategoryNode[] = [
  ...(FASHION?.children ?? []),
  ...(ROOT_CATEGORY.children?.slice(1) ?? []),
];

function pathTo(target: CategoryNode): CategoryNode[] {
  return ALL_ENTRIES.find((e) => e.node.id === target.id)?.pathNodes ?? [target];
}

const hasKids = (node: CategoryNode) => !!node.children && node.children.length > 0;

// Pressable card shared by every row: roomy tap target, visible edge, and a
// press state that lands on touch-down rather than after release.
const CARD =
  "w-full min-h-[52px] flex items-center gap-3 px-4 py-3 rounded-xl border text-left " +
  "transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] " +
  "[-webkit-tap-highlight-color:transparent]";
const OPTION_CARD = `${CARD} bg-gray-50 border-gray-300 active:bg-gray-200`;

function Radio() {
  return <span className="w-5 h-5 rounded-full border-2 border-gray-400 bg-white shrink-0" />;
}

function OptionRow({
  title,
  subtitle,
  branch,
  onClick,
}: {
  title: ReactNode;
  subtitle?: string;
  branch: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={OPTION_CARD}>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-[16px] font-medium text-gray-950 leading-snug">{title}</span>
        {subtitle && (
          <span className="text-[13px] text-gray-700 leading-snug mt-0.5">{subtitle}</span>
        )}
      </span>
      {branch ? <ChevronRight size={20} className="text-gray-600 shrink-0" /> : <Radio />}
    </button>
  );
}

export function CategoryPicker({
  onSelect,
  onClose,
}: {
  onSelect: (path: CategoryNode[]) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  const [stack, setStack] = useState<CategoryNode[]>([ROOT_CATEGORY]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const current = stack[stack.length - 1];
  const visibleChildren = current.children ?? [];

  const searchResults = useMemo(() => {
    // Tokenized so multi-word queries (e.g. "kids tee") require every word to
    // appear somewhere in the entry's breadcrumb, in any order — not just one
    // contiguous substring.
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
    if (hasKids(node)) {
      setStack((prev) => [...prev, node]);
      setSearch("");
    } else {
      onSelect([...stack.slice(1), node]);
    }
  }

  function handleSearchResultTap(entry: FlatEntry) {
    if (hasKids(entry.node)) {
      // Jump straight to that node's screen so its own children/self-select are usable.
      setStack([ROOT_CATEGORY, ...entry.pathNodes]);
      setSearch("");
    } else {
      onSelect(entry.pathNodes);
    }
  }

  const query = search.trim();

  if (creating) {
    return (
      <CreateCategorySheet
        initialName={query}
        initialParent={stack.length > 1 ? current : null}
        onCancel={() => setCreating(false)}
        onCreate={onSelect}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
      <div className="shrink-0 bg-white/95 backdrop-blur border-b border-gray-200 px-4 h-14 flex items-center gap-3">
        <button onClick={goBack} className="p-2 -ml-2" type="button" aria-label="Back">
          <ChevronLeft size={24} className="text-gray-950" />
        </button>
        <span className="font-semibold text-[16px] text-gray-950 flex-1 text-center -ml-8">
          {current.name}
        </span>
      </div>

      <div className="px-4 pt-4 pb-6">
        <label className="flex items-center gap-3 h-14 bg-gray-100 border border-gray-300 rounded-xl px-3.5 focus-within:border-gray-500">
          <Search size={20} className="text-gray-600 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories"
            className="bg-transparent text-[17px] text-gray-950 placeholder:text-gray-500 flex-1 outline-none"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-10 flex flex-col gap-2">
        {searchResults ? (
          <>
            {searchResults.length === 0 && (
              <p className="py-4 text-[15px] text-gray-700 text-center">
                No category called “{query}” yet.
              </p>
            )}
            {searchResults.map((entry) => (
              <OptionRow
                key={entry.node.id}
                title={entry.node.name}
                subtitle={entry.pathNodes
                  .slice(0, -1)
                  .map((n) => n.name)
                  .join(" › ")}
                branch={hasKids(entry.node)}
                onClick={() => handleSearchResultTap(entry)}
              />
            ))}
            <CreateCard title={`Add “${query}” as a category`} onClick={() => setCreating(true)} />
          </>
        ) : (
          <>
            {stack.length > 1 && (
              <OptionRow
                title={<span className="font-semibold">All {current.name}</span>}
                subtitle="If nothing below fits exactly"
                branch={false}
                onClick={() => onSelect([...stack.slice(1), current])}
              />
            )}
            {visibleChildren.map((child) => (
              <OptionRow
                key={child.id}
                title={child.name}
                branch={hasKids(child)}
                onClick={() => handleRowTap(child)}
              />
            ))}
            <CreateCard title="Can’t find your category?" onClick={() => setCreating(true)} />
          </>
        )}
      </div>
    </div>
  );
}

// Dashed so it reads as an action rather than one more option in the list.
function CreateCard({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD} mt-2 bg-white border-dashed border-gray-400 active:bg-gray-100`}
    >
      <span className="w-9 h-9 rounded-full bg-gray-950 text-white flex items-center justify-center shrink-0">
        <Plus size={18} strokeWidth={2.5} />
      </span>
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-[16px] font-semibold text-gray-950 leading-snug break-words">
          {title}
        </span>
        <span className="text-[13px] text-gray-700 leading-snug mt-0.5">
          Name it yourself — we review new ones and add the best for everyone
        </span>
      </span>
    </button>
  );
}

function CreateCategorySheet({
  initialName,
  initialParent,
  onCancel,
  onCreate,
}: {
  initialName: string;
  initialParent: CategoryNode | null;
  onCancel: () => void;
  onCreate: (path: CategoryNode[]) => void;
}) {
  useLockedViewport();

  const [name, setName] = useState(initialName);
  const [parent, setParent] = useState<CategoryNode | null>(initialParent);
  // The screen the seller came from stays on offer even when it's deeper
  // than the home branches (e.g. Tops, Jewelry).
  const parents =
    initialParent && !HOME_BRANCHES.some((b) => b.id === initialParent.id)
      ? [initialParent, ...HOME_BRANCHES]
      : HOME_BRANCHES;
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && parent !== null;

  function save() {
    if (!trimmed || !parent) return;
    // Typing a name that already exists picks the real category instead of
    // making a duplicate custom one.
    const existing = findCategoryByName(trimmed);
    onCreate(existing ?? [...pathTo(parent), customCategoryNode(trimmed)]);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-4 duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)]">
      <div className="shrink-0 border-b border-gray-200 px-4 h-14 flex items-center">
        <button type="button" onClick={onCancel} className="text-[15px] text-gray-700 py-2 pr-2">
          Cancel
        </button>
        <span className="flex-1 text-center font-semibold text-[16px] text-gray-950">
          New category
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="text-[15px] font-semibold text-gray-950 py-2 pl-2 disabled:text-gray-400"
        >
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-10">
        <label className="block text-[15px] font-semibold text-gray-950 mb-2" htmlFor="new-cat">
          What do you call it?
        </label>
        <input
          id="new-cat"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="e.g. Aso oke fila"
          maxLength={60}
          enterKeyHint="done"
          className="w-full text-base text-gray-950 placeholder:text-gray-500 bg-gray-50 border border-gray-300 rounded-xl px-4 py-4 outline-none focus:border-gray-500"
        />

        <p className="text-[15px] font-semibold text-gray-950 mt-7">Where does it belong?</p>
        <p className="text-[13px] text-gray-700 mt-1 mb-3">
          This decides what we ask you next, like sizes for clothing.
        </p>
        <div className="flex flex-col gap-2">
          {parents.map((p) => {
            const selected = parent?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setParent(p)}
                className={`${CARD} ${
                  selected
                    ? "bg-gray-50 border-black ring-1 ring-black"
                    : "bg-gray-50 border-gray-300 active:bg-gray-200"
                }`}
              >
                <span className="flex-1 text-[16px] font-medium text-gray-950">{p.name}</span>
                {selected ? (
                  <span className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0">
                    <Check size={13} strokeWidth={3} className="text-white" />
                  </span>
                ) : (
                  <Radio />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
