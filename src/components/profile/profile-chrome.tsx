// Small shared building blocks for the two profile-shaped pages:
// /profile/$username (a person) and /store-profile/$storeUsername (a
// store). See profile-tabs.tsx for the tab bar itself.
import { ChevronRight } from "lucide-react";

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[15px] font-bold">{value}</div>
      <div className="text-[11px] font-bold text-[#B0ADAD]">{label}</div>
    </div>
  );
}

export function MenuRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3 text-[14px] hover:text-white/80 transition-colors"
    >
      <span>{label}</span>
      <ChevronRight size={16} className="text-white/40" />
    </button>
  );
}
