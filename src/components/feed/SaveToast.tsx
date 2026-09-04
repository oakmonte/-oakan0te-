import { motion, AnimatePresence } from "framer-motion";
import { setSavePref, useSavePrefs, type SavePrefs } from "@/lib/save-prefs";

/** The strip that drops in after tapping the bookmark: what just happened,
 *  with a switch beside each line to undo it for good.
 *
 *  Deliberately short and near the top — it has to be readable in the second
 *  or two before the viewer scrolls on, and it must never cover the caption or
 *  the action rail. Switching a line off both cancels that half of the save
 *  and stops it happening on the next post (see save-prefs.ts).
 *
 *  Neither favourites nor wishlist has a table yet, so what this reports is
 *  currently local to the session. The toast, the toggles and the persistence
 *  are the parts that would survive the backend landing. */
export function SaveToast({
  open,
  hasItems,
  onDismiss,
}: {
  open: boolean;
  /** Whether the post has linked products. With none, the wishlist line is
   *  a lie — there's nothing to add — so it isn't shown. */
  hasItems: boolean;
  onDismiss: () => void;
}) {
  const prefs = useSavePrefs();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-x-0 z-30 flex justify-center px-4"
          style={{ top: "calc(env(safe-area-inset-top) + 54px)" }}
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        >
          <div
            className="w-full max-w-[340px] rounded-[12px] px-3.5 py-2 backdrop-blur-xl"
            style={{ background: "rgba(28,28,30,0.82)" }}
            onClick={onDismiss}
          >
            <ToastRow label="Post added to favourites" prefKey="favourites" on={prefs.favourites} />
            {hasItems && (
              <ToastRow label="Items added to wishlist" prefKey="wishlist" on={prefs.wishlist} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToastRow({
  label,
  prefKey,
  on,
}: {
  label: string;
  prefKey: keyof SavePrefs;
  on: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={`text-[12px] font-medium ${on ? "text-white" : "text-white/40"}`}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        // Stops the tap from also dismissing the toast — the whole point of
        // the switch is to act without the strip vanishing under your thumb.
        onClick={(e) => {
          e.stopPropagation();
          setSavePref(prefKey, !on);
        }}
        className="relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors duration-200"
        style={{ background: on ? "#f5c518" : "rgba(255,255,255,0.18)" }}
      >
        <motion.span
          className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white"
          animate={{ left: on ? 16 : 2 }}
          transition={{ type: "spring", stiffness: 700, damping: 40 }}
        />
      </button>
    </div>
  );
}
