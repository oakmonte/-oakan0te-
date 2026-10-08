import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ShoppingBag } from "lucide-react";
import { useGoRoot } from "@/hooks/use-back";

export type BagToastMessage = {
  title: string;
  detail?: string;
  image?: string | null;
  /** Offer "View bag". Off for "nothing was added" messages. */
  viewBag?: boolean;
};

/** The confirmation after something goes in the bag. Drops in from the top
 *  like LockedBanner, for the same reason (a corner toast got missed), and is
 *  fixed white for the same reason too: it lands over storefront themes and
 *  black video alike, so it can't borrow either surface's colours.
 *
 *  const { toast, showBagToast } = useBagToast();
 *  ... showBagToast({ title: "Added to your bag", viewBag: true }) ... {toast} */
export function useBagToast(): {
  toast: ReactNode;
  showBagToast: (message: BagToastMessage) => void;
} {
  const goRoot = useGoRoot();
  const [message, setMessage] = useState<BagToastMessage | null>(null);
  // Bumped per show so a second add while one is up re-runs the entrance and
  // reads as a new confirmation rather than nothing happening.
  const [seq, setSeq] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBagToast = useCallback((next: BagToastMessage) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    setSeq((n) => n + 1);
    timer.current = setTimeout(() => setMessage(null), 3600);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const toast =
    message && typeof document !== "undefined"
      ? createPortal(
          <div
            key={seq}
            role="status"
            className="fixed inset-x-0 z-[200] flex justify-center px-4"
            style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <div className="flex w-full max-w-md items-center gap-3 rounded-2xl bg-white py-2.5 pl-2.5 pr-2.5 text-black shadow-[0_12px_40px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-top-4 duration-300">
              <button
                type="button"
                onClick={() => setMessage(null)}
                aria-label="Dismiss"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                {message.image ? (
                  <img
                    src={message.image}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black text-white">
                    <ShoppingBag size={19} strokeWidth={2.25} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold leading-snug">
                    {message.title}
                  </span>
                  {message.detail && (
                    <span className="block text-[13px] leading-snug text-black/55">
                      {message.detail}
                    </span>
                  )}
                </span>
              </button>
              {message.viewBag && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    // The bag is a tab root, so it is reached the way the tab
                    // bar reaches it: unwind, then replace. A plain push would
                    // leave it stacked above wherever this toast was shown.
                    goRoot({ to: "/cart" });
                  }}
                  className="h-10 shrink-0 rounded-full bg-black px-4 text-[14px] font-semibold text-white active:scale-[0.97]"
                >
                  View bag
                </button>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return { toast, showBagToast };
}
