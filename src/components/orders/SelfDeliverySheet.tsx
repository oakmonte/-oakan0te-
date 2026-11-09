import { useState } from "react";
import { X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { nairaFromKobo } from "@/lib/order-format";
import { AUTO_RELEASE_DAYS, TOP_UP_MAX_NAIRA, TOP_UP_MIN_NAIRA } from "@/lib/self-delivery";

/** The seller's confirm step for delivering a paid order themselves instead
 *  of booking the courier. Optionally asks the buyer for more delivery money
 *  first (the buyer already paid the courier's quote at checkout).
 *  Full-screen, like the decline sheet, because it holds a text field. */
export function SelfDeliverySheet({
  deliveryKobo,
  buyerName,
  canRequestFee,
  onDispatch,
  onRequestFee,
  onClose,
}: {
  /** What the buyer paid for delivery at checkout. */
  deliveryKobo: number;
  buyerName: string;
  /** False once an extra fee has been asked for: one ask per order. */
  canRequestFee: boolean;
  onDispatch: () => Promise<void>;
  onRequestFee: (naira: number) => Promise<void>;
  onClose: () => void;
}) {
  useLockedViewport();
  const keyboard = useKeyboardInset(true);
  const [extra, setExtra] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extraNaira = Number(extra.replace(/\D/g, "")) || 0;
  const asking = extraNaira > 0;
  const tooSmall = asking && extraNaira < TOP_UP_MIN_NAIRA;
  const tooBig = extraNaira > TOP_UP_MAX_NAIRA;

  async function submit() {
    if (sending || tooSmall || tooBig) return;
    setSending(true);
    setError(null);
    try {
      if (asking) await onRequestFee(extraNaira);
      else await onDispatch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the order.");
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="self-deliver-title"
      className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-sd-surface animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-sd-line bg-sd-surface/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur box-content">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-ml-2.5 grid h-11 w-11 place-items-center text-sd-ink-muted"
        >
          <X size={22} />
        </button>
        <span id="self-deliver-title" className="text-[17px] font-semibold text-sd-ink">
          Deliver it yourself
        </span>
        <span className="w-11" />
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
        <div className="rounded-2xl bg-sd-soft p-4 text-[14px] leading-relaxed text-sd-ink">
          <p>
            You get it to {buyerName || "the buyer"} yourself, no courier booked. The{" "}
            {nairaFromKobo(deliveryKobo)} they paid for delivery is yours.
          </p>
          <p className="mt-2">
            You're paid once they tap &ldquo;I've received it&rdquo;, or automatically{" "}
            {AUTO_RELEASE_DAYS} days after you mark it on its way.
          </p>
        </div>

        {canRequestFee && (
          <div>
            <label htmlFor="extra-fee" className="mb-1 block text-[17px] font-semibold text-sd-ink">
              Need more for delivery?
            </label>
            <p className="mb-3 text-[13px] leading-relaxed text-sd-ink-muted">
              Optional. Ask the buyer to pay extra on top of the {nairaFromKobo(deliveryKobo)}. They
              pay it from their order page, and it's added to your payout.
            </p>
            <div className="flex items-center rounded-2xl border border-sd-line bg-sd-surface px-4 focus-within:border-sd-ink-faint">
              <span className="text-[16px] text-sd-ink-muted">₦</span>
              <input
                id="extra-fee"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={extra ? Number(extra).toLocaleString() : ""}
                onChange={(e) => setExtra(e.target.value.replace(/\D/g, "").slice(0, 7))}
                className="h-12 min-w-0 flex-1 bg-transparent px-2 text-[16px] tabular-nums text-sd-ink outline-none placeholder:text-sd-ink-faint"
              />
            </div>
            {tooSmall && (
              <p className="mt-1.5 text-[12.5px] text-sd-danger-ink">
                Ask for at least ₦{TOP_UP_MIN_NAIRA.toLocaleString()}.
              </p>
            )}
            {tooBig && (
              <p className="mt-1.5 text-[12.5px] text-sd-danger-ink">
                That's more than ₦{TOP_UP_MAX_NAIRA.toLocaleString()}.
              </p>
            )}
            {asking && !tooSmall && !tooBig && (
              <p className="mt-1.5 text-[12.5px] text-sd-ink-muted">
                The buyer pays {nairaFromKobo((deliveryKobo / 100 + extraNaira) * 100)} for delivery
                in total. Send it once they've paid; you can also send it without waiting.
              </p>
            )}
          </div>
        )}
      </div>

      <div
        className="shrink-0 border-t border-sd-line bg-sd-surface px-4 pt-3 oak-safe-bottom"
        style={keyboard ? { marginBottom: keyboard } : undefined}
      >
        {error && <p className="mb-2 text-center text-[13px] text-sd-danger-ink">{error}</p>}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending || tooSmall || tooBig}
          className="h-14 w-full rounded-full bg-sd-ink text-[16px] font-semibold text-sd-bg oak-motion-control active:scale-[0.98] disabled:opacity-40"
        >
          {sending
            ? "Saving…"
            : asking
              ? `Ask the buyer for ₦${extraNaira.toLocaleString()}`
              : "It's on its way"}
        </button>
      </div>
    </div>
  );
}
