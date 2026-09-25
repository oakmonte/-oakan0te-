import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Images, Plus, SendHorizontal, Smile, X } from "lucide-react";
import { glassPanel } from "./glass";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  replyTo: string | null;
  onCancelReply: () => void;
  placeholder?: string;
};

const LINE_HEIGHT = 21;
const MAX_LINES = 5;

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  replyTo,
  onCancelReply,
  placeholder = "Write a message...",
}: Props) {
  const field = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;

  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, LINE_HEIGHT * MAX_LINES + 20)}px`;
  }, [value]);

  useEffect(() => {
    if (replyTo) field.current?.focus();
  }, [replyTo]);

  return (
    <div
      className="sticky bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2"
      style={glassPanel}
    >
      <AnimatePresence initial={false}>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 flex items-start gap-2 rounded-[14px] bg-chat-text/[0.06] px-3 py-2">
              <span className="mt-[3px] h-8 w-[2px] shrink-0 rounded-full bg-chat-accent" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-chat-accent">Replying</p>
                <p className="truncate text-[13px] text-chat-muted">{replyTo}</p>
              </div>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={onCancelReply}
                className="flex h-9 w-9 items-center justify-center rounded-full text-chat-muted active:bg-chat-text/10"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="flex items-end gap-2"
      >
        <button
          type="button"
          aria-label="Take a photo"
          className="mb-[3px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chat-text/[0.08] text-chat-text active:scale-95"
        >
          <Camera size={20} />
        </button>
        <div className="flex min-w-0 flex-1 items-end gap-1 rounded-[24px] bg-chat-text/[0.08] px-3 py-[9px]">
          <textarea
            ref={field}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              const desktop =
                typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
              if (event.key === "Enter" && !event.shiftKey && desktop) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder}
            aria-label="Write a message"
            className="min-w-0 flex-1 resize-none bg-transparent py-[2px] text-[15px] leading-[21px] text-chat-text outline-none placeholder:text-chat-faint disabled:opacity-50"
          />
          <AnimatePresence initial={false}>
            {!hasText && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex shrink-0 items-center overflow-hidden"
              >
                <button
                  type="button"
                  aria-label="Send a photo"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-chat-text active:scale-90"
                >
                  <Images size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Stickers and emoji"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-chat-text active:scale-90"
                >
                  <Smile size={20} />
                </button>
                <button
                  type="button"
                  aria-label="More options"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-chat-text active:scale-90"
                >
                  <Plus size={20} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {hasText && (
            <motion.button
              type="submit"
              aria-label="Send message"
              disabled={sending}
              initial={{ opacity: 0, scale: 0.6, x: 12 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.6, x: 12 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              className="mb-[3px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-chat-text text-chat-inverse disabled:opacity-50"
            >
              <SendHorizontal size={19} />
            </motion.button>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
