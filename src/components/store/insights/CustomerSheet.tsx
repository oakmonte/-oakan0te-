import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { InsightsError, useStoreInsights } from "@/hooks/use-store-insights";
import {
  formatDate,
  formatKobo,
  type CustomerDetailResponse,
  type CustomerOrder,
  type CustomerRow,
} from "@/lib/insights";
import { ListSkeleton, LoadError, Stat, Thumb } from "./parts";

const STATUS: Record<string, string> = {
  paid: "To ship",
  shipped: "Shipped",
  delivered: "Delivered",
};

export function CustomerAvatar({
  customer,
  size = 40,
}: {
  customer: Pick<CustomerRow, "avatarUrl" | "name" | "username">;
  size?: number;
}) {
  const initial = (customer.name ?? customer.username ?? "").trim().charAt(0).toUpperCase();
  return customer.avatarUrl ? (
    <img
      src={customer.avatarUrl}
      alt=""
      loading="lazy"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-sd-soft object-cover"
    />
  ) : (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      className="grid shrink-0 place-items-center rounded-full bg-sd-soft font-semibold text-sd-ink-muted"
    >
      {initial || "?"}
    </span>
  );
}

/** One customer, full screen: how to reach them and everything they have
 *  bought here. Opened over the list with its own history entry (the caller's
 *  useOverlayHistory), so the back swipe closes it instead of leaving
 *  Customers. */
export function CustomerSheet({
  storeId,
  customerKey,
  onClose,
}: {
  storeId: string;
  customerKey: string;
  onClose: () => void;
}) {
  useBodyScrollLock(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { data, isPending, error, refetch } = useStoreInsights<CustomerDetailResponse>(
    storeId,
    `customers/${customerKey}`,
  );

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const c = data?.customer;
  const notFound = error instanceof InsightsError && error.status === 404;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-sheet-title"
      className="fixed inset-0 z-50 flex flex-col bg-sd-bg pt-[env(safe-area-inset-top)] animate-in fade-in slide-in-from-bottom-6 duration-300"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sd-line bg-sd-surface px-2">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-11 w-11 place-items-center rounded-full oak-motion-control active:scale-90"
        >
          <X size={20} className="text-sd-ink" />
        </button>
        <h2
          id="customer-sheet-title"
          className="min-w-0 flex-1 truncate pr-12 text-center text-[15px] font-semibold text-sd-ink"
        >
          {c?.name ?? "Customer"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-5">
        {isPending ? (
          <>
            <span className="sr-only" role="status">
              Loading customer
            </span>
            <ListSkeleton rows={4} />
          </>
        ) : notFound ? (
          <p className="py-10 text-center text-[14px] text-sd-ink-muted">
            This customer isn&apos;t in your store&apos;s orders any more.
          </p>
        ) : !c || !data ? (
          <LoadError message="Couldn't load this customer" onRetry={() => void refetch()} />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3.5">
              <CustomerAvatar customer={c} size={56} />
              <div className="min-w-0">
                <p className="sd-editorial truncate text-[22px] leading-tight text-sd-ink">
                  {c.name ?? (c.username ? `@${c.username}` : "Unnamed buyer")}
                </p>
                {c.username ? (
                  <Link
                    to="/profile/$username"
                    params={{ username: c.username }}
                    className="mt-0.5 inline-block text-[13px] font-medium text-sd-accent-ink"
                  >
                    @{c.username}
                  </Link>
                ) : (
                  <p className="mt-0.5 text-[13px] text-sd-ink-muted">
                    {c.isAccount ? "Oakmonte account" : "Checked out as a guest"}
                  </p>
                )}
              </div>
            </div>

            <ContactActions phone={c.phone} whatsapp={c.whatsapp} email={c.email} />

            {(c.phone || c.address || c.email) && (
              <dl className="flex flex-col gap-2 rounded-2xl border border-sd-line bg-sd-surface p-4 text-[14px]">
                {c.phone && <Detail label="Phone" value={c.phone} />}
                {c.email && <Detail label="Email" value={c.email} />}
                {c.address && <Detail label="Last delivery address" value={c.address} />}
              </dl>
            )}

            <div className="grid grid-cols-3 gap-2">
              <Stat label="Orders" value={c.orders} />
              <Stat label="Spent" value={formatKobo(c.totalKobo)} />
              <Stat label="Since" value={formatDate(c.firstOrderAt)} />
            </div>

            <section aria-labelledby="customer-orders">
              <h3
                id="customer-orders"
                className="text-[17px] font-semibold tracking-[-0.02em] text-sd-ink"
              >
                Orders
              </h3>
              <div className="mt-3 flex flex-col gap-3">
                {data.orders.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
              {data.moreOrders > 0 && (
                <p className="mt-3 text-[13px] text-sd-ink-muted">
                  And {data.moreOrders} earlier {data.moreOrders === 1 ? "order" : "orders"}.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-sd-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sd-ink">{value}</dd>
    </div>
  );
}

function ContactActions({
  phone,
  whatsapp,
  email,
}: {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}) {
  const cls =
    "oak-tap flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-sd-line bg-sd-surface text-[14px] font-semibold text-sd-ink oak-motion-control active:scale-[0.97]";
  if (!phone && !email) return null;
  return (
    <div className="flex gap-2">
      {phone && (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={cls}>
          <Phone size={16} /> Call
        </a>
      )}
      {whatsapp && (
        <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className={cls}>
          <MessageCircle size={16} /> WhatsApp
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={cls}>
          <Mail size={16} /> Email
        </a>
      )}
    </div>
  );
}

function OrderCard({ order: o }: { order: CustomerOrder }) {
  return (
    <div className="rounded-2xl border border-sd-line bg-sd-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-sd-ink-muted">{formatDate(o.created_at)}</span>
        <span className="rounded-full bg-sd-soft px-2.5 py-1 text-[12px] font-semibold text-sd-ink">
          {STATUS[o.status] ?? o.status}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {o.items.map((it, i) => (
          <li key={i} className="flex items-center gap-3">
            <Thumb src={it.image_url} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] text-sd-ink">{it.title}</p>
              <p className="text-[12px] text-sd-ink-muted">
                {[it.variant_label, `Qty ${it.quantity}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="shrink-0 text-[13px] font-medium tabular-nums text-sd-ink">
              {formatKobo(it.unit_price_kobo * it.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-sd-line pt-3 text-[13px]">
        <span className="text-sd-ink-muted">
          {o.delivery_fee_kobo > 0
            ? `Delivery ${formatKobo(o.delivery_fee_kobo)}${o.courier_name ? ` · ${o.courier_name}` : ""}`
            : (o.courier_name ?? "")}
        </span>
        <span className="font-semibold text-sd-ink">{formatKobo(o.total_kobo)}</span>
      </div>
      {o.tracking_url && (
        <a
          href={o.tracking_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex h-10 items-center text-[13px] font-semibold text-sd-accent-ink"
        >
          Track delivery
        </a>
      )}
    </div>
  );
}
