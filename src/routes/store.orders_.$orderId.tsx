import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, MessageCircle, Phone } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { DeclineOrderSheet } from "@/components/orders/DeclineOrderSheet";
import { OrderTimeline, StatusChip } from "@/components/orders/order-ui";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { authedFetch } from "@/lib/authed-fetch";
import { formatOrderTime, nairaFromKobo } from "@/lib/order-format";
import { orderRef, type RefundState, type TimelineStep } from "@/lib/order-status";

// One order, from the seller's side: what to send, where, the money, what has
// happened so far, and the two things they can still do while it's paid and
// unshipped -- book the courier, or decline it.
//
// A sub-route rather than a sheet over the list so an order has a URL of its
// own (to come back to, or for a future "new order" notification to open).
// Trailing underscore: it sits in the /store layout but not inside the list.
export const Route = createFileRoute("/store/orders_/$orderId")({
  component: StoreOrderPage,
});

type Detail = {
  id: string;
  status: string;
  createdAt: string;
  itemsKobo: number;
  deliveryKobo: number;
  platformFeeKobo: number;
  totalKobo: number;
  shipTo: { name: string; phone: string; address: string };
  courierName: string | null;
  shipbubbleOrderId: string | null;
  trackingUrl: string | null;
  declineReason: string | null;
  buyerUsername: string | null;
  isGuest: boolean;
  payment: {
    method: string;
    status: string;
    amountKobo: number;
    confirmedAt: string | null;
  } | null;
  refund: RefundState;
  refundNote: string | null;
  timeline: TimelineStep[];
  items: {
    title: string;
    variant_label: string | null;
    image_url: string | null;
    unit_price_kobo: number;
    quantity: number;
  }[];
  canShip: boolean;
  shipBlockedReason: string | null;
  canDecline: boolean;
  declineRefund: "paystack" | "manual" | "none" | null;
};

const HEADLINE: Record<string, { title: string; note: (o: Detail) => string }> = {
  paid: {
    title: "Ready to ship",
    note: () => "The buyer has paid. Book the courier to send it on its way.",
  },
  shipped: {
    title: "On its way",
    note: (o) =>
      `Handed to ${o.courierName ?? "the courier"}. It moves to Delivered once they confirm.`,
  },
  delivered: { title: "Delivered", note: () => "The courier confirmed delivery." },
  declined: { title: "Declined", note: () => "You turned this order down." },
  cancelled: { title: "Cancelled", note: () => "This order was cancelled." },
};

