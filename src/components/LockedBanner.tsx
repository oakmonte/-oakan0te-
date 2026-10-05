import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Lock } from "lucide-react";

/** A banner that drops in from the top to say a feature isn't available yet
 *  (cart, tagging people, linking other stores' products). Big enough to
 *  actually read -- a one-line toast in the corner got missed. Portaled to
 *  <body> above every sheet, gone after a few seconds or on tap.
 *
 *  const { banner, showLocked } = useLockedBanner();
 *  ... onClick={() => showLocked("Cart is unavailable for now")} ... {banner} */
export function useLockedBanner(): { banner: ReactNode; showLocked: (message: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLocked = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), 2800);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const banner =
    message && typeof document !== "undefined"
      ? createPortal(
          <div
            role="status"
            className="fixed inset-x-0 z-[200] flex justify-center px-4"
            style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left text-black shadow-[0_12px_40px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-top-4 duration-300"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-white">
                <Lock size={18} strokeWidth={2.5} />
              </span>
              <span className="text-[15px] font-semibold leading-snug">{message}</span>
            </button>
          </div>,
          document.body,
        )
      : null;

  return { banner, showLocked };
}
