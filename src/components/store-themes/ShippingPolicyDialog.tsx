import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/** The store's shipping policy as a simple centred card, opened from the
 *  storefront footer. Deliberately plain white whatever the theme -- it's a
 *  notice, not part of the storefront's look. Rendered into <body> so a
 *  theme's transformed or scrolling containers can't clip or offset it. */
export function ShippingPolicyDialog({
  brandName,
  logoUrl,
  policy,
  onClose,
}: {
  brandName: string;
  logoUrl: string | null;
  policy: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${brandName} shipping policy`}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] bg-white px-7 pb-8 pt-10 text-center text-[#111] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 p-2 text-black/45 active:scale-90"
        >
          <X size={22} strokeWidth={1.5} />
        </button>

        <div className="mx-auto flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full border border-black/10">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[28px] font-semibold uppercase">{brandName.charAt(0)}</span>
          )}
        </div>

        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-black/40">
          Shipping &amp; delivery
        </p>
        <h2 className="mt-2 text-[22px] font-medium leading-tight">{brandName} Shipping Policy</h2>

        <div className="mt-6 border-t border-black/10" />
        <p className="max-h-[45dvh] overflow-y-auto whitespace-pre-line py-6 text-left text-[15px] leading-relaxed text-black/65">
          {policy}
        </p>
        <div className="border-t border-black/10" />

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full bg-[#111] py-4 text-[13px] font-semibold uppercase tracking-[0.18em] text-white active:scale-[0.99]"
        >
          Accept &amp; close
        </button>
      </div>
    </div>,
    document.body,
  );
}
