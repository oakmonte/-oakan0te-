import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Lock, MessageCircle } from "lucide-react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";

const PUSH = "cubic-bezier(0.32, 0.72, 0, 1)";

/** What a shopper sees on tapping a product before launch: checkout isn't
 *  open yet, said plainly, with a way to reach Oakmonte Support. A card that
 *  rises from the bottom; tapping outside, the close button or the phone's
 *  back gesture dismisses it. Portaled above the collection page (z-80). */
export function SalesLockedNotice({ onClose }: { onClose: () => void }) {
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    setShown(false);
    setTimeout(onClose, reduceMotion ? 150 : 200);
  }
  useOverlayHistory(!closing, close);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label="Sales locked"
    >
      <div
        className="absolute inset-0 bg-black"
        style={{ opacity: shown ? 0.4 : 0, transition: "opacity 200ms ease" }}
        onClick={close}
      />
      <div
        className="absolute inset-x-3 rounded-[26px] bg-white px-6 pt-7 pb-5 text-center text-black shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 12px)",
          transform: reduceMotion || shown ? "translateY(0)" : "translateY(110%)",
          opacity: reduceMotion ? (shown ? 1 : 0) : 1,
          transition: reduceMotion
            ? "opacity 150ms ease"
            : `transform ${closing ? 200 : 340}ms ${PUSH}`,
        }}
      >
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-black text-white">
          <Lock size={20} strokeWidth={2.5} />
        </span>
        <h2 className="mt-4 text-[20px] font-bold leading-tight tracking-[-0.01em]">
          Sales are still locked until full launch
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-black/60">
          Coming very soon. We appreciate your patience.
        </p>
        <Link
          to="/messages"
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black text-[15px] font-semibold text-white transition-transform duration-150 active:scale-[0.97]"
        >
          <MessageCircle size={18} strokeWidth={2.25} />
          Any complaints? Message us
        </Link>
        <button
          type="button"
          onClick={close}
          className="mt-2 h-11 w-full rounded-full text-[15px] font-semibold text-black/60 transition-transform duration-150 active:scale-[0.97]"
        >
          Got it
        </button>
      </div>
    </div>,
    document.body,
  );
}
