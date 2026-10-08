import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { OrderTimeline, StatusChip } from "@/components/orders/order-ui";
import { useSession } from "@/hooks/use-session";
import { authedFetch } from "@/lib/authed-fetch";
import { formatOrderTime, nairaFromKobo } from "@/lib/order-format";
import { orderRef, type RefundState, type TimelineStep } from "@/lib/order-status";

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
  sellerUsername: string | null;
  shipTo: { name: string; address: string };
  items: {
    title: string;
    variant_label: string | null;
    image_url: string | null;
    unit_price_kobo: number;
    quantity: number;
  }[];
  createdAt: string;
  declineReason: string | null;
  refund: RefundState;
  refundKobo: number;
  timeline: TimelineStep[];
  viewerIsBuyer: boolean;
};

const STATUS: Record<string, { title: string; note: string }> = {
  awaiting_payment: {
    title: "Waiting for payment",
    note: "We haven't received your payment yet. If you've just paid, this updates in a moment.",
  },
  awaiting_acceptance: {
    title: "Waiting for payment",
    note: "We haven't received your payment yet. If you've just paid, this updates in a moment.",
  },
  paid: {
    title: "Payment received",
    note: "The seller is getting your order ready to hand to the courier.",
  },
  shipped: { title: "On its way", note: "Your order is with the courier." },
  delivered: { title: "Delivered", note: "Your order has arrived. Enjoy it." },
  declined: { title: "Declined", note: "The seller couldn't fulfil this order." },
  cancelled: { title: "Cancelled", note: "This order was cancelled." },
};

