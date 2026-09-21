import { Clapperboard, FileText, Image, X } from "lucide-react";

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
        <h1 id="create-heading" className="text-sm font-bold uppercase tracking-wide">
          Create
        </h1>
      </header>

      <main aria-labelledby="create-heading" className="px-5 pt-10">
        <p className="mb-6 max-w-[300px] text-[15px] leading-relaxed text-white/65">
          Make a post from your camera, your gallery, or a saved draft.
        </p>
        <button
          type="button"
          onClick={onPhotoEditor}
          aria-describedby="photo-editor-description"
          className="flex min-h-32 w-full min-w-0 flex-col items-start justify-center gap-3 rounded-2xl bg-white/10 px-5 text-left transition-transform active:scale-[0.98]"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Image size={25} strokeWidth={1.8} />
          </span>
          <span className="text-base font-semibold">Photo post</span>
          <span id="photo-editor-description" className="text-[13px] leading-snug text-white/60">
            Add pictures, text, music, and filters.
          </span>
        </button>

        <div className="mt-10 flex items-stretch gap-3">
          <button
            type="button"
            onClick={onNewVideo}
            aria-describedby="video-editor-description"
            className="flex min-h-44 min-w-0 flex-1 flex-col items-start justify-center rounded-2xl bg-white px-5 py-6 text-left text-black transition-transform active:scale-[0.98]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black">
              <Clapperboard size={23} color="white" strokeWidth={2} />
            </span>
            <span className="mt-4 text-base font-bold">Video post</span>
            <span
              id="video-editor-description"
              className="mt-1 text-[13px] leading-snug text-black/60"
            >
              Join photos and clips into one video.
            </span>
          </button>

          <button
            type="button"
            onClick={onDrafts}
            aria-label={`${draftCount} saved drafts`}
            className="flex min-h-44 w-[130px] shrink-0 flex-col items-start justify-between rounded-2xl bg-zinc-800 px-5 py-5 text-left transition-transform active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <FileText size={19} />
            </span>
            <span>
              <span className="block text-3xl font-bold leading-none">{draftCount}</span>
              <span className="mt-1 block text-sm font-medium text-white/75">Saved drafts</span>
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
