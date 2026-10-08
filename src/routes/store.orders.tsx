import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Ban, ChevronRight, PackageCheck, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import { ComingSoonState } from "@/components/store/ComingSoonState";
import { RefundChip, StatusChip } from "@/components/orders/order-ui";
import { authedFetch } from "@/lib/authed-fetch";
import { formatOrderTime, nairaFromKobo } from "@/lib/order-format";
import {
  orderRef,
  parseSellerTab,
  SELLER_TABS,
  type RefundState,
  type SellerTab,
} from "@/lib/order-status";

export const Route = createFileRoute("/store/orders")({
  // The tab lives in the URL so coming back from an order lands on the tab it
  // was opened from. The default tab is left out of the URL entirely.
  validateSearch: (s: Record<string, unknown>): { tab?: SellerTab } => {
    const tab = parseSellerTab(s.tab);
    return { tab: tab === "to_ship" ? undefined : tab };
  },
  component: OrdersPage,
});

type StoreOrder = {
  id: string;
  status: string;
  total_kobo: number;
  ship_to: { name?: string; phone?: string; address?: string } | null;
  courier_name: string | null;
  tracking_url: string | null;
  shipbubble_order_id: string | null;
  created_at: string;
  refund: RefundState;
  items: {
    title: string;
    variant_label: string | null;
    image_url: string | null;
    quantity: number;
  }[];
};

type TabData = { orders: StoreOrder[]; nextBefore: string | null };

const EMPTY: Record<SellerTab, { icon: LucideIcon; title: string; description: string }> = {
  to_ship: {
    icon: ShoppingBag,
    title: "Nothing to ship",
    description: "Paid orders land here, ready for you to book a courier.",
  },
  shipped: {
    icon: Truck,
    title: "Nothing on the road",
    description: "Orders you've handed to a courier stay here until they arrive.",
  },
  delivered: {
    icon: PackageCheck,
    title: "No deliveries yet",
    description: "Orders move here once the courier confirms they've arrived.",
  },
  closed: {
    icon: Ban,
    title: "Nothing cancelled",
    description: "Orders you decline show here, with where the buyer's refund stands.",
  },
};

