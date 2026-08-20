export function StatusSheet({
  status,
  onSelect,
  onClose,
}: {
  status: "draft" | "active";
  onSelect: (s: "draft" | "active") => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end min-h-dvh">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full bg-white rounded-t-2xl p-4 pb-8 animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
        <p className="text-sm font-medium text-gray-500 mb-3">Product status</p>
        {(["active", "draft"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSelect(s)}
            className="w-full flex items-center justify-between py-3 border-b border-gray-50 last:border-0 oak-motion-control"
          >
            <span className="text-[15px] capitalize text-gray-900">{s}</span>
            {status === s && <span className="text-black oak-motion-pop">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
