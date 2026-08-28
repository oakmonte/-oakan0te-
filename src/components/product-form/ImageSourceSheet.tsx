import { UploadCloud, Layers } from "lucide-react";

export type ImageSource = "device" | "drafts";

const OPTIONS: { key: ImageSource; label: string; icon: typeof UploadCloud }[] = [
  { key: "device", label: "Upload from Device", icon: UploadCloud },
  { key: "drafts", label: "Upload from Drafts", icon: Layers },
];

export function ImageSourceSheet({
  anchorRect,
  onSelect,
  onClose,
}: {
  /** Trigger button's getBoundingClientRect(), so the sheet opens right under
   *  it instead of floating in the middle of the whole screen. */
  anchorRect: DOMRect | null;
  onSelect: (source: ImageSource) => void;
  onClose: () => void;
}) {
  const sheetWidth = 240;
  const left = anchorRect
    ? Math.min(
        Math.max(anchorRect.left + anchorRect.width / 2, sheetWidth / 2 + 16),
        window.innerWidth - sheetWidth / 2 - 16,
      )
    : window.innerWidth / 2;
  const top = anchorRect ? anchorRect.bottom + 8 : window.innerHeight / 2;

  return (
    <div className="fixed inset-0 z-50 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="absolute rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ease-out"
        style={{
          top,
          left,
          width: sheetWidth,
          transform: "translateX(-50%)",
          background: "rgba(40,40,40,0.92)",
          backdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {OPTIONS.map(({ key, label, icon: Icon }, i) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/10 transition-colors duration-100 ${
              i > 0 ? "border-t border-white/15" : ""
            }`}
          >
            <Icon size={18} className="text-white shrink-0" />
            <span className="text-[15px] text-white">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
