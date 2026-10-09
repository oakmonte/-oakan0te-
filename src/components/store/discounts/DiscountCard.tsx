import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Copy, Share2 } from "lucide-react";
import { describeDiscount, formatKobo, type DiscountStatus } from "@/lib/discounts";
import type { DiscountStore, StoreDiscount } from "./discounts-api";

const STATUS_LABEL: Record<DiscountStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  used_up: "Used up",
  off: "Off",
};

const STATUS_TONE: Record<DiscountStatus, { text: string; dot: string }> = {
  active: { text: "text-sd-success-ink", dot: "bg-sd-success-mark" },
  scheduled: { text: "text-sd-accent-ink", dot: "bg-sd-accent-ink" },
  expired: { text: "text-sd-ink-muted", dot: "bg-sd-ink-faint" },
  used_up: { text: "text-sd-ink-muted", dot: "bg-sd-ink-faint" },
  off: { text: "text-sd-ink-muted", dot: "bg-sd-ink-faint" },
};

export function StatusBadge({ status }: { status: DiscountStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sd-soft px-2.5 py-1 text-[12px] font-semibold ${tone.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const when = (iso: string) => format(new Date(iso), "d MMM, h:mm a");

function usageLine(d: StoreDiscount): string {
  if (d.usage_limit != null) return `${d.used_count} of ${d.usage_limit} used`;
  if (d.used_count === 0) return "Not used yet";
  return `Used ${d.used_count} time${d.used_count === 1 ? "" : "s"}`;
}

function timingLine(d: StoreDiscount, status: DiscountStatus): string {
  if (status === "expired" && d.ends_at) return `Ended ${when(d.ends_at)}`;
  if (status === "scheduled" && d.starts_at) return `Starts ${when(d.starts_at)}`;
  if (d.ends_at) return `Ends ${when(d.ends_at)}`;
  return "No end date";
}

/** The line a buyer reads in a story or a DM. Says when it stops, if it does,
 *  so nobody is surprised at checkout. */
function shareText(d: StoreDiscount, store: DiscountStore | null): string {
  const where = store?.brand_name ? ` at ${store.brand_name}` : "";
  const until = d.ends_at ? ` Ends ${format(new Date(d.ends_at), "d MMM")}.` : "";
  return `Use code ${d.code} for ${describeDiscount(d)}${where} on Oakmonte.${until}`;
}

/** Clipboard API first; the hidden-textarea fallback covers in-app browsers
 *  (Instagram, TikTok) that don't expose navigator.clipboard. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

type Feedback = "copied" | "shared-copied" | "copy-failed" | null;

export function DiscountCard({
  discount: d,
  status,
  store,
  toggling,
  onEdit,
  onToggle,
}: {
  discount: StoreDiscount;
  status: DiscountStatus;
  store: DiscountStore | null;
  toggling: boolean;
  onEdit: () => void;
  onToggle: (next: boolean) => void;
}) {
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 1800);
    return () => clearTimeout(t);
  }, [feedback]);

  async function copy() {
    setFeedback((await copyText(d.code)) ? "copied" : "copy-failed");
  }

  async function share() {
    const url = store
      ? `${window.location.origin}/store-profile/${store.store_username}`
      : window.location.origin;
    const text = shareText(d, store);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text, url });
        return;
      } catch (err) {
        // The seller closing the share sheet is not a failure.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    // No share sheet (most desktops, some in-app browsers): put the whole
    // message on the clipboard instead, ready to paste into a chat.
    setFeedback((await copyText(`${text} ${url}`)) ? "shared-copied" : "copy-failed");
  }

  // Turning an ended code back on would change nothing a buyer sees, so the
  // switch is held off until the seller edits the end date or limit.
  const ended = status === "expired" || status === "used_up";

  return (
    <div className="rounded-2xl border border-sd-line bg-sd-surface">
      <button
        type="button"
        onClick={onEdit}
        className="w-full rounded-t-2xl px-4 pb-3 pt-4 text-left oak-motion-control active:bg-sd-soft"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 truncate text-[17px] font-semibold tracking-[0.04em] text-sd-ink">
            {d.code}
          </span>
          <StatusBadge status={status} />
        </span>
        <span className="mt-1 block text-[14px] text-sd-ink">{describeDiscount(d)}</span>
        <span className="mt-0.5 block text-[13px] text-sd-ink-muted">
          {usageLine(d)} · {timingLine(d, status)}
        </span>
        {d.redeemed_kobo > 0 && (
          <span className="mt-0.5 block text-[13px] text-sd-ink-muted">
            {formatKobo(d.redeemed_kobo)} taken off orders so far
          </span>
        )}
        <span className="sr-only">Edit code</span>
      </button>

      <div className="flex items-center gap-1 border-t border-sd-line px-2 py-1.5">
        <button
          type="button"
          onClick={() => void copy()}
          className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-sd-ink oak-motion-control active:bg-sd-soft"
        >
          {feedback === "copied" ? <Check size={16} /> : <Copy size={16} />}
          {feedback === "copied" ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-sd-ink oak-motion-control active:bg-sd-soft"
        >
          {feedback === "shared-copied" ? <Check size={16} /> : <Share2 size={16} />}
          {feedback === "shared-copied" ? "Message copied" : "Share"}
        </button>
        <span
          className="min-w-0 flex-1 truncate px-1 text-[12px] text-sd-danger-ink"
          aria-live="polite"
        >
          {feedback === "copy-failed" ? "Couldn't copy" : ""}
        </span>
        <ActiveSwitch
          on={d.active && !ended}
          disabled={toggling || ended}
          label={
            ended
              ? `${d.code} has ended. Edit it to use it again.`
              : `${d.active ? "Turn off" : "Turn on"} ${d.code}`
          }
          onChange={onToggle}
        />
      </div>
    </div>
  );
}

function ActiveSwitch({
  on,
  disabled,
  label,
  onChange,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="grid h-10 w-[60px] shrink-0 place-items-center disabled:opacity-40"
    >
      <span
        className={`relative h-[31px] w-[51px] rounded-full transition-colors duration-200 ${
          on ? "bg-sd-success-mark" : "bg-sd-ink-faint"
        }`}
      >
        {/* sd-on-accent is white in both schemes, like a native switch thumb. */}
        <span
          className="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-sd-on-accent shadow-sm transition-transform duration-200 ease-[var(--ease-smooth-out)]"
          style={{ transform: on ? "translateX(20px)" : "none" }}
        />
      </span>
    </button>
  );
}
