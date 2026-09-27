import type { ReactNode } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Nearly full height, for lists (new chat, forward, contact info). */
  tall?: boolean;
  children: ReactNode;
  /** Rendered in the header's right slot. */
  action?: ReactNode;
};

/** Bottom sheet over the chat surface. Solid, not glass: sheets carry lists
 *  and text, which glass makes harder to read (see the liquid-glass skill).
 *  Back closes it, and it drags down to dismiss. */
export function Sheet({ open, onClose, title, tall, children, action }: SheetProps) {
  useOverlayHistory(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-chat-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] bg-chat-bg text-chat-text shadow-2xl ${
              tall ? "h-[92dvh]" : "max-h-[86dvh]"
            }`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            onClick={(event) => event.stopPropagation()}
          >
            <DragHandle onDismiss={onClose} />
            {(title || action) && (
              <header className="flex items-center gap-2 px-4 pb-2">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-chat-text/[0.07] text-chat-text active:scale-95"
                >
                  <X size={19} />
                </button>
                <h2 className="flex-1 truncate text-center text-[17px] font-semibold">{title}</h2>
                <div className="flex min-w-10 justify-end">{action}</div>
              </header>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+12px)]">
              {children}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The grab bar: drag it down past a threshold (or flick) to dismiss. */
function DragHandle({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.9 }}
      dragSnapToOrigin
      onDragEnd={(_: unknown, info: PanInfo) => {
        if (info.offset.y > 70 || info.velocity.y > 500) onDismiss();
      }}
    >
      <span className="h-[5px] w-10 rounded-full bg-chat-text/25" />
    </motion.div>
  );
}

export type ActionItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
};

/** iOS-style grouped action list, the body of most chat sheets. */
export function ActionList({ items }: { items: ActionItem[] }) {
  const visible = items.filter((item) => !item.hidden);
  return (
    <div className="mx-4 overflow-hidden rounded-[18px] bg-chat-elevated">
      {visible.map(({ key, label, icon: Icon, onSelect, danger }, index) => (
        <button
          key={key}
          type="button"
          onClick={onSelect}
          className={`flex h-[52px] w-full items-center gap-3.5 px-4 text-left text-[16px] active:bg-chat-text/[0.08] ${
            index > 0 ? "border-t border-chat-border" : ""
          } ${danger ? "text-chat-danger" : "text-chat-text"}`}
        >
          <Icon size={20} strokeWidth={1.9} />
          <span className="flex-1">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** A small centred confirm, for the destructive actions. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  extra,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** A second destructive choice, e.g. "Delete for everyone". */
  extra?: { label: string; onSelect: () => void };
}) {
  useOverlayHistory(open, onCancel);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-chat-overlay px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          role="presentation"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            className="w-full max-w-[320px] overflow-hidden rounded-[22px] bg-chat-elevated text-center text-chat-text shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 pb-4 pt-5">
              <p className="text-[17px] font-semibold">{title}</p>
              {body && <p className="mt-1.5 text-[14px] leading-snug text-chat-muted">{body}</p>}
            </div>
            {extra && (
              <button
                type="button"
                onClick={extra.onSelect}
                className="h-12 w-full border-t border-chat-border text-[16px] font-semibold text-chat-danger active:bg-chat-text/[0.08]"
              >
                {extra.label}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              className="h-12 w-full border-t border-chat-border text-[16px] font-semibold text-chat-danger active:bg-chat-text/[0.08]"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="h-12 w-full border-t border-chat-border text-[16px] text-chat-text active:bg-chat-text/[0.08]"
            >
              Cancel
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