function OrderPage() {
  const { orderId } = Route.useParams();
  const { t } = Route.useSearch();
  const { user, loading: sessionLoading } = useSession();
  // undefined = loading, null = not found (or not theirs).
  const [order, setOrder] = useState<OrderView | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Waits for the session: a signed-in buyer opening their order without the
  // guest token is only recognised once their access token is attached, and
  // asking before that would flash "not found" at them.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const res = await authedFetch(
          `/api/orders/${orderId}${t ? `?t=${encodeURIComponent(t)}` : ""}`,
        );
        if (cancelled) return;
        if (res.status === 404) {
          setOrder(null);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as OrderView;
        if (cancelled) return;
        setOrder(body);
        setFailed(false);
        // Right after paying, the status can lag a few seconds behind Paystack.
        if (body.status === "awaiting_payment" && tries++ < 6) {
          timer = setTimeout(() => void load(), 4000);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, t, userId, sessionLoading, attempt]);

  const status = order ? (STATUS[order.status] ?? { title: order.status, note: "" }) : null;

  return (
    <div className="min-h-dvh bg-chat-bg pb-[calc(env(safe-area-inset-bottom)+2rem)] text-chat-text">
      <div className="mx-auto w-full max-w-[560px]">
        <header className="sticky top-0 z-20 bg-chat-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-14 items-center gap-1 px-4">
            <BackButton
              // A signed-in buyer came from (or belongs in) their order list;
              // a guest arriving from the checkout link goes to the feed.
              to={order?.viewerIsBuyer ? { to: "/orders" } : undefined}
              className="-ml-2.5 grid h-11 w-11 place-items-center rounded-full active:bg-chat-text/10"
            />
            <h1 className="text-[22px] font-bold tracking-[-0.02em]">Your order</h1>
            {order && (
              <span className="ml-auto text-[13px] tabular-nums text-chat-muted">
                {orderRef(order.id)}
              </span>
            )}
          </div>
        </header>

        <div className="px-4 pt-2">
          {order === undefined && failed && (
            <div className="flex flex-col items-center gap-3 pt-16 text-center">
              <p className="text-[15px] text-chat-muted">Couldn&apos;t load this order.</p>
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  setAttempt((n) => n + 1);
                }}
                className="h-11 rounded-full bg-chat-soft px-6 text-[14px] font-semibold active:scale-[0.98]"
              >
                Try again
              </button>
            </div>
          )}
          {order === undefined && !failed && <PageSkeleton />}
          {order === null && (
            <div className="flex flex-col items-center pt-16 text-center">
              <p className="text-[18px] font-bold">We couldn&apos;t find this order</p>
              <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-chat-muted">
                {user
                  ? "It isn't on your account. If you checked out as a guest, open the link you were given at checkout."
                  : "Open the link you were given at checkout, or sign in if you placed it with your account."}
              </p>
              {user ? (
                <Link
                  to="/orders"
                  className="mt-6 flex h-12 items-center rounded-full bg-chat-text px-8 text-[16px] font-semibold text-chat-inverse"
                >
                  See your orders
                </Link>
              ) : (
                <Link
                  to="/sign-in"
                  className="mt-6 flex h-12 items-center rounded-full bg-chat-text px-8 text-[16px] font-semibold text-chat-inverse"
                >
                  Sign in
                </Link>
              )}
            </div>
          )}

          {order && status && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-300">
              <Card>
                <div className="flex items-center gap-2">
                  <StatusChip status={order.status} side="buyer" />
                  <span className="text-[12.5px] text-chat-muted">
                    Placed {formatOrderTime(order.createdAt)}
                  </span>
                </div>
                <p className="mt-3 text-[22px] font-bold leading-tight tracking-[-0.01em]">
                  {status.title}
                </p>
                {status.note && (
                  <p className="mt-1 text-[14px] leading-relaxed text-chat-muted">{status.note}</p>
                )}
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex h-11 items-center justify-center rounded-full bg-chat-text text-[15px] font-semibold text-chat-inverse active:scale-[0.98]"
                  >
                    Track your delivery
                  </a>
                )}
              </Card>

              {order.declineReason && (
                <Card title="The seller's reason">
                  <p className="text-[15px] leading-relaxed">{order.declineReason}</p>
                </Card>
              )}

              {order.refund !== "none" && (
                <Card title="Your refund">
                  <p className="text-[15px] font-semibold">
                    {order.refund === "refunded"
                      ? `${nairaFromKobo(order.refundKobo)} refund started`
                      : `${nairaFromKobo(order.refundKobo)} to be refunded`}
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-chat-muted">
                    {order.refund === "refunded"
                      ? "It goes back to the card or account you paid with. Banks can take a few working days to show it."
                      : "Oakmonte is sending it back to you by hand. If it hasn't arrived in a few working days, message us from Messages and mention this order's number."}
                  </p>
                </Card>
              )}

              <Card title="Progress">
                <OrderTimeline steps={order.timeline} side="buyer" />
              </Card>

              <Card>
                {order.storeName && (
                  <p className="mb-3 text-[13px] text-chat-muted">From {order.storeName}</p>
                )}
                <div className="flex flex-col gap-3">
                  {order.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-chat-soft">
                        {it.image_url && (
                          <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px]">{it.title}</p>
                        <p className="truncate text-[13px] text-chat-muted">
                          {[it.variant_label, it.quantity > 1 ? `Qty ${it.quantity}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <p className="text-[15px] tabular-nums">
                        {nairaFromKobo(it.unit_price_kobo * it.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t border-chat-border pt-3 text-[14px] text-chat-muted">
                  <span>Delivery{order.courierName ? ` (${order.courierName})` : ""}</span>
                  <span className="tabular-nums">{nairaFromKobo(order.deliveryKobo)}</span>
                </div>
                <div className="mt-1.5 flex justify-between text-[16px] font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{nairaFromKobo(order.totalKobo)}</span>
                </div>
              </Card>

              <Card title="Delivering to">
                <p className="text-[15px]">{order.shipTo.name}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-chat-muted">
                  {order.shipTo.address}
                </p>
              </Card>

              <Card title="Need help with this order?">
                <p className="text-[14px] leading-relaxed text-chat-muted">
                  Message {order.storeName ?? "the seller"} and mention {orderRef(order.id)}.
                </p>
                {user && order.sellerUsername ? (
                  <Link
                    to="/messages"
                    search={{ to: order.sellerUsername }}
                    className="mt-3 flex h-11 items-center justify-center gap-2 rounded-full bg-chat-soft text-[15px] font-semibold active:scale-[0.98]"
                  >
                    <MessageCircle size={17} />
                    Message the seller
                  </Link>
                ) : user ? (
                  <Link
                    to="/messages"
                    className="mt-3 flex h-11 items-center justify-center gap-2 rounded-full bg-chat-soft text-[15px] font-semibold active:scale-[0.98]"
                  >
                    <MessageCircle size={17} />
                    Message Oakmonte
                  </Link>
                ) : (
                  <Link
                    to="/sign-in"
                    className="mt-3 flex h-11 items-center justify-center rounded-full bg-chat-soft text-[15px] font-semibold active:scale-[0.98]"
                  >
                    Sign in to message the seller
                  </Link>
                )}
              </Card>

              {order.viewerIsBuyer ? (
                <Link
                  to="/orders"
                  className="flex h-11 items-center justify-center text-[14px] text-chat-muted underline underline-offset-2"
                >
                  All your orders
                </Link>
              ) : (
                <p className="px-1 text-[13px] leading-relaxed text-chat-faint">
                  Save this page&apos;s link to check your order again. Guest orders aren&apos;t
                  listed anywhere else.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] bg-chat-surface p-4">
      {title && <h2 className="mb-3 text-[13px] font-semibold text-chat-muted">{title}</h2>}
      {children}
    </section>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading your order">
      {[132, 176, 150].map((h, i) => (
        <div
          key={i}
          className="animate-pulse rounded-[20px] bg-chat-surface"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}
