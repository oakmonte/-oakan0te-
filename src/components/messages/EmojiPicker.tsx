import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { EMOJI_CATEGORIES, readRecentEmoji, rememberEmoji } from "@/lib/chat/emoji";

export function EmojiPicker({
  onPick,
  height = 280,
}: {
  onPick: (emoji: string) => void;
  height?: number;
}) {
  const [recent, setRecent] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readRecentEmoji(),
  );
  const [active, setActive] = useState<string>(recent.length ? "recent" : EMOJI_CATEGORIES[0].key);

  const sections = useMemo(
    () => [
      ...(recent.length ? [{ key: "recent", label: "Recent", icon: "", emoji: recent }] : []),
      ...EMOJI_CATEGORIES,
    ],
    [recent],
  );

  const pick = (emoji: string) => {
    rememberEmoji(emoji);
    setRecent(readRecentEmoji());
    onPick(emoji);
  };

  return (
    <div className="flex flex-col bg-chat-bg" style={{ height }}>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-chat-border px-2 py-1.5 no-scrollbar">
        {sections.map((section) => (
          <button
            key={section.key}
            type="button"
            aria-label={section.label}
            onClick={() => {
              setActive(section.key);
              document
                .getElementById(`emoji-${section.key}`)
                ?.scrollIntoView({ block: "start", behavior: "smooth" });
            }}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[20px] ${
              active === section.key ? "bg-chat-text/10" : "opacity-70"
            }`}
          >
            {section.key === "recent" ? (
              <Clock size={18} className="text-chat-text" />
            ) : (
              section.icon
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {sections.map((section) => (
          <section key={section.key} id={`emoji-${section.key}`}>
            <p className="px-1.5 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-chat-muted">
              {section.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {section.emoji.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  type="button"
                  onClick={() => pick(emoji)}
                  className="flex aspect-square items-center justify-center rounded-[10px] text-[27px] active:scale-90 active:bg-chat-text/10"
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