function StoreOrderPage() {
  const { orderId } = Route.useParams();
  // undefined = loading, null = not this store's (or not real).
  const [order, setOrder] = useState<Detail | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const closeDecline = useCallback(() => setDeclineOpen(false), []);
  useOverlayHistory(declineOpen, closeDecline);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch(`/api/store/orders/${orderId}`);
      if (res.status === 404) {
        setOrder(null);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setOrder((await res.json()) as Detail);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ship() {
    setActionError("");
    setNotice("");
    setShipping(true);
    try {
      const res = await authedFetch(`/api/store/orders/${orderId}/ship`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setActionError(body?.error ?? "Couldn't book the courier.");
        return;
      }
      setNotice("Courier booked. The order is on its way.");
      await load();
    } catch {
      setActionError("Couldn't reach Oakmonte. Check your connection.");
    } finally {
      setShipping(false);
    }
  }

  // Throws on failure so the sheet can show the message and stay open.
  async function decline(reason: string) {
    let res: Response;
    try {
      res = await authedFetch(`/api/store/orders/${orderId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
    } catch {
      throw new Error("Couldn't reach Oakmonte. Check your connection.");
    }
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      refund?: "refunded" | "manual" | "none";
    } | null;
    if (!res.ok) throw new Error(body?.error ?? "Couldn't decline the order.");
    setDeclineOpen(false);
    setActionError("");
    setNotice(
      body?.refund === "refunded"
        ? "Order declined. The buyer's refund has gone to Paystack."
        : body?.refund === "manual"
          ? "Order declined. Oakmonte will send the buyer's refund by hand."
          : "Order declined.",
    );
    await load();
  }

  const header = (
    <div className="sticky top-14 z-20 flex h-14 items-center justify-between border-b border-sd-line bg-sd-surface/95 px-4 backdrop-blur">
      <BackButton
        icon="chevron"
        size={18}
        label="Orders"
        to={{ to: "/store/orders" }}
        alwaysShow
        className="-ml-1 flex h-11 items-center gap-0.5 text-sm text-sd-ink-muted"
      />
      <span className="text-[15px] font-semibold text-sd-ink">
        {order ? orderRef(order.id) : "Order"}
      </span>
      <span className="w-16" />
    </div>
  );

  if (order === undefined) {
    return (
      <div className="min-h-dvh bg-sd-bg">
        {header}
        {loadError ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <p className="text-[14px] text-sd-ink-muted">Couldn't load this order.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="oak-tap h-11 rounded-full bg-sd-soft px-6 text-[14px] font-semibold text-sd-ink"
            >
              Try again
            </button>
          </div>
        ) : (
          <DetailSkeleton />
        )}
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="min-h-dvh bg-sd-bg">
        {header}
        <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
          <p className="sd-editorial text-[18px] text-sd-ink">Order not found</p>
          <p className="max-w-[260px] text-[13px] leading-relaxed text-sd-ink-muted">
            It isn't one of your store's orders, or the link is wrong.
          </p>
          <Link
            to="/store/orders"
            className="oak-tap mt-3 flex h-11 items-center rounded-full bg-sd-ink px-6 text-[14px] font-semibold text-sd-bg"
          >
            See your orders
          </Link>
        </div>
      </div>
    );
  }

  const headline = HEADLINE[order.status];
  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);
  const actions = order.canShip || order.canDecline;
  const closed = order.status === "declined" || order.status === "cancelled";

  return (
    <div className="min-h-dvh bg-sd-bg">
      {header}

      <div
        className={`flex flex-col gap-3 px-4 pt-4 ${
          actions
            ? "pb-[calc(env(safe-area-inset-bottom)+9rem)]"
            : "pb-[calc(env(safe-area-inset-bottom)+2.5rem)]"
        }`}
      >
        {notice && (
          <p
            role="status"
            className="rounded-2xl bg-sd-soft px-4 py-3 text-[14px] text-sd-ink animate-in fade-in duration-300"
          >
            {notice}
          </p>
        )}

        <Section>
          <div className="flex items-center gap-2">
            <StatusChip status={order.status} side="seller" />
            <span className="text-[12.5px] text-sd-ink-muted">
              Placed {formatOrderTime(order.createdAt)}
            </span>
          </div>
          <p className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-sd-ink">
            {headline?.title ?? order.status}
          </p>
          {headline && (
            <p className="mt-1 text-[14px] leading-relaxed text-sd-ink-muted">
              {headline.note(order)}
            </p>
          )}
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex h-10 items-center text-[14px] font-semibold text-sd-ink underline underline-offset-2"
            >
              Track delivery
            </a>
          )}
        </Section>

        {closed && (
          <Section title="Why it closed">
            <p className="text-[15px] leading-relaxed text-sd-ink">
              {order.declineReason ?? "No reason was recorded."}
            </p>
            {order.refund !== "none" && (
              <div className="mt-3 border-t border-sd-line pt-3">
                <p className="text-[14px] font-semibold text-sd-ink">
                  {order.refund === "refunded" ? "Refunded" : "Refund pending"}
                </p>
                <p className="mt-0.5 text-[13.5px] leading-relaxed text-sd-ink-muted">
                  {order.refund === "refunded"
                    ? `The buyer's ${nairaFromKobo(order.payment?.amountKobo ?? order.totalKobo)} went back through Paystack. It can take a few working days to reach them.`
                    : `The buyer's ${nairaFromKobo(order.payment?.amountKobo ?? order.totalKobo)} hasn't gone back yet. Oakmonte is sending it by hand.`}
                </p>
                {order.refund === "owed" && order.refundNote && (
                  <p className="mt-1 text-[12.5px] text-sd-ink-faint">{order.refundNote}</p>
                )}
              </div>
            )}
          </Section>
        )}

        <Section title="Timeline">
          <OrderTimeline steps={order.timeline} side="seller" />
        </Section>

        <Section title={`Items (${itemCount})`}>
          <div className="flex flex-col gap-3">
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sd-soft">
                  {it.image_url && (
                    <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] text-sd-ink">{it.title}</p>
                  <p className="truncate text-[12.5px] text-sd-ink-muted">
                    {[it.variant_label, `Qty ${it.quantity}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="text-[14.5px] tabular-nums text-sd-ink">
                  {nairaFromKobo(it.unit_price_kobo * it.quantity)}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Payment">
          <Row label="Items" value={nairaFromKobo(order.itemsKobo)} />
          <Row
            label={`Delivery${order.courierName ? ` · ${order.courierName}` : ""}`}
            value={nairaFromKobo(order.deliveryKobo)}
          />
          {order.platformFeeKobo > 0 && (
            <Row label="Oakmonte fee" value={`−${nairaFromKobo(order.platformFeeKobo)}`} />
          )}
          <div className="mt-2 flex justify-between border-t border-sd-line pt-3 text-[15px] font-semibold text-sd-ink">
            <span>Paid by the buyer</span>
            <span className="tabular-nums">{nairaFromKobo(order.totalKobo)}</span>
          </div>
          <p className="mt-2 text-[12.5px] text-sd-ink-muted">{paymentLine(order)}</p>
        </Section>

        <Section title="Deliver to">
          <p className="text-[15px] font-semibold text-sd-ink">{order.shipTo.name || "—"}</p>
          {order.shipTo.address && (
            <p className="mt-0.5 text-[14px] leading-relaxed text-sd-ink-muted">
              {order.shipTo.address}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {order.shipTo.phone && (
              <a
                href={`tel:${order.shipTo.phone.replace(/[^\d+]/g, "")}`}
                className="oak-tap flex h-10 items-center gap-1.5 rounded-full bg-sd-soft px-4 text-[13.5px] font-medium text-sd-ink"
              >
                <Phone size={15} />
                {order.shipTo.phone}
              </a>
            )}
            {order.shipTo.address && <CopyButton text={order.shipTo.address} />}
            {order.buyerUsername && (
              <Link
                to="/messages"
                search={{ to: order.buyerUsername }}
                className="oak-tap flex h-10 items-center gap-1.5 rounded-full bg-sd-soft px-4 text-[13.5px] font-medium text-sd-ink"
              >
                <MessageCircle size={15} />
                Message buyer
              </Link>
            )}
          </div>
          {order.isGuest && (
            <p className="mt-3 text-[12.5px] text-sd-ink-muted">
              Checked out as a guest, so there's no Oakmonte account to message. Call or text the
              number above.
            </p>
          )}
        </Section>

        {(order.courierName || order.shipbubbleOrderId) && (
          <Section title="Delivery">
            {order.courierName && <Row label="Courier" value={order.courierName} />}
            {order.shipbubbleOrderId && <Row label="Shipment" value={order.shipbubbleOrderId} />}
            {!order.shipbubbleOrderId && order.status === "paid" && (
              <p className="mt-1 text-[12.5px] text-sd-ink-muted">
                The buyer picked this courier at checkout. Booking uses the same quote.
              </p>
            )}
          </Section>
        )}
      </div>

      {actions && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sd-line bg-sd-surface/95 px-4 pt-3 backdrop-blur oak-safe-bottom">
          {actionError && (
            <p className="mb-2 text-center text-[13px] text-sd-danger-ink">{actionError}</p>
          )}
          {order.shipBlockedReason && (
            <p className="mb-2 text-center text-[13px] text-sd-ink-muted">
              {order.shipBlockedReason}
            </p>
          )}
          <div className="flex gap-2">
            {order.canDecline && (
              <button
                type="button"
                onClick={() => {
                  setActionError("");
                  setDeclineOpen(true);
                }}
                disabled={shipping}
                className="oak-tap h-12 shrink-0 rounded-full border border-sd-line px-5 text-[15px] font-semibold text-sd-danger-ink oak-motion-control active:scale-[0.98] disabled:opacity-50"
              >
                Decline
              </button>
            )}
            <button
              type="button"
              onClick={() => void ship()}
              disabled={!order.canShip || shipping}
              className="oak-tap h-12 min-w-0 flex-1 rounded-full bg-sd-ink text-[15px] font-semibold text-sd-bg oak-motion-control active:scale-[0.98] disabled:opacity-40"
            >
              {shipping ? "Booking courier…" : "Book courier and ship"}
            </button>
          </div>
        </div>
      )}

      {declineOpen && order.declineRefund && (
        <DeclineOrderSheet
          totalKobo={order.payment?.amountKobo ?? order.totalKobo}
          itemCount={itemCount}
          refundMode={order.declineRefund}
          onConfirm={decline}
          onClose={closeDecline}
        />
      )}
    </div>
  );
}

function paymentLine(order: Detail): string {
  const p = order.payment;
  if (!p) return "No payment on record.";
  const via = p.method === "paystack" ? "Paystack" : "bank transfer";
  switch (p.status) {
    case "confirmed":
      return `Paid with ${via}${p.confirmedAt ? ` · ${formatOrderTime(p.confirmedAt)}` : ""}.`;
    case "refunded":
      return `Paid with ${via}, then refunded to the buyer.`;
    case "failed":
      return "The payment failed.";
    default:
      return "Not paid yet.";
  }
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-sd-line bg-sd-surface p-4">
      {title && <h2 className="mb-3 text-[13px] font-semibold text-sd-ink-muted">{title}</h2>}
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[14px]">
      <span className="min-w-0 truncate text-sd-ink-muted">{label}</span>
      <span className="shrink-0 tabular-nums text-sd-ink">{value}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  // Clipboard access can be refused (permissions, an in-app browser); only
  // claim "Copied" when it actually worked.
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="oak-tap flex h-10 items-center gap-1.5 rounded-full bg-sd-soft px-4 text-[13.5px] font-medium text-sd-ink"
    >
      <Copy size={15} />
      {copied ? "Copied" : "Copy address"}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4" aria-label="Loading order">
      {[120, 180, 140].map((h, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-sd-line bg-sd-soft"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}
