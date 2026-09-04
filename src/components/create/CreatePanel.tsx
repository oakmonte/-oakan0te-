import { Image, Plus, X } from "lucide-react";

type CreatePanelProps = {
  onClose: () => void;
  draftCount?: number;
  onPhotoEditor?: () => void;
  onNewVideo?: () => void;
  onDrafts?: () => void;
};

export default function CreatePanel({
  onClose,
  draftCount = 0,
  onPhotoEditor,
  onNewVideo,
  onDrafts,
}: CreatePanelProps) {
  return (
    <div className="fixed inset-0 z-10 overflow-hidden bg-black text-white">
      <header className="relative flex items-center justify-center px-5 pt-[calc(env(safe-area-inset-top)+16px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close create"
          className="absolute left-5 top-[calc(env(safe-area-inset-top)+12px)] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-transform active:scale-90"
        >
          <X size={20} />
        </button>
        <h1 className="text-sm font-bold uppercase tracking-wide">Create</h1>
      </header>

      <main className="px-5 pt-10">
        <button
          type="button"
          onClick={onPhotoEditor}
          aria-label="Photo editor"
          className="flex h-32 w-[calc(100%_-_142px)] min-w-0 flex-col items-center justify-center gap-3 rounded-2xl bg-white/10 transition-transform active:scale-95"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Image size={25} strokeWidth={1.8} />
          </span>
          <span className="text-xs font-medium">Photo editor</span>
        </button>

        <div className="mt-10 flex items-stretch gap-3">
          <button
            type="button"
            onClick={onNewVideo}
            className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl bg-white px-4 py-8 text-black transition-transform active:scale-[0.98]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black">
              <Plus size={30} color="white" strokeWidth={2.2} />
            </span>
            <span className="mt-4 text-base font-bold">New video</span>
          </button>

          <button
            type="button"
            onClick={onDrafts}
            className="flex w-[130px] shrink-0 flex-col items-start justify-between rounded-2xl bg-zinc-800 px-5 py-5 text-left transition-transform active:scale-[0.98]"
          >
            <span className="text-4xl font-bold leading-none">{draftCount}</span>
            <span className="text-sm font-medium text-white/75">Drafts</span>
          </button>
        </div>
      </main>
    </div>
  );
}
