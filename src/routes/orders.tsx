import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Package } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { RefundChip, StatusChip } from "@/components/orders/order-ui";
import { useSession } from "@/hooks/use-session";
import { authedFetch } from "@/lib/authed-fetch";
import { formatOrderTime, nairaFromKobo } from "@/lib/order-format";
import type { RefundState } from "@/lib/order-status";

// The signed-in buyer's order history. Guest orders aren't tied to an account,
// so they can't be listed -- a guest gets back to theirs through the link from
// checkout, and the signed-out state below says exactly that.
export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Your orders — Oakmonte" }] }),
  component: OrdersPage,
});

type MyOrder = {
  id: string;
  status: string;
  totalKobo: number;
  createdAt: string;
  storeName: string | null;
  itemCount: number;
  firstItem: { title: string; variantLabel: string | null; imageUrl: string | null } | null;
  refund: RefundState;
};

function OrdersPage() {
  const { user, loading: sessionLoading } = useSession();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (before?: string) => {
    try {
      const res = await authedFetch(
        `/api/orders/mine${before ? `?before=${encodeURIComponent(before)}` : ""}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { orders: MyOrder[]; nextBefore: string | null };
      setOrders((prev) => (before ? [...(prev ?? []), ...body.orders] : body.orders));
      setNextBefore(body.nextBefore);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    await load(nextBefore);
    setLoadingMore(false);
  }

  const signedOut = !sessionLoading && !user;

  return (
    <div className="min-h-dvh bg-chat-bg pb-[calc(env(safe-area-inset-bottom)+2rem)] text-chat-text">
      <div className="mx-auto w-full max-w-[560px]">
        <header className="sticky top-0 z-20 bg-chat-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-14 items-center gap-1 px-4">
            <BackButton className="-ml-2.5 grid h-11 w-11 place-items-center rounded-full active:bg-chat-text/10" />
            <h1 className="text-[22px] font-bold tracking-[-0.02em]">Your orders</h1>
          </div>
        </header>

        {signedOut ? (
          <div className="flex flex-col items-center px-8 pt-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-chat-soft">
              <Package size={28} className="text-chat-muted" />
            </span>
            <p className="mt-5 text-[20px] font-bold">Your orders live here</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-chat-muted">
              Sign in to see the orders you&apos;ve placed and where each one is.
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-chat-muted">
              Checked out as a guest? Guest orders aren&apos;t tied to an account. Open the order
              link you were given at checkout to see yours.
            </p>
            <Link
              to="/sign-in"
              className="mt-6 flex h-12 items-center rounded-full bg-chat-text px-8 text-[16px] font-semibold text-chat-inverse active:scale-[0.98]"
            >
              Sign in
            </Link>
          </div>
        ) : orders === null && error ? (
          <div className="flex flex-col items-center gap-3 px-8 pt-16 text-center">
            <p className="text-[15px] text-chat-muted">Couldn&apos;t load your orders.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="h-11 rounded-full bg-chat-soft px-6 text-[14px] font-semibold text-chat-text active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
        ) : orders === null ? (
          <ListSkeleton />
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center px-8 pt-16 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-chat-soft">
              <Package size={28} className="text-chat-muted" />
            </span>
            <p className="mt-5 text-[20px] font-bold">No orders yet</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-chat-muted">
              Pieces you buy show up here, with where each delivery is.
            </p>
            <Link
              to="/home"
              className="mt-6 flex h-12 items-center rounded-full bg-chat-text px-8 text-[16px] font-semibold text-chat-inverse active:scale-[0.98]"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex flex-col px-4 pt-2 animate-in fade-in duration-300">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    to="/order/$orderId"
                    params={{ orderId: o.id }}
                    search={{}}
                    className="flex items-center gap-3 border-b border-chat-border py-3.5 active:opacity-70"
                  >
                    <span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-chat-soft">
                      {o.firstItem?.imageUrl && (
                        <img
                          src={o.firstItem.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      {o.storeName && (
                        <p className="truncate text-[12.5px] text-chat-muted">{o.storeName}</p>
                      )}
                      <p className="truncate text-[15px] font-semibold">
                        {o.firstItem?.title ?? "Order"}
                        {o.itemCount > 1 && (
                          <span className="font-normal text-chat-muted">
                            {" "}
                            + {o.itemCount - 1} more
                          </span>
                        )}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusChip status={o.status} side="buyer" />
                        <RefundChip refund={o.refund} side="buyer" />
                        <span className="text-[12.5px] text-chat-muted">
                          {formatOrderTime(o.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="text-[14.5px] font-semibold tabular-nums">
                        {nairaFromKobo(o.totalKobo)}
                      </span>
                      <ChevronRight size={18} className="text-chat-faint" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {nextBefore && (
              <div className="px-4 pt-4">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="h-11 w-full rounded-full bg-chat-soft text-[14px] font-semibold text-chat-text active:scale-[0.99] disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Show older orders"}
                </button>
              </div>
            )}
            {error && (
              <p className="px-4 pt-3 text-center text-[13px] text-chat-danger">
                Couldn&apos;t load more orders. Try again.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col px-4 pt-2" aria-label="Loading your orders">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-chat-border py-3.5">
          <span className="h-16 w-16 animate-pulse rounded-2xl bg-chat-soft" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-1/4 animate-pulse rounded bg-chat-soft" />
            <span className="h-3.5 w-2/3 animate-pulse rounded bg-chat-soft" />
            <span className="h-5 w-24 animate-pulse rounded-full bg-chat-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}
