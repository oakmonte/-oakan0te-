import type { UseQueryResult } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { SalesChart } from "@/components/store/insights/SalesChart";
import { PeriodPicker } from "@/components/store/insights/PeriodPicker";
import {
  LoadError,
  ProductRanking,
  QuietNote,
  Stat,
  TruncatedNote,
} from "@/components/store/insights/parts";
import {
  formatKobo,
  percentChange,
  periodLabel,
  type Period,
  type SalesResponse,
} from "@/lib/insights";
import { SectionTitle } from "./sections";

/** The dashboard's sales section, on real paid orders.
 *
 *  The query is owned by the dashboard, not this section, because the tiles
 *  under it read the same response's all-time numbers -- one request, and the
 *  two can never disagree about how many orders there have been.
 *
 *  Before the first order it stays the quiet note it always was: no period
 *  selector over nothing, and no axes with a flat line at zero, which reads as
 *  a chart that failed to load. A period with no sales after the first order
 *  is different -- that zero is real, and it says so in words. */
export function SalesAnalytics({
  period,
  onPeriodChange,
  query,
}: {
  period: Period;
  onPeriodChange: (p: Period) => void;
  query: UseQueryResult<SalesResponse>;
}) {
  const { data, isPending, isError, isPlaceholderData, isFetching, refetch } = query;
  const hasSales = !!data && data.allTime.orders > 0;
  const label = periodLabel(period);

  let body;
  if (isPending) {
    body = (
      <>
        <span className="sr-only" role="status">
          Loading sales
        </span>
        <div aria-hidden className="sd-skeleton h-[300px] rounded-2xl" />
      </>
    );
  } else if (!data) {
    body = isError ? (
      <LoadError message="Couldn't load your sales" onRetry={() => void refetch()} />
    ) : null;
  } else if (!hasSales) {
    body = <QuietNote icon={TrendingUp}>Your sales chart starts with your first order.</QuietNote>;
  } else if (data.totals.orders === 0) {
    body = (
      <QuietNote icon={TrendingUp}>
        No paid orders in the {label.toLowerCase()}. All time: {formatKobo(data.allTime.revenueKobo)}{" "}
        from {data.allTime.orders === 1 ? "1 order" : `${data.allTime.orders} orders`}.
      </QuietNote>
    );
  } else {
    const change = percentChange(data.totals.revenueKobo, data.previous.revenueKobo);
    body = (
      <>
        <div className="rounded-2xl border border-sd-line bg-sd-surface p-4">
          <p className="text-[13px] font-medium text-sd-ink-muted">Sales · {label.toLowerCase()}</p>
          <p className="mt-1 text-[28px] font-bold leading-none tracking-[-0.02em] text-sd-ink">
            {formatKobo(data.totals.revenueKobo)}
          </p>
          {change !== null ? (
            <p
              className={`mt-2 flex items-center gap-1 text-[13px] font-medium ${
                change >= 0 ? "text-sd-success-ink" : "text-sd-ink-muted"
              }`}
            >
              {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {change >= 0 ? "Up" : "Down"} {Math.abs(change)}% vs the previous{" "}
              {period.replace("d", "")} days
            </p>
          ) : (
            // No percentage against an empty window -- "up ∞%" is not a number.
            <p className="mt-2 text-[13px] text-sd-ink-muted">
              No sales in the {period.replace("d", "")} days before, so nothing to compare yet.
            </p>
          )}

          <div className="mt-4">
            <SalesChart
              // A new period is a new chart: drop any bar selection with it.
              key={period}
              buckets={data.buckets}
              unit={period === "90d" ? "week" : "day"}
              dimmed={isPlaceholderData && isFetching}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Orders" value={data.totals.orders} />
            <Stat label="Avg order" value={formatKobo(data.totals.aovKobo)} />
            <Stat label="Pieces sold" value={data.totals.units} />
          </div>
        </div>

        {data.bestSellers.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-sd-ink">
              Best sellers
            </h3>
            <p className="mt-0.5 text-[12px] text-sd-ink-muted">By pieces sold, {label.toLowerCase()}.</p>
            <div className="mt-2.5">
              <ProductRanking rows={data.bestSellers} metric="units" />
            </div>
          </div>
        )}

        <p className="mt-3 text-[12px] leading-snug text-sd-ink-muted">
          Paid orders only. Sales are what your pieces sold for, before fees; delivery isn&apos;t
          included.
        </p>
        {data.truncated && (
          <div className="mt-1">
            <TruncatedNote />
          </div>
        )}
        {isError && (
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 h-10 text-[13px] font-semibold text-sd-accent-ink"
          >
            Couldn&apos;t refresh. Try again
          </button>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby="sd-analytics">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <SectionTitle id="sd-analytics">Sales analytics</SectionTitle>
        {hasSales && <PeriodPicker value={period} onChange={onPeriodChange} label="Sales period" />}
      </div>
      <div className="mt-3">{body}</div>
    </section>
  );
}
