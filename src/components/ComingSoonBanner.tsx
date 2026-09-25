import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket } from "lucide-react";

/** A deliberately roomy "not yet" banner -- for a tap that used to do
 *  something real (share, message, ...) but shouldn't yet. Bottom-anchored,
 *  --sd-* toned so it reads correctly on both the light and dark dashboard,
 *  and sized to actually be read rather than glanced past: a tiny inline
 *  hint was tried here first and the feedback was that it disappeared.
 *  Auto-dismisses, but tapping it (or the icon, or anywhere on the card)
 *  closes it immediately too. */
export function ComingSoonBanner({
  open,
  onClose,
  title = "Coming soon",
  message,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-x-0 z-[70] flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
          initial={{ opacity: 0, y: 28, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        >
          <button
            type="button"
            onClick={onClose}
            className="oak-tap flex w-full max-w-[420px] items-center gap-4 rounded-3xl border border-sd-line bg-sd-elevated px-5 py-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sd-ink text-sd-bg">
              <Rocket size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-sd-ink">{title}</span>
              <span className="mt-0.5 block text-[13.5px] leading-snug text-sd-ink-muted">
                {message}
              </span>
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
