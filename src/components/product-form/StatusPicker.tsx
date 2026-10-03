// Active / Draft, the same two-button switch the product form uses. Drafts
// stay off the public storefront.
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
      <div className="flex gap-3">
        {(["active", "draft"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`flex-1 text-center rounded-xl py-3.5 text-sm font-medium border oak-motion-surface ${
              value === s
                ? "border-sd-ink bg-sd-elevated text-sd-ink"
                : "border-sd-line text-sd-ink-muted"
            }`}
          >
            {s === "active" ? "Active" : "Draft"}
          </button>
        ))}
      </div>
    </div>
  );
}