function OrdersPage() {
  const navigate = useNavigate();
  const tab = Route.useSearch().tab ?? "to_ship";
  const [data, setData] = useState<Partial<Record<SellerTab, TabData>>>({});
  const [loadError, setLoadError] = useState<Partial<Record<SellerTab, string>>>({});
  const [toShipCount, setToShipCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [shipError, setShipError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(async (which: SellerTab, before?: string) => {
    const qs = new URLSearchParams({ tab: which });
    if (before) qs.set("before", before);
    try {
      const res = await authedFetch(`/api/store/orders?${qs.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as TabData & { toShipCount: number };
      setToShipCount(body.toShipCount);
      setData((prev) => ({
        ...prev,
        [which]: {
          orders: before ? [...(prev[which]?.orders ?? []), ...body.orders] : body.orders,
          nextBefore: body.nextBefore,
        },
      }));
      setLoadError((prev) => ({ ...prev, [which]: undefined }));
    } catch {
      setLoadError((prev) => ({ ...prev, [which]: "Couldn't load orders." }));
    }
  }, []);

  // Refetch on every visit to a tab: what's cached shows straight away, and the
  // fresh list replaces it (an order may have shipped or been delivered since).
  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  function selectTab(next: SellerTab) {
    if (next === tab) return;
    setShipError(null);
    void navigate({
      to: "/store/orders",
      search: next === "to_ship" ? {} : { tab: next },
      replace: true,
    });
  }

  async function loadMore() {
    const before = data[tab]?.nextBefore;
    if (!before || loadingMore) return;
    setLoadingMore(true);
    await load(tab, before);
    setLoadingMore(false);
  }

  async function ship(id: string) {
    setShipError(null);
    setBusy(id);
    try {
      const res = await authedFetch(`/api/store/orders/${id}/ship`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setShipError({ id, message: body?.error ?? "Couldn't book the courier." });
        return;
      }
      // It's in Shipped now; drop that tab's cache so it refetches on visit.
      setData((prev) => ({ ...prev, shipped: undefined }));
      await load("to_ship");
    } catch {
      setShipError({ id, message: "Couldn't reach Oakmonte. Check your connection." });
    } finally {
      setBusy(null);
    }
  }

  const current = data[tab];
  const error = loadError[tab];
  const activeIndex = SELLER_TABS.findIndex((t) => t.key === tab);

  return (
    <div className="pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      <h1 className="sd-editorial px-4 text-[26px] leading-[1.1] tracking-[-0.02em] text-sd-ink">
        Orders
      </h1>

      <div
        role="tablist"
        aria-label="Order status"
        className="sticky top-14 z-20 mt-3 flex border-b border-sd-line bg-sd-bg px-2"
      >
        <span
          aria-hidden
          className="absolute bottom-0 left-2 h-[2.5px] rounded-full bg-sd-ink transition-transform duration-300 ease-[var(--ease-smooth-out)]"
          style={{
            width: `calc((100% - 1rem) / ${SELLER_TABS.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
        {SELLER_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.key)}
              className={`oak-tap flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 text-[14px] transition-colors duration-200 ${
                active ? "font-semibold text-sd-ink" : "font-medium text-sd-ink-muted"
              }`}
            >
              <span className="truncate">{t.label}</span>
              {t.key === "to_ship" && !!toShipCount && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sd-ink px-1.5 text-[11px] font-bold tabular-nums text-sd-bg">
                  {toShipCount > 99 ? "99+" : toShipCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-4">
        {current === undefined && error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-[14px] text-sd-ink-muted">{error}</p>
            <button
              type="button"
              onClick={() => void load(tab)}
              className="oak-tap h-11 rounded-full bg-sd-soft px-6 text-[14px] font-semibold text-sd-ink oak-motion-control active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
        ) : current === undefined ? (
          <ListSkeleton />
        ) : current.orders.length === 0 ? (
          <ComingSoonState {...EMPTY[tab]} />
        ) : (
          <>
            <ul className="flex flex-col gap-3 animate-in fade-in duration-300">
              {current.orders.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  busy={busy === o.id}
                  shipError={shipError?.id === o.id ? shipError.message : null}
                  onShip={() => void ship(o.id)}
                />
              ))}
            </ul>
            {current.nextBefore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="oak-tap mt-4 h-11 w-full rounded-full border border-sd-line text-[14px] font-medium text-sd-ink oak-motion-control active:scale-[0.99] disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Show older orders"}
              </button>
            )}
            {error && <p className="mt-3 text-center text-[13px] text-sd-danger-ink">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function OrderCard({
  order: o,
  busy,
  shipError,
  onShip,
}: {
  order: StoreOrder;
  busy: boolean;
  shipError: string | null;
  onShip: () => void;
}) {
  const shown = o.items.slice(0, 2);
  const more = o.items.length - shown.length;
  const canShip = o.status === "paid" && !o.shipbubble_order_id;
  return (
    <li className="overflow-hidden rounded-2xl border border-sd-line bg-sd-surface">
      <Link
        to="/store/orders/$orderId"
        params={{ orderId: o.id }}
        className="block p-4 oak-motion-control active:bg-sd-soft"
      >
        <div className="flex items-center gap-2">
          <StatusChip status={o.status} side="seller" />
          <RefundChip refund={o.refund} side="seller" />
          <span className="ml-auto text-[15px] font-semibold tabular-nums text-sd-ink">
            {nairaFromKobo(o.total_kobo)}
          </span>
          <ChevronRight size={18} className="-mr-1 shrink-0 text-sd-ink-faint" />
        </div>
        <p className="mt-1.5 text-[12.5px] text-sd-ink-muted">
          {orderRef(o.id)} · {formatOrderTime(o.created_at)}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {shown.map((it, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-sd-soft">
                {it.image_url && (
                  <img
                    src={it.image_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-sd-ink">{it.title}</p>
                <p className="truncate text-[12px] text-sd-ink-muted">
                  {[it.variant_label, `Qty ${it.quantity}`].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          ))}
          {more > 0 && (
            <p className="text-[12.5px] text-sd-ink-muted">
              +{more} more item{more === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {o.ship_to?.name && (
          <p className="mt-3 truncate text-[13px] text-sd-ink-muted">
            <span className="text-sd-ink">{o.ship_to.name}</span>
            {o.ship_to.address ? ` · ${o.ship_to.address}` : ""}
          </p>
        )}
      </Link>

      {canShip && (
        <div className="border-t border-sd-line px-4 py-3">
          {shipError && <p className="mb-2 text-[13px] text-sd-danger-ink">{shipError}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={onShip}
            className="oak-tap h-11 w-full rounded-full bg-sd-ink text-[14px] font-semibold text-sd-bg oak-motion-control active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Booking courier…" : "Book courier and ship"}
          </button>
        </div>
      )}
      {o.tracking_url && (
        <div className="border-t border-sd-line px-4">
          <a
            href={o.tracking_url}
            target="_blank"
            rel="noreferrer"
            className="flex h-11 items-center text-[13px] font-medium text-sd-ink underline underline-offset-2"
          >
            Track delivery{o.courier_name ? ` with ${o.courier_name}` : ""}
          </a>
        </div>
      )}
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-label="Loading orders">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-sd-line bg-sd-surface p-4">
          <div className="flex items-center justify-between">
            <span className="h-6 w-16 animate-pulse rounded-full bg-sd-soft" />
            <span className="h-4 w-20 animate-pulse rounded bg-sd-soft" />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="h-12 w-12 animate-pulse rounded-xl bg-sd-soft" />
            <div className="flex flex-1 flex-col gap-2">
              <span className="h-3.5 w-3/4 animate-pulse rounded bg-sd-soft" />
              <span className="h-3 w-1/3 animate-pulse rounded bg-sd-soft" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
