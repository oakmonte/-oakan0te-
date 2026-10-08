import { useState } from "react";
import { Check, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { nairaFromKobo } from "@/lib/order-format";
import { composeDeclineReason, DECLINE_PRESETS, DECLINE_REASON_MAX } from "@/lib/order-status";

const OTHER = "Something else";

/** The seller's confirm step for turning down a paid order. Full-screen, like
 *  the payout sheet, because it holds a text field: a short bottom card would
 *  end up under the keyboard. It says exactly what happens to the money and
 *  the stock before anything is sent, since none of it can be undone. */
export function DeclineOrderSheet({
  totalKobo,
  itemCount,
  refundMode,
  onConfirm,
  onClose,
}: {
  totalKobo: number;
  itemCount: number;
  /** From the server's own refund plan, so the promise here matches what
   *  the decline will actually do. */
  refundMode: "paystack" | "manual" | "none";
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  useLockedViewport();
  const keyboard = useKeyboardInset(true);
  const [preset, setPreset] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOther = preset === OTHER;
  const reason = composeDeclineReason(isOther ? null : preset, note);
  const ready = preset !== null && reason !== null;
  const room = DECLINE_REASON_MAX - (isOther || !preset ? 0 : preset.length + 2);

  const money = nairaFromKobo(totalKobo);
  const refundLine =
    refundMode === "paystack"
      ? `The buyer gets ${money} back in full, delivery included, through Paystack.`
      : refundMode === "manual"
        ? `The buyer is owed ${money} back in full, delivery included. Oakmonte sends it by hand.`
        : "No payment went through on this order, so there's nothing to refund.";

  async function submit() {
    if (!ready || !reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await onConfirm(reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't decline the order.");
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="decline-title"
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
        <span id="decline-title" className="text-[17px] font-semibold text-sd-ink">
          Decline order
        </span>
        <span className="w-11" />
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5">
        <div className="rounded-2xl bg-sd-soft p-4 text-[14px] leading-relaxed text-sd-ink">
          <p>{refundLine}</p>
          <p className="mt-2">
            {itemCount === 1 ? "The item goes" : "The items go"} back into your stock. This can't be
            undone.
          </p>
        </div>

        <div>
          <p className="mb-1 text-[17px] font-semibold text-sd-ink">Why are you declining?</p>
          <p className="mb-3 text-[13px] text-sd-ink-muted">The buyer sees this on their order.</p>
          <div className="overflow-hidden rounded-2xl border border-sd-line" role="radiogroup">
            {[...DECLINE_PRESETS, OTHER].map((p) => {
              const picked = preset === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => setPreset(p)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-sd-line px-4 py-3 text-left last:border-0 oak-motion-control"
                >
                  <span
                    className={`text-[15px] text-sd-ink ${picked ? "font-semibold" : "font-normal"}`}
                  >
                    {p}
                  </span>
                  <span
                    className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full ${
                      picked ? "bg-sd-ink text-sd-bg" : "border-2 border-sd-line"
                    }`}
                  >
                    {picked && <Check size={13} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="decline-note"
            className="mb-2 block text-[15px] font-semibold text-sd-ink"
          >
            {isOther ? "Tell the buyer why" : "Add a note for the buyer (optional)"}
          </label>
          <textarea
            id="decline-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, Math.max(room, 0)))}
            rows={3}
            placeholder={isOther ? "What happened?" : "Anything they should know"}
            className="w-full resize-none rounded-2xl border border-sd-line bg-sd-surface px-4 py-3 text-[16px] text-sd-ink outline-none transition-colors duration-150 placeholder:text-sd-ink-faint focus:border-sd-ink-faint"
          />
          <p className="mt-1 text-right text-[12px] tabular-nums text-sd-ink-faint">
            {note.length}/{Math.max(room, 0)}
          </p>
        </div>
      </div>

      <div
        className="shrink-0 border-t border-sd-line bg-sd-surface px-4 pt-3 oak-safe-bottom"
        style={keyboard ? { marginBottom: keyboard } : undefined}
      >
        {error && <p className="mb-2 text-center text-[13px] text-sd-danger-ink">{error}</p>}
        {preset !== null && !reason && (
          <p className="mb-2 text-center text-[13px] text-sd-ink-muted">
            Write a few words so the buyer knows why.
          </p>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready || sending}
          className="h-14 w-full rounded-full bg-sd-ink text-[16px] font-semibold text-sd-bg oak-motion-control active:scale-[0.98] disabled:opacity-40"
        >
          {sending
            ? "Declining…"
            : refundMode === "none"
              ? "Decline order"
              : `Decline and refund ${money}`}
        </button>
      </div>
    </div>
  );
}
