import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
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
import type { ChatMessage } from "@/lib/chat/model";
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
  | "retry"
  | "select";

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
  /** Where the message sat in the thread when it was long-pressed: its row
   *  (for the column's width) and its bubble (for where the lifted copy goes). */
  anchor: MenuAnchor | null;
  /** The message as the thread draws it -- a MessageBubble in `lifted` mode,
   *  so photos open and voice notes play from here. */
  preview: ReactNode;
};

export type MenuAnchor = { row: DOMRect; bubble: DOMRect };

const LABELS: Record<MessageAction, { label: string; icon: LucideIcon; danger?: boolean }> = {
  retry: { label: "Try again", icon: RotateCcw },
  reply: { label: "Reply", icon: Reply },
  copy: { label: "Copy", icon: Copy },
  edit: { label: "Edit", icon: Pencil },
  forward: { label: "Forward", icon: Forward },
  save: { label: "Save photo", icon: Download },
  select: { label: "Select", icon: CheckCircle2 },
  report: { label: "Report", icon: ShieldAlert, danger: true },
  delete: { label: "Delete", icon: Trash2, danger: true },
};

/** Long-press on a message: the message is lifted exactly where it already
 *  is, with reactions and actions around it and the rest of the chat dimmed.
 *  Actions go below the message when they fit, above it (Telegram-style)
 *  when they don't; only a message too tall for either gets moved. */
export function MessageMenu(props: Props) {
  useOverlayHistory(!!props.message, props.onClose);
  return (
    <AnimatePresence>
      {props.message && <MenuBody key={props.message.id} {...props} />}
    </AnimatePresence>
  );
}

const GAP = 10;

type Place = { top: number; left: number; width: number; flip: boolean };

function MenuBody({
  mine,
  myReaction,
  actions,
  canReact,
  onReact,
  onAction,
  onClose,
  anchor,
  preview,
}: Props) {
  const [picker, setPicker] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const column = useRef<HTMLDivElement>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Place | null>(null);
  // Set by the first pointerdown inside the menu. The finger that opened it
  // went down on the thread before the menu existed, so its trailing click
  // -- which can land on the lifted copy's photo -- is ignored.
  const armed = useRef(false);

  // Runs before paint, so the column is never seen anywhere but in place.
  // Measured against the overlay's own box rather than the window: the thread
  // it lives in follows the visual viewport, which the keyboard moves.
  useLayoutEffect(() => {
    const root = overlay.current;
    const stack = column.current;
    if (!root || !stack) return;
    const box = root.getBoundingClientRect();
    const padding = getComputedStyle(root);
    const minTop = parseFloat(padding.paddingTop) || 0;
    const maxBottom = box.height - (parseFloat(padding.paddingBottom) || 0);
    const width = anchor ? anchor.row.width : Math.min(420, box.width - 32);
    const left = anchor ? anchor.row.left - box.left : (box.width - width) / 2;
    const clamp = (top: number, height: number) =>
      Math.max(minTop, Math.min(top, maxBottom - height));

    const lifted = previewRef.current?.querySelector<HTMLElement>("[data-bubble]");
    if (picker || !anchor || !lifted || !previewRef.current) {
      const height = stack.offsetHeight;
      setPlace({ top: clamp((box.height - height) / 2, height), left, width, flip: false });
      return;
    }

    const reactions = reactionsRef.current ? reactionsRef.current.offsetHeight + GAP : 0;
    const menu = actionsRef.current ? actionsRef.current.offsetHeight + GAP : 0;
    const previewHeight = previewRef.current.offsetHeight;
    const bubbleOffset =
      lifted.getBoundingClientRect().top - previewRef.current.getBoundingClientRect().top;
    // Where the preview has to start for the lifted bubble to cover the
    // original one exactly.
    const previewTop = anchor.bubble.top - box.top - bubbleOffset;
    const fits = (above: number, below: number) =>
      previewTop - above >= minTop && previewTop + previewHeight + below <= maxBottom;

    if (fits(reactions, menu)) {
      setPlace({ top: previewTop - reactions, left, width, flip: false });
    } else if (fits(reactions + menu, 0)) {
      setPlace({ top: previewTop - reactions - menu, left, width, flip: true });
    } else {
      const height = reactions + previewHeight + menu;
      setPlace({ top: clamp(previewTop - reactions, height), left, width, flip: false });
    }
  }, [anchor, picker]);

  const flip = place?.flip ?? false;

  const reactionBar = canReact && !picker && (
    <motion.div
      key="reactions"
      ref={reactionsRef}
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      className={`relative flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-1 ${GLASS_RIM}`}
      style={glassFloating}
      data-menu-part
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
  );

  // Only the bubble itself counts as part of the menu: the rest of its row is
  // blurred backdrop, and a tap there should close.
  const lifted = !picker && (
    <div key="preview" ref={previewRef} className="max-h-[55dvh] w-full shrink-0 overflow-hidden">
      {preview}
    </div>
  );

  const actionList = !picker && actions.length > 0 && (
    <motion.div
      key="actions"
      ref={actionsRef}
      initial={{ opacity: 0, y: flip ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`relative w-[240px] shrink-0 overflow-hidden rounded-[18px] text-[16px] text-chat-text ${GLASS_RIM}`}
      style={glassFloating}
      data-menu-part
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
  );

  return (
    <motion.div
      ref={overlay}
      className="fixed inset-0 z-[85] pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+16px)]"
      style={{
        background: "var(--color-chat-overlay)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onPointerDownCapture={() => {
        armed.current = true;
      }}
      onClickCapture={(event) => {
        if (armed.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      // Any tap outside the reaction bar, the bubble and the action list
      // closes -- including the blurred strip beside the message, which is
      // inside the full-width column and so can't be the target here.
      onClick={(event) => {
        if (!(event.target as Element).closest("[data-menu-part], [data-bubble]")) onClose();
      }}
      role="presentation"
    >
      <div
        ref={column}
        className={`absolute flex flex-col ${mine ? "items-end" : "items-start"}`}
        style={{
          gap: GAP,
          ...(place
            ? { top: place.top, left: place.left, width: place.width }
            : { top: 0, left: 0, width: anchor?.row.width ?? "100%", visibility: "hidden" }),
        }}
      >
        {picker ? (
          <div className="w-full overflow-hidden rounded-[22px] shadow-2xl" data-menu-part>
            <EmojiPicker onPick={(emoji) => onReact(emoji)} height={340} />
          </div>
        ) : flip ? (
          [actionList, reactionBar, lifted]
        ) : (
          [reactionBar, lifted, actionList]
        )}
      </div>
    </motion.div>
  );
}
