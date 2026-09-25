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

export function MenuRow({
  label,
  onClick,
  highlighted = false,
}: {
  label: string;
  onClick: () => void;
  /** Lit as if just tapped, without an actual tap -- for a guided
   *  walkthrough that opens this menu itself and shows *where* to tap
   *  before navigating (see profile.$username.tsx's sellerPromptOpen
   *  flow). Not a real interactive state, so it doesn't affect :hover. */
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between -mx-3 rounded-xl px-3 py-4 text-[16px] transition-colors duration-300 ${
        highlighted ? "bg-white/15 text-white" : "hover:text-white/80"
      }`}
    >
      <span>{label}</span>
      <ChevronRight size={18} className={highlighted ? "text-white" : "text-white/40"} />
    </button>
  );
}
