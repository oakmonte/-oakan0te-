import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authedFetch } from "@/lib/authed-fetch";

export const Route = createFileRoute("/order/$orderId")({
  validateSearch: (s: Record<string, unknown>): { t?: string } => ({
    t: typeof s.t === "string" && s.t ? s.t : undefined,
  }),
  head: () => ({ meta: [{ title: "Your order — Oakmonte" }] }),
  component: OrderPage,
});

type OrderView = {
  id: string;
  status: string;
  itemsKobo: number;
  deliveryKobo: number;
  totalKobo: number;
  courierName: string | null;
  trackingUrl: string | null;
  storeName: string | null;
  shipTo: { name: string; address: string };
  items: {
    title: string;
    variant_label: string | null;
    image_url: string | null;
    unit_price_kobo: number;
    quantity: number;
  }[];
};

const STATUS: Record<string, { label: string; note: string }> = {
  awaiting_payment: {
    label: "Waiting for payment",
    note: "We haven't received your payment yet. If you've just paid, this updates in a moment.",
  },
  paid: {
    label: "Paid",
    note: "Payment received. The seller is getting your order ready to ship.",
  },
  shipped: { label: "On its way", note: "Your order has been handed to the courier." },
  delivered: { label: "Delivered", note: "Your order has arrived." },
  declined: {
    label: "Declined",
    note: "The seller couldn't fulfil this order. Any payment is refunded.",
  },
  cancelled: { label: "Cancelled", note: "This order was cancelled." },
};

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;

function OrderPage() {
  const { orderId } = Route.useParams();
  const { t } = Route.useSearch();
  const [order, setOrder] = useState<OrderView | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    async function load() {
      const res = await authedFetch(
        `/api/orders/${orderId}${t ? `?t=${encodeURIComponent(t)}` : ""}`,
      );
      const body = res.ok ? ((await res.json()) as OrderView) : null;
      if (cancelled) return;
      setOrder(body);
      // Right after paying, the status can lag a few seconds behind Paystack.
      if (body?.status === "awaiting_payment" && tries++ < 6) setTimeout(() => void load(), 4000);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, t]);

  const status = order ? (STATUS[order.status] ?? { label: order.status, note: "" }) : null;

  return (
    <div
      className="min-h-screen bg-black pb-[calc(env(safe-area-inset-bottom)+2rem)] text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-[520px] px-4 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <h1 className="text-[22px] font-semibold">Your order</h1>
        {order === undefined && <p className="mt-6 text-white/60">Loading…</p>}
        {order === null && (
          <p className="mt-6 text-white/60">
            We couldn&apos;t find this order. Open the link we gave you at checkout.
          </p>
        )}
        {order && status && (
          <div className="mt-5 flex flex-col gap-4">
            <div className="rounded-2xl bg-white/[0.06] p-4">
              <p className="text-[17px] font-semibold">{status.label}</p>
              <p className="mt-1 text-[14px] text-white/60">{status.note}</p>
              {order.trackingUrl && (
                <a
                  href={order.trackingUrl}
                  className="mt-3 inline-block text-[14px] underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Track your delivery
                </a>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.06] p-4">
              {order.storeName && (
                <p className="text-[13px] text-white/50">From {order.storeName}</p>
              )}
              {order.items.map((it, i) => (
                <div key={i} className="flex items-center gap-3">
                  {it.image_url && (
                    <img src={it.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px]">{it.title}</p>
                    {it.variant_label && (
                      <p className="text-[13px] text-white/55">{it.variant_label}</p>
                    )}
                  </div>
                  <p className="text-[15px]">{naira(it.unit_price_kobo)}</p>
                </div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-3 text-[14px] text-white/70">
                <span>Delivery{order.courierName ? ` (${order.courierName})` : ""}</span>
                <span>{naira(order.deliveryKobo)}</span>
              </div>
              <div className="flex justify-between text-[16px] font-semibold">
                <span>Total</span>
                <span>{naira(order.totalKobo)}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.06] p-4 text-[14px]">
              <p className="font-medium">Delivering to</p>
              <p className="mt-1 text-white/70">{order.shipTo.name}</p>
              <p className="text-white/70">{order.shipTo.address}</p>
            </div>

            <p className="text-[13px] text-white/45">
              Save this page&apos;s link to check your order again.
            </p>
            <Link to="/home" className="text-[14px] text-white/70 underline">
              Back to Oakmonte
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
