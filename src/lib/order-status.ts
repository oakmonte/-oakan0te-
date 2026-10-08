// What an order's state means to the people looking at it: the seller's
// status tabs, the chips on both sides, the refund state and the timeline.
//
// Pure on purpose. The server derives these from rows and the screens render
// them, and both the seller's order page and the buyer's must tell the same
// story about the same order -- one function each means they can't drift.

export type OrderStatus =
  | "awaiting_acceptance"
  | "awaiting_payment"
  | "paid"
  | "shipped"
  | "delivered"
  | "declined"
  | "cancelled";

/* ---------- seller tabs ---------- */

export type SellerTab = "to_ship" | "shipped" | "delivered" | "closed";

export const SELLER_TABS: { key: SellerTab; label: string; statuses: OrderStatus[] }[] = [
  { key: "to_ship", label: "To ship", statuses: ["paid"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  // A seller's decline is the only way an order closes today; "cancelled" is in
  // the schema for later and belongs in the same place when it arrives.
  { key: "closed", label: "Cancelled", statuses: ["declined", "cancelled"] },
];

export function parseSellerTab(value: unknown): SellerTab {
  return SELLER_TABS.some((t) => t.key === value) ? (value as SellerTab) : "to_ship";
}

export function statusesForTab(tab: SellerTab): OrderStatus[] {
  return SELLER_TABS.find((t) => t.key === tab)?.statuses ?? ["paid"];
}

/* ---------- chips ---------- */

/** How loud a status is. The screens map it onto their own tokens (--sd-* on
 *  the dashboard, chat-* elsewhere), which is why this isn't a class name. */
export type StatusTone = "attention" | "progress" | "success" | "danger" | "neutral";

const SELLER_LABEL: Record<OrderStatus, string> = {
  awaiting_acceptance: "Not paid",
  awaiting_payment: "Not paid",
  paid: "To ship",
  shipped: "Shipped",
  delivered: "Delivered",
  declined: "Declined",
  cancelled: "Cancelled",
};

const BUYER_LABEL: Record<OrderStatus, string> = {
  awaiting_acceptance: "Waiting for payment",
  awaiting_payment: "Waiting for payment",
  paid: "Being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  declined: "Declined",
  cancelled: "Cancelled",
};

const TONE: Record<OrderStatus, StatusTone> = {
  awaiting_acceptance: "neutral",
  awaiting_payment: "neutral",
  paid: "attention",
  shipped: "progress",
  delivered: "success",
  declined: "danger",
  cancelled: "danger",
};

function isStatus(value: string): value is OrderStatus {
  return value in TONE;
}

export function statusChip(
  status: string,
  audience: "buyer" | "seller",
): { label: string; tone: StatusTone } {
  if (!isStatus(status)) return { label: status, tone: "neutral" };
  return {
    label: (audience === "seller" ? SELLER_LABEL : BUYER_LABEL)[status],
    tone: TONE[status],
  };
}

/* ---------- refunds ---------- */

/** Where the buyer's money stands once an order is closed.
 *   - none: nothing was taken, or the order is still live.
 *   - refunded: the payment row says refunded (Paystack accepted the refund).
 *   - owed: the order closed with the money still held -- someone has to send
 *     it back by hand. Derived from the rows, not from a flag, so a refund
 *     whose bookkeeping write was lost still shows up as owed. */
export type RefundState = "none" | "refunded" | "owed";

export function refundStateFor(status: string, paymentStatus: string | null): RefundState {
  if (paymentStatus === "refunded") return "refunded";
  const closed = status === "declined" || status === "cancelled";
  if (closed && paymentStatus === "confirmed") return "owed";
  return "none";
}

/** The payment that tells an order's story, from its payment rows newest
 *  first: the confirmed or refunded one if there is one (a buyer can have a
 *  failed attempt before the one that went through), else the newest attempt. */
export function pickOrderPayment<T extends { status: string }>(newestFirst: T[]): T | null {
  return (
    newestFirst.find((p) => p.status === "confirmed" || p.status === "refunded") ??
    newestFirst[0] ??
    null
  );
}

/* ---------- decline reasons ---------- */

export const DECLINE_REASON_MAX = 300;

/** The preset reasons a seller picks from. "Other" needs their own words. */
export const DECLINE_PRESETS = [
  "Out of stock",
  "Item is damaged or faulty",
  "Can't deliver to this address",
] as const;

/** Joins the picked preset and the seller's note into the one line the buyer
 *  sees, or returns null when there is nothing usable. The server runs this
 *  too, so a hand-built request can't store an empty or oversized reason. */
export function composeDeclineReason(preset: string | null, note: string): string | null {
  const cleanNote = note.replace(/\s+/g, " ").trim();
  const cleanPreset = preset?.trim() ?? "";
  const joined =
    cleanPreset && cleanNote ? `${cleanPreset}: ${cleanNote}` : cleanPreset || cleanNote;
  if (joined.length < 3) return null;
  return joined.slice(0, DECLINE_REASON_MAX);
}

/* ---------- timeline ---------- */

export type TimelineKey =
  | "placed"
  | "paid"
  | "shipped"
  | "delivered"
  | "declined"
  | "cancelled"
  | "refunded"
  | "refund_owed";

/** done: happened. current: what the order is waiting on now. upcoming: still
 *  ahead. stopped: the order ended here (declined / cancelled). */
export type TimelineState = "done" | "current" | "upcoming" | "stopped";

export type TimelineStep = {
  key: TimelineKey;
  label: string;
  /** ISO time, or null when it happened but no row recorded when. */
  at: string | null;
  state: TimelineState;
};

export type TimelineFacts = {
  status: string;
  createdAt: string;
  updatedAt: string;
  /** order_payments.confirmed_at of the payment that settled the order. */
  paidAt: string | null;
  paymentStatus: string | null;
  /** order_events rows, oldest first. Empty until that migration is applied --
   *  every step below has a fallback that doesn't need them. */
  events: { kind: string; at: string }[];
};

const LABEL: Record<TimelineKey, string> = {
  placed: "Order placed",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  declined: "Declined",
  cancelled: "Cancelled",
  refunded: "Refunded",
  refund_owed: "Refund pending",
};

const step = (key: TimelineKey, state: TimelineState, at: string | null = null): TimelineStep => ({
  key,
  label: LABEL[key],
  at,
  state,
});

export function buildTimeline(facts: TimelineFacts): TimelineStep[] {
  const { status, createdAt, updatedAt, paidAt } = facts;
  const eventAt = (kind: string) => facts.events.find((e) => e.kind === kind)?.at ?? null;
  // Terminal statuses are never written again, so updated_at is exactly when
  // the order reached them. Shipped is the one that isn't terminal: once the
  // order is delivered, only the event row still knows when it shipped.
  const lastChange = (kind: string) => eventAt(kind) ?? updatedAt;

  const placed = step("placed", "done", createdAt);
  // A payment can be confirmed without its time (an older row), and a closed
  // order may never have been paid at all -- tell those two apart.
  const wasPaid = paidAt !== null || ["confirmed", "refunded"].includes(facts.paymentStatus ?? "");

  switch (status) {
    case "awaiting_acceptance":
    case "awaiting_payment":
      return [
        placed,
        step("paid", "current"),
        step("shipped", "upcoming"),
        step("delivered", "upcoming"),
      ];
    case "paid":
      return [
        placed,
        step("paid", "done", paidAt),
        step("shipped", "current"),
        step("delivered", "upcoming"),
      ];
    case "shipped":
      return [
        placed,
        step("paid", "done", paidAt),
        step("shipped", "done", lastChange("shipped")),
        step("delivered", "current"),
      ];
    case "delivered":
      return [
        placed,
        step("paid", "done", paidAt),
        step("shipped", "done", eventAt("shipped")),
        step("delivered", "done", lastChange("delivered")),
      ];
    case "declined":
    case "cancelled": {
      const steps = [placed];
      if (wasPaid) steps.push(step("paid", "done", paidAt));
      steps.push(step(status, "stopped", lastChange(status)));
      const refund = refundStateFor(status, facts.paymentStatus);
      if (refund === "refunded") steps.push(step("refunded", "done", eventAt("refund_started")));
      if (refund === "owed") steps.push(step("refund_owed", "current"));
      return steps;
    }
    default:
      return [placed];
  }
}

/** Order ids are uuids. Checked before querying so a junk id is a plain 404
 *  rather than a Postgres cast error. */
export function isOrderId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Reads a list screen's `before` cursor off a query string: the created_at of
 *  the last row it already has, passed back verbatim. Not re-serialised through
 *  Date, which would drop Postgres's microseconds and skip any row created in
 *  the same millisecond as the cursor. */
export function parseBefore(value: string | null): string | null {
  if (!value || value.length > 40) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    return null;
  }
  return Number.isNaN(Date.parse(value)) ? null : value;
}

/** A short, readable handle for an order -- the first block of its uuid,
 *  uppercased. Enough for a seller and buyer to agree which order they mean
 *  in a chat; never used to look anything up. */
export function orderRef(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}
