// The pieces both sides of an order render: the status chip and the timeline.
// Same component on the seller dashboard (--sd-* tokens) and on the buyer's
// pages (chat-* tokens) -- `side` picks the token set and the wording, so the
// two can't tell different stories about one order.
import { Check, X } from "lucide-react";
import {
  statusChip,
  type RefundState,
  type StatusTone,
  type TimelineKey,
  type TimelineStep,
} from "@/lib/order-status";
import { formatOrderTime } from "@/lib/order-format";

export type OrderSide = "seller" | "buyer";

const CHIP_TONE: Record<OrderSide, Record<StatusTone, string>> = {
  seller: {
    attention: "bg-sd-attention-mark/15 text-sd-attention-ink",
    progress: "bg-sd-accent-tint text-sd-accent-ink",
    success: "bg-sd-success-mark/15 text-sd-success-ink",
    danger: "bg-sd-danger-mark/12 text-sd-danger-ink",
    neutral: "bg-sd-soft text-sd-ink-muted",
  },
  buyer: {
    attention: "bg-chat-accent/15 text-chat-accent",
    progress: "bg-chat-accent/15 text-chat-accent",
    success: "bg-chat-online/15 text-chat-online",
    danger: "bg-chat-danger/12 text-chat-danger",
    neutral: "bg-chat-soft text-chat-muted",
  },
};

function Chip({ side, tone, label }: { side: OrderSide; tone: StatusTone; label: string }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold ${CHIP_TONE[side][tone]}`}
    >
      {label}
    </span>
  );
}

export function StatusChip({ status, side }: { status: string; side: OrderSide }) {
  const { label, tone } = statusChip(status, side);
  return <Chip side={side} tone={tone} label={label} />;
}

/** Only rendered for a closed order whose money moved (or should have). */
export function RefundChip({ refund, side }: { refund: RefundState; side: OrderSide }) {
  if (refund === "none") return null;
  return refund === "refunded" ? (
    <Chip side={side} tone="neutral" label="Refunded" />
  ) : (
    <Chip side={side} tone="attention" label="Refund pending" />
  );
}

const PALETTE = {
  seller: {
    fill: "bg-sd-ink text-sd-bg",
    stop: "bg-sd-danger-mark text-sd-bg",
    ring: "border-sd-ink",
    dot: "bg-sd-ink",
    idle: "border-sd-line",
    line: "bg-sd-line",
    lineDone: "bg-sd-ink",
    text: "text-sd-ink",
    muted: "text-sd-ink-muted",
    faint: "text-sd-ink-faint",
  },
  buyer: {
    fill: "bg-chat-text text-chat-bg",
    stop: "bg-chat-danger text-chat-bg",
    ring: "border-chat-text",
    dot: "bg-chat-text",
    idle: "border-chat-border",
    line: "bg-chat-border",
    lineDone: "bg-chat-text",
    text: "text-chat-text",
    muted: "text-chat-muted",
    faint: "text-chat-faint",
  },
} as const;

/** What a step that's still in progress is waiting on, in each side's words. */
const WAITING: Record<OrderSide, Partial<Record<TimelineKey, string>>> = {
  seller: {
    paid: "Waiting for the buyer to pay",
    shipped: "Waiting for you to book the courier",
    delivered: "With the courier",
    refund_owed: "Oakmonte is sending it back by hand",
  },
  buyer: {
    paid: "Waiting for your payment",
    shipped: "The seller is getting it ready",
    delivered: "With the courier",
    refund_owed: "Being arranged",
  },
};

export function OrderTimeline({ steps, side }: { steps: TimelineStep[]; side: OrderSide }) {
  const p = PALETTE[side];
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => {
        const next = steps[i + 1];
        const sub = s.at
          ? formatOrderTime(s.at)
          : s.state === "current"
            ? (WAITING[side][s.key] ?? "")
            : "";
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
            {next && (
              <span
                aria-hidden
                className={`absolute bottom-0 left-[10px] top-6 w-[2px] rounded-full ${
                  next.state === "upcoming" ? p.line : p.lineDone
                }`}
              />
            )}
            <span
              aria-hidden
              className={`relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full ${
                s.state === "done"
                  ? p.fill
                  : s.state === "stopped"
                    ? p.stop
                    : `border-2 ${s.state === "current" ? p.ring : p.idle}`
              }`}
            >
              {s.state === "done" && <Check size={13} strokeWidth={3} />}
              {s.state === "stopped" && <X size={13} strokeWidth={3} />}
              {s.state === "current" && <span className={`h-2 w-2 rounded-full ${p.dot}`} />}
            </span>
            <div className="min-w-0 pt-px">
              <p
                className={`text-[14.5px] leading-5 ${
                  s.state === "upcoming" ? p.faint : `font-semibold ${p.text}`
                }`}
              >
                {s.label}
              </p>
              {sub && <p className={`mt-0.5 text-[13px] leading-4 ${p.muted}`}>{sub}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
