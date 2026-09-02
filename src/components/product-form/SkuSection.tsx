// A regular product has exactly one implicit variant, so it gets the same
// SKU field a row in the variant matrix has -- just always visible rather
// than behind a sheet, since it's one plain field with no computed value to
// summarize (unlike WeightSection's estimate).
export function SkuSection({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-4 py-4 border-b-8 border-gray-50">
      <p className="text-[15px] font-semibold text-gray-900 mb-2">SKU</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Optional — for your own inventory tracking"
        className="w-full rounded-xl border border-gray-200 px-4 py-4 text-base outline-none focus:border-gray-400"
      />
    </div>
  );
}
