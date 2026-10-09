import { useCallback, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Search, Users, X } from "lucide-react";
import { useActiveStore } from "@/hooks/use-own-store";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useStoreInsights } from "@/hooks/use-store-insights";
import { ComingSoonState } from "@/components/store/ComingSoonState";
import { CustomerAvatar, CustomerSheet } from "@/components/store/insights/CustomerSheet";
import {
  ListSkeleton,
  LoadError,
  PageHeader,
  Stat,
  TruncatedNote,
} from "@/components/store/insights/parts";
import {
  formatDate,
  formatKobo,
  matchesCustomer,
  type CustomerRow,
  type CustomersResponse,
} from "@/lib/insights";

export const Route = createFileRoute("/store/customers")({
  component: CustomersPage,
});

type Sort = "recent" | "spend";

/** Everyone who has paid for an order from this store, derived from the
 *  orders themselves: an account buyer by their account, a guest by the phone
 *  they gave for delivery. Nobody shows up here for following or browsing --
 *  only for buying here. */
function CustomersPage() {
  const { store, storeId } = useActiveStore();
  const { data, isPending, isError, refetch } = useStoreInsights<CustomersResponse>(
    storeId,
    "customers",
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<Sort>("recent");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeSheet = useCallback(() => setOpenKey(null), []);
  useOverlayHistory(openKey !== null, closeSheet);

  const shown = useMemo(() => {
    const rows = (data?.customers ?? []).filter((c) => matchesCustomer(c, deferredQuery));
    if (sort === "spend") {
      return [...rows].sort((a, b) => b.totalKobo - a.totalKobo || b.orders - a.orders);
    }
    return rows; // the server already sends most recent first
  }, [data, deferredQuery, sort]);

  if (isPending || !storeId) {
    return (
      <Shell>
        <PageHeader title="Customers" />
        <span className="sr-only" role="status">
          Loading customers
        </span>
        <ListSkeleton rows={5} />
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <PageHeader title="Customers" />
        {isError && <LoadError message="Couldn't load your customers" onRetry={() => void refetch()} />}
      </Shell>
    );
  }
  if (data.customers.length === 0) {
    return (
      <div className="flex flex-col items-center">
        <ComingSoonState
          icon={Users}
          title="No customers yet"
          description="Buyers show up here after their first paid order, with what they bought and how to reach them."
        />
        <Link
          to="/store/growth"
          className="oak-tap -mt-6 grid h-11 place-items-center rounded-full bg-sd-ink px-6 text-[14px] font-semibold text-sd-bg oak-motion-control active:scale-[0.97]"
        >
          Share your store link
        </Link>
      </div>
    );
  }

  return (
    <Shell>
      <PageHeader title="Customers">
        Everyone who has paid for an order from {store?.brand_name ?? "your store"}.
      </PageHeader>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Customers" value={data.summary.customers} />
        <Stat
          label="Came back"
          value={data.summary.repeat}
          hint={
            data.summary.customers
              ? `${Math.round((data.summary.repeat / data.summary.customers) * 100)}% of buyers`
              : undefined
          }
        />
        <Stat label="Spent" value={formatKobo(data.summary.totalKobo)} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="relative block">
          <span className="sr-only">Search customers</span>
          <Search
            size={17}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sd-ink-muted"
          />
          {/* 16px text: anything smaller and iOS zooms the page on focus. */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone or email"
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 w-full rounded-full border border-sd-line bg-sd-surface pl-10 pr-10 text-[16px] text-sd-ink placeholder:text-sd-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-sd-focus"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-sd-ink-muted"
            >
              <X size={16} />
            </button>
          )}
        </label>

        <div role="radiogroup" aria-label="Sort customers" className="flex gap-2">
          {(
            [
              ["recent", "Most recent"],
              ["spend", "Top spenders"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={sort === value}
              onClick={() => setSort(value)}
              className={`h-10 rounded-full px-4 text-[13px] font-semibold oak-motion-control ${
                sort === value
                  ? "bg-sd-ink text-sd-bg"
                  : "border border-sd-line bg-sd-surface text-sd-ink-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-sd-ink-muted">
          No customers match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-sd-line overflow-hidden rounded-2xl border border-sd-line bg-sd-surface">
          {shown.map((c) => (
            <li key={c.key}>
              <CustomerListRow customer={c} onOpen={() => setOpenKey(c.key)} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-[12px] leading-snug text-sd-ink-muted">
        From paid orders only. Spent is what they paid for pieces, not delivery. Contact details
        come from their own orders with you; keep them to arranging orders.
      </p>
      {data.truncated && <TruncatedNote />}

      {openKey && storeId && (
        <CustomerSheet storeId={storeId} customerKey={openKey} onClose={closeSheet} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      {children}
    </div>
  );
}

function CustomerListRow({ customer: c, onOpen }: { customer: CustomerRow; onOpen: () => void }) {
  const secondary = [
    c.username ? `@${c.username}` : c.isAccount ? null : "Guest",
    c.orders === 1 ? "1 order" : `${c.orders} orders`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[64px] w-full items-center gap-3 px-3.5 py-2.5 text-left active:bg-sd-soft"
    >
      <CustomerAvatar customer={c} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-sd-ink">
          {c.name ?? (c.username ? `@${c.username}` : "Unnamed buyer")}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-sd-ink-muted">{secondary}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[14px] font-semibold tabular-nums text-sd-ink">
          {formatKobo(c.totalKobo)}
        </span>
        <span className="mt-0.5 block text-[12px] text-sd-ink-muted">
          {formatDate(c.lastOrderAt)}
        </span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-sd-ink-faint" />
    </button>
  );
}
