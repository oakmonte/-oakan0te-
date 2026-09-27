import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Copy,
  Download,
  Forward,
  Pencil,
  Plus,
  Reply,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { GLASS_RIM } from "@/lib/liquid-glass";
import { QUICK_REACTIONS } from "@/lib/chat/emoji";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { describeMessage, type ChatMessage } from "@/lib/chat/model";
import { clockTime } from "@/lib/messages-format";
import { EmojiPicker } from "./EmojiPicker";
import { glassFloating } from "./glass";

export type MessageAction =
  | "reply"
  | "copy"
  | "edit"
  | "forward"
  | "save"
  | "delete"
  | "report"
  | "retry";

type Props = {
  /** null = closed. The menu stays mounted either way (see ChatThread). */
  message: ChatMessage | null;
  mine: boolean;
  myReaction: string | null;
  actions: MessageAction[];
  canReact: boolean;
  onReact: (emoji: string | null) => void;
  onAction: (action: MessageAction) => void;
  onClose: () => void;
};

const LABELS: Record<MessageAction, { label: string; icon: LucideIcon; danger?: boolean }> = {
  retry: { label: "Try again", icon: RotateCcw },
  reply: { label: "Reply", icon: Reply },
  copy: { label: "Copy", icon: Copy },
  edit: { label: "Edit", icon: Pencil },
  forward: { label: "Forward", icon: Forward },
  save: { label: "Save photo", icon: Download },
  report: { label: "Report", icon: ShieldAlert, danger: true },
  delete: { label: "Delete", icon: Trash2, danger: true },
};

/** Long-press on a message: reactions on top, the message, then actions --
 *  the Instagram/iMessage arrangement, with the rest of the chat dimmed. */
export function MessageMenu(props: Props) {
  useOverlayHistory(!!props.message, props.onClose);
  return (
    <AnimatePresence>
      {props.message && <MenuBody key={props.message.id} {...props} message={props.message} />}
    </AnimatePresence>
  );
}

function MenuBody({
  message,
  mine,
  myReaction,
  actions,
  canReact,
  onReact,
  onAction,
  onClose,
}: Props & { message: ChatMessage }) {
  const [picker, setPicker] = useState(false);

  return (
    <motion.div
      className="fixed inset-0 z-[85] flex flex-col justify-center gap-2.5 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+16px)]"
      style={{
        background: "var(--color-chat-overlay)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`mx-auto flex w-full max-w-[420px] flex-col gap-2.5 ${mine ? "items-end" : "items-start"}`}
        onClick={(event) => event.stopPropagation()}
      >
        {canReact && !picker && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 30 }}
            className={`relative flex items-center gap-0.5 rounded-full px-1.5 py-1 ${GLASS_RIM}`}
            style={glassFloating}
            role="group"
            aria-label="React"
          >
            {QUICK_REACTIONS.map((emoji, index) => (
              <motion.button
                key={emoji}
                type="button"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.02 * index, type: "spring", stiffness: 600, damping: 24 }}
                onClick={() => onReact(myReaction === emoji ? null : emoji)}
                aria-label={`React ${emoji}`}
                aria-pressed={myReaction === emoji}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-[26px] active:scale-125 ${
                  myReaction === emoji ? "bg-chat-text/15" : ""
                }`}
              >
                {emoji}
              </motion.button>
            ))}
            <button
              type="button"
              onClick={() => setPicker(true)}
              aria-label="More reactions"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-chat-text/10 text-chat-text"
            >
              <Plus size={20} />
            </button>
          </motion.div>
        )}

        {picker ? (
          <div className="w-full overflow-hidden rounded-[22px] shadow-2xl">
            <EmojiPicker onPick={(emoji) => onReact(emoji)} height={340} />
          </div>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              className={`max-h-[34dvh] max-w-[86%] overflow-hidden rounded-[20px] px-3.5 py-2.5 shadow-xl ${
                mine ? "text-chat-inverse" : "bg-chat-elevated text-chat-text"
              }`}
              style={
                mine
                  ? { background: "var(--chat-outgoing, linear-gradient(180deg,#fff,#ece7e1))" }
                  : undefined
              }
            >
              <p className="line-clamp-[10] whitespace-pre-wrap break-words text-[15.5px] leading-[1.35]">
                {describeMessage({ ...message, deleted: !!message.deletedAt })}
              </p>
              <p className="mt-1 text-right text-[11px] opacity-60">
                {clockTime(message.createdAt)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`relative w-[240px] overflow-hidden rounded-[18px] text-[16px] text-chat-text ${GLASS_RIM}`}
              style={glassFloating}
              role="menu"
            >
              {actions.map((action, index) => {
                const { label, icon: Icon, danger } = LABELS[action];
                return (
                  <button
                    key={action}
                    type="button"
                    role="menuitem"
                    onClick={() => onAction(action)}
                    className={`flex h-12 w-full items-center justify-between px-4 text-left active:bg-chat-text/10 ${
                      index > 0 ? "border-t border-chat-border" : ""
                    } ${danger ? "text-chat-danger" : ""}`}
                  >
                    {label}
                    <Icon size={19} />
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </div>
    </motion.div>
  );
}
