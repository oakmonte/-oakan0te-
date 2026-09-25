import { Plus } from "lucide-react";

export function StoryRail({ onAdd }: { onAdd: () => void }) {
  return (
    <div data-swipe-owner className="mt-4 flex gap-4 overflow-x-auto px-5 pb-1 no-scrollbar">
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add to your story"
        className="flex shrink-0 flex-col items-center gap-1.5 active:opacity-70"
        style={{ width: 84 }}
      >
        <div className="relative flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-dashed border-chat-text/25">
          <Plus size={24} strokeWidth={2} className="text-chat-text/70" />
        </div>
        <span className="w-full truncate text-center text-[12px] text-chat-text/55">
          Your story
        </span>
        <span className="-mt-1 w-full truncate text-center text-[10px] text-chat-text/30">
          Add to your story
        </span>
      </button>
    </div>
  );
}
