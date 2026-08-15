import { ChevronRight, ChevronDown } from "lucide-react";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-base border border-gray-200 rounded-lg px-2 py-2 outline-none"
      />
    </label>
  );
}

export const PriceField = (props: Omit<Parameters<typeof TextField>[0], "type">) => (
  <TextField {...props} type="number" />
);

export function StubRow({
  icon,
  label,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  isLast?: boolean;
}) {
  return (
    <button
      type="button"
      className={`w-full flex items-center justify-between px-4 py-4 ${
        isLast ? "" : "border-b-8 border-gray-50"
      }`}
    >
      <span className="flex items-center gap-3 text-[15px] text-gray-900">
        <span className="text-gray-400">{icon}</span>
        {label}
      </span>
      <ChevronRight size={16} className="text-gray-300" />
    </button>
  );
}

export function ExpandRow({
  icon,
  label,
  value,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b-8 border-gray-50">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-4"
      >
        <span className="flex flex-col items-start">
          <span className="flex items-center gap-3 text-[15px] text-gray-900">
            <span className="text-gray-400">{icon}</span>
            {label}
          </span>
          {value && <span className="text-xs text-gray-400 ml-7">{value}</span>}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-300 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}