import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion";
import { X, SlidersHorizontal, ImageIcon, Smile, AtSign } from "lucide-react";

// Snap back from a swipe that did not go far enough to dismiss.
const SETTLE = { type: "spring" as const, stiffness: 420, damping: 40 };

/** The comment sheet behind the post viewer's comment icon.
 *
 *  There is no comments table in the schema yet (see the tables in
 *  my-supabase/types.ts — posts, follows, products… and nothing for comments
 *  or likes), so this renders the real sheet with an honest empty state and a
 *  disabled composer rather than a text field that silently throws away what
 *  you type. Everything else — the drag-to-dismiss sheet, the header count,
 *  the composer row — is wired and will not need rebuilding once
 *  `post_comments` exists: swap the empty state for the list and enable the
 *  input.
 *
 *  Portalled to <body> for the same reason PostFeed is: it renders from inside
 *  the profile pager's transformed track, and a transformed ancestor becomes
 *  the containing block for `position: fixed`. */
export function CommentSheet({
  open,
  onClose,
  count = 0,
}: {
  open: boolean;
  onClose: () => void;
  count?: number;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragY = useMotionValue(0);
  const dragX = useMotionValue(0);

  // The feed behind is a scroll-snap list; letting it move under an open
  // sheet means closing the sheet lands you on a different post.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Two ways out, both by hand rather than through framer's `drag`.
  //
  // framer's drag can't express either of these: `drag="y"` on the panel eats
  // every scroll in the comment list, and restricting it to the handle (what
  // this did before) means the list itself offers no way out at all. The rules
  // wanted here are conditional on scroll position, which is exactly what a
  // non-passive touchmove listener is for — same approach as the feed's own
  // swipe-to-dismiss, and for the same reason: once the browser claims a touch
  // as a scroll it stops delivering pointermove entirely.
  //
  //   left  — always dismisses, from anywhere on the sheet
  //   down  — dismisses only while the list is already at the top, so
  //           scrolling up through comments still just scrolls
  //
  // Both exit downward: AnimatePresence's `y: 100%` runs on close either way,
  // so a left swipe reads as the sheet being put away, not thrown sideways.
  useEffect(() => {
    const el = sheetRef.current;
    if (!open || !el) return;

    let startX = 0;
    let startY = 0;
    let axis: "x" | "y" | null = null;
    let tracking = false;
    let dismissing = false;

    const atTop = () => (listRef.current?.scrollTop ?? 0) <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
      tracking = true;
      dismissing = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Rightward does nothing — reserved, and grabbing it here would
          // fight the OS back-swipe on the edge of the screen.
          if (dx >= 0) {
            tracking = false;
            return;
          }
          axis = "x";
        } else {
          if (dy <= 0 || !atTop()) {
            tracking = false;
            return;
          }
          axis = "y";
        }
        dismissing = true;
      }

      e.preventDefault();
      if (axis === "x") dragX.set(Math.min(0, dx) * 0.6);
      else dragY.set(Math.max(0, dy));
    };

    const onTouchEnd = () => {
      if (dismissing) {
        const past = axis === "x" ? -dragX.get() > 70 : dragY.get() > 110;
        if (past) {
          onClose();
        } else {
          animate(dragX, 0, SETTLE);
          animate(dragY, 0, SETTLE);
        }
      }
      tracking = false;
      dismissing = false;
      axis = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [open, onClose, dragX, dragY]);

  // A reopened sheet must not still be carrying the drag that closed it.
  useEffect(() => {
    if (!open) {
      dragX.set(0);
      dragY.set(0);
    }
  }, [open, dragX, dragY]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Two nodes, one job each. The outer owns the open/close slide, the
              inner owns the live drag — sharing a single `y` between an
              animate target and a motion value makes framer fight itself. */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 460, damping: 44 }}
          >
            <motion.div
              ref={sheetRef}
              className="relative flex flex-col rounded-t-[14px] bg-[#1c1c1e] text-white"
              style={{ height: "68vh", y: dragY, x: dragX }}
            >
              {/* Grab handle — also the drag target people reach for first. */}
              <div className="flex justify-center pt-2 pb-1">
                <span className="h-1 w-9 rounded-full bg-white/25" />
              </div>

              <div className="relative flex items-center justify-center px-4 pb-3">
                <span className="text-[14px] font-semibold">
                  {count.toLocaleString()} {count === 1 ? "comment" : "comments"}
                </span>
                <button
                  type="button"
                  aria-label="Sort comments"
                  className="absolute left-1/2 ml-[76px] text-white/70 active:scale-90"
                >
                  <SlidersHorizontal size={15} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close comments"
                  className="absolute right-4 text-white active:scale-90"
                >
                  <X size={22} />
                </button>
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto px-4">
                <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
                  <p className="text-[15px] font-semibold text-white/80">No comments yet</p>
                  <p className="max-w-[240px] text-[12px] text-white/40">
                    Comments aren&apos;t live yet — this post can&apos;t take them until the backend
                    ships.
                  </p>
                </div>
              </div>

              <div
                className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
              >
                <div className="h-8 w-8 shrink-0 rounded-full bg-white/15" />
                <div className="flex flex-1 items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2">
                  <input
                    disabled
                    placeholder="Comments aren't live yet"
                    className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-white/35"
                  />
                  <ImageIcon size={17} className="shrink-0 text-white/35" />
                  <Smile size={17} className="shrink-0 text-white/35" />
                  <AtSign size={17} className="shrink-0 text-white/35" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
