import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X, SlidersHorizontal, ImageIcon, Smile, AtSign } from "lucide-react";

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
  const dragControls = useDragControls();

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
          <motion.div
            className="relative flex flex-col rounded-t-[14px] bg-[#1c1c1e] text-white"
            style={{ height: "68vh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 460, damping: 44 }}
            drag="y"
            // Drag only from the handle, so the comment list can scroll —
            // the default listener makes the whole sheet a drag surface and
            // eats the scroll.
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            {/* Grab handle — also the drag target people reach for first. */}
            <div
              className="flex justify-center pt-2 pb-1"
              style={{ touchAction: "none" }}
              onPointerDown={(e) => dragControls.start(e)}
            >
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

            <div className="flex-1 overflow-y-auto px-4">
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
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
