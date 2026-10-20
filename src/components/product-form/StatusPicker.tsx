// Active / Inactive, the same two-button switch everywhere a product or a
// collection is published. Inactive (draft) stays off the public storefront.

/** The two buttons on their own, for a caller with its own card around them
 *  (the product forms). The chosen one is blue, outline and soft gradient. */
export function StatusToggle({
  value,
  onChange,
}: {
  value: "draft" | "active";
  onChange: (next: "draft" | "active") => void;
}) {
  return (
    <div className="flex gap-3">
      {(["active", "draft"] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          // Desktop: a pair of compact buttons rather than two halves of the
          // whole card. Phones keep the full-width halves.
          className={`flex-1 md:flex-none md:w-36 text-center rounded-xl py-3.5 text-sm font-medium border oak-motion-surface active:scale-[0.98] ${
            value === s
              ? "border-blue-500 bg-gradient-to-b from-blue-500/10 to-blue-500/20 text-blue-600 font-semibold"
              : "border-sd-line text-sd-ink-muted"
          }`}
        >
          {s === "active" ? "Active" : "Inactive"}
        </button>
      ))}
    </div>
  );
}

export function StatusPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "draft" | "active";
  onChange: (next: "draft" | "active") => void;
}) {
  return (
    <div className="rounded-2xl border border-sd-line bg-sd-surface p-4">
      <p className="text-[15px] font-semibold text-sd-ink mb-3">{label}</p>
      <StatusToggle value={value} onChange={onChange} />
    </div>
  );
}
