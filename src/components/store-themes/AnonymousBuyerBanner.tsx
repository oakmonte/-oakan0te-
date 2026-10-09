import { useEffect, useState } from "react";
import { Eye, UserRound } from "lucide-react";
import { GLASS_RIM, glassDark } from "@/lib/liquid-glass";

/** Shown when a seller opens the preview of their own website: that it's a
 *  preview, and (once the buyer identity is ready) that they're browsing and
 *  messaging as an anonymous buyer, exactly as a customer would. Drops in on
 *  arrival and leaves after a few seconds, so it never sits over their
 *  storefront's own header. */
// How many times the preview has shown these, on this device. After the
// fourth the seller knows, and they'd only be in the way.
const SEEN_KEY = "oakmonte:preview-banners-seen";
const SHOW_TIMES = 4;

export function AnonymousBuyerBanner({ anonymous }: { anonymous: boolean }) {
  const [shown, setShown] = useState(false);
  const [retired, setRetired] = useState(true);

  useEffect(() => {
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(SEEN_KEY)) || 0;
      if (seen < SHOW_TIMES) localStorage.setItem(SEEN_KEY, String(seen + 1));
    } catch {
      // Storage blocked: show them, never count.
    }
    if (seen >= SHOW_TIMES) return;
    setRetired(false);
    const enter = requestAnimationFrame(() => setShown(true));
    const leave = setTimeout(() => setShown(false), 4200);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(leave);
    };
  }, []);

  if (retired) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}
    >
      <div
        className={`${GLASS_RIM} flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]`}
        style={{
          ...glassDark,
          opacity: shown ? 1 : 0,
          transform: shown ? "translateY(0)" : "translateY(-12px)",
          transitionDelay: shown ? "0ms" : "0ms",
        }}
      >
        <Eye size={16} strokeWidth={2.4} />
        This is a preview of your storefront
      </div>
      {anonymous && (
        <div
          className={`${GLASS_RIM} flex items-center gap-2 rounded-full px-4 py-2.5 text-[13.5px] font-semibold text-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]`}
          style={{
            ...glassDark,
            opacity: shown ? 1 : 0,
            transform: shown ? "translateY(0)" : "translateY(-12px)",
            transitionDelay: shown ? "120ms" : "0ms",
          }}
        >
          <UserRound size={16} strokeWidth={2.4} />
          You&apos;re logged in as an anonymous buyer
        </div>
      )}
    </div>
  );
}
