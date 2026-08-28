import { Images, Camera, FolderOpen, Layers } from "lucide-react";

export type ImageSource = "library" | "camera" | "file" | "drafts";

const OPTIONS: { key: ImageSource; label: string; icon: typeof Images }[] = [
  { key: "library", label: "Photo Library", icon: Images },
  { key: "camera", label: "Take Photo", icon: Camera },
  { key: "file", label: "Choose File", icon: FolderOpen },
  { key: "drafts", label: "Upload from Drafts", icon: Layers },
];

/** iOS-action-sheet-styled picker for where a product/variant image comes
 *  from. The first three options hand off to the OS's own file chooser (see
 *  useFilePicker) — this sheet is the thing that lets "upload from drafts"
 *  sit alongside them as a fourth, equally-weighted option, which the OS
 *  sheet itself has no way to be extended with. */
export function ImageSourceSheet({
  onSelect,
  onClose,
}: {
  onSelect: (source: ImageSource) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-8 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div className="w-full max-w-[280px] flex flex-col gap-2">
        <div
          className="rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ease-out"
          style={{ background: "rgba(40,40,40,0.92)", backdropFilter: "blur(20px)" }}
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

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl py-3.5 text-[15px] font-medium text-white animate-in fade-in zoom-in-95 duration-150 ease-out"
          style={{ background: "rgba(40,40,40,0.92)", backdropFilter: "blur(20px)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
