/** Tap-to-send suggestions. Marketplace-shaped, not generic smart-reply fluff. */
export function QuickReplies({
  replies,
  onPick,
}: {
  replies: string[];
  onPick: (reply: string) => void;
}) {
  if (replies.length === 0) return null;

  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 pb-1 pt-1 no-scrollbar"
      aria-label="Quick replies"
    >
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          onClick={() => onPick(reply)}
          className="h-9 shrink-0 rounded-full border border-chat-border bg-chat-text/[0.06] px-3.5 text-[13px] font-medium text-chat-text transition-transform active:scale-95"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
