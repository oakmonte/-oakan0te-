import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronRight, ImageOff, PackageCheck, Tag, TrendingUp } from "lucide-react";
import { useActiveStore } from "@/hooks/use-own-store";
import { useStoreInsights } from "@/hooks/use-store-insights";
import { ShareKit } from "@/components/store/insights/ShareKit";
import {
  ListSkeleton,
  LoadError,
  PageHeader,
  ProductRanking,
  QuietNote,
  SectionHeading,
  Thumb,
  TruncatedNote,
} from "@/components/store/insights/parts";
import {
  LOW_STOCK_THRESHOLD,
  type FixRow,
  type GrowthAction,
  type GrowthResponse,
  type LowStockRow,
} from "@/lib/insights";

export const Route = createFileRoute("/store/growth")({
  component: GrowthPage,
});

/** Growth: share the store, see what sells, catch what's about to stop
 *  selling or can't sell yet -- and a checklist built from those same numbers,
 *  so every suggestion says what it measured. */
function GrowthPage() {
  const { store, storeId } = useActiveStore();
  const { data, isPending, isError, refetch } = useStoreInsights<GrowthResponse>(storeId, "growth");

  return (
    <div className="flex flex-col gap-8 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      <PageHeader title="Growth">What&apos;s selling, what&apos;s stuck, and what to do next.</PageHeader>

      {/* The share kit only needs the username, which the store switcher
          already has -- so it renders before the insights arrive. */}
      <section id="share" aria-label="Share your store" className="scroll-mt-20">
        {store ? (
          <ShareKit username={store.store_username} brandName={store.brand_name} />
        ) : (
          <div aria-hidden className="sd-skeleton h-[300px] rounded-3xl" />
        )}
      </section>

      {isPending || !storeId ? (
        <>
          <span className="sr-only" role="status">
            Loading growth insights
          </span>
          <ListSkeleton rows={5} />
        </>
      ) : !data ? (
        isError && <LoadError message="Couldn't load growth insights" onRetry={() => void refetch()} />
      ) : (
        <GrowthBody data={data} />
      )}
    </div>
  );
}

function GrowthBody({ data }: { data: GrowthResponse }) {
  const [rankBy, setRankBy] = useState<"revenue" | "units">("revenue");
  const done = data.checklist.filter((a) => a.done).length;
  const ranked = rankBy === "revenue" ? data.topByRevenue : data.topByUnits;

  return (
    <>
      <section aria-labelledby="growth-next" className="flex flex-col gap-3">
        <SectionHeading
          id="growth-next"
          aside={
            <span className="text-[13px] font-medium tabular-nums text-sd-ink-muted">
              {done} of {data.checklist.length} done
            </span>
          }
        >
          Next steps
        </SectionHeading>
        <ul className="flex flex-col divide-y divide-sd-line overflow-hidden rounded-2xl border border-sd-line bg-sd-surface">
          {data.checklist.map((a) => (
            <li key={a.id}>
              <ChecklistRow action={a} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="growth-top" className="flex flex-col gap-3">
        <SectionHeading
          id="growth-top"
          aside={
            data.topByRevenue.length > 0 && (
              <div role="radiogroup" aria-label="Rank by" className="flex rounded-full bg-sd-soft px-0.5">
                {(
                  [
                    ["revenue", "Sales"],
                    ["units", "Pieces"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rankBy === value}
                    onClick={() => setRankBy(value)}
                    className="oak-tap grid h-10 min-w-[56px] place-items-center"
                  >
                    <span
                      className={`grid h-8 place-items-center rounded-full px-3 text-[13px] font-semibold ${
                        rankBy === value ? "bg-sd-surface text-sd-ink shadow-sm" : "text-sd-ink-muted"
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            )
          }
        >
          Top pieces
        </SectionHeading>
        {ranked.length === 0 ? (
          <QuietNote icon={TrendingUp}>Your best sellers show up here after your first sale.</QuietNote>
        ) : (
          <>
            <ProductRanking rows={ranked} metric={rankBy} />
            <p className="text-[12px] text-sd-ink-muted">
              All time, from paid orders.{" "}
              {rankBy === "revenue" ? "Ranked by what they sold for." : "Ranked by pieces sold."}
            </p>
            {data.truncated && <TruncatedNote />}
          </>
        )}
      </section>

      <section id="stock" aria-labelledby="growth-stock" className="flex scroll-mt-20 flex-col gap-3">
        <SectionHeading id="growth-stock">Running low</SectionHeading>
        {data.lowStock.length === 0 ? (
          <QuietNote icon={PackageCheck}>
            {data.signals.activeProducts
              ? `Nothing live is down to ${LOW_STOCK_THRESHOLD} or fewer.`
              : "Stock warnings show up here once you have pieces live."}
          </QuietNote>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-sd-line overflow-hidden rounded-2xl border border-sd-line bg-sd-surface">
              {data.lowStock.map((row) => (
                <li key={row.variantId}>
                  <LowStockLink row={row} />
                </li>
              ))}
            </ul>
            <p className="text-[12px] leading-snug text-sd-ink-muted">
              Live pieces with {LOW_STOCK_THRESHOLD} or fewer left, unless they&apos;re set to keep
              selling when out of stock.
              {data.signals.lowStockCount > data.lowStock.length &&
                ` Showing ${data.lowStock.length} of ${data.signals.lowStockCount}.`}
            </p>
          </>
        )}
      </section>

      <section id="fix" aria-labelledby="growth-fix" className="flex scroll-mt-20 flex-col gap-3">
        <SectionHeading id="growth-fix">Fix before they can sell</SectionHeading>
        {data.needsFixing.length === 0 ? (
          <QuietNote icon={Check}>
            {data.signals.activeProducts
              ? "Every piece has a photo and a price."
              : "Pieces missing a photo or a price show up here."}
          </QuietNote>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-sd-line overflow-hidden rounded-2xl border border-sd-line bg-sd-surface">
              {data.needsFixing.map((row) => (
                <li key={row.productId}>
                  <FixLink row={row} />
                </li>
              ))}
            </ul>
            <p className="text-[12px] leading-snug text-sd-ink-muted">
              Drafts included, so they&apos;re ready when you publish.
              {data.needsFixingTotal > data.needsFixing.length &&
                ` Showing ${data.needsFixing.length} of ${data.needsFixingTotal}.`}
            </p>
          </>
        )}
      </section>

    </>
  );
}

function ChecklistRow({ action: a }: { action: GrowthAction }) {
  const mark = (
    <span
      aria-hidden
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
        a.done ? "bg-sd-success-mark text-sd-bg" : "border-2 border-sd-line"
      }`}
    >
      {a.done && <Check size={14} strokeWidth={3} />}
    </span>
  );
  const text = (
    <span className="min-w-0 flex-1">
      <span
        className={`block text-[15px] font-medium leading-snug ${a.done ? "text-sd-ink-muted" : "text-sd-ink"}`}
      >
        <span className="sr-only">{a.done ? "Done: " : "To do: "}</span>
        {a.title}
      </span>
      <span className="mt-0.5 block text-[13px] leading-relaxed text-sd-ink-muted">{a.detail}</span>
    </span>
  );
  const cls = "flex min-h-[64px] w-full items-start gap-3 px-3.5 py-3 text-left";

  // Finished steps keep their row, so progress stays visible, but lose their
  // button: a CTA for something already done is a control that does nothing.
  if (a.done) {
    return (
      <div className={cls}>
        {mark}
        {text}
      </div>
    );
  }
  const cta: ReactNode = (
    <span className="mt-0.5 shrink-0 text-[13px] font-bold text-sd-accent-ink">{a.cta} →</span>
  );
  if (a.target.kind === "link") {
    return (
      <Link to={a.target.to} className={`oak-tap ${cls} active:bg-sd-soft`}>
        {mark}
        {text}
        {cta}
      </Link>
    );
  }
  const section = a.target.section;
  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className={`${cls} active:bg-sd-soft`}
    >
      {mark}
      {text}
      {cta}
    </button>
  );
}

function LowStockLink({ row }: { row: LowStockRow }) {
  const badge =
    row.stockQty === null ? "No count" : row.stockQty === 0 ? "Sold out" : `${row.stockQty} left`;
  const urgent = row.stockQty === null || row.stockQty === 0;
  return (
    <Link
      to="/store/products/$id"
      params={{ id: row.productId }}
      className="oak-tap flex min-h-[64px] items-center gap-3 px-3.5 py-2.5 active:bg-sd-soft"
    >
      <Thumb src={row.imageUrl} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-sd-ink">{row.title}</span>
        <span className="mt-0.5 block truncate text-[12px] text-sd-ink-muted">
          {row.stockQty === null
            ? "No stock count set, so checkout treats it as sold out."
            : (row.variantLabel ?? "One size")}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
          urgent ? "bg-sd-soft text-sd-danger-ink" : "bg-sd-soft text-sd-attention-ink"
        }`}
      >
        {badge}
      </span>
      <ChevronRight size={15} className="shrink-0 text-sd-ink-faint" />
    </Link>
  );
}

function FixLink({ row }: { row: FixRow }) {
  return (
    <Link
      to="/store/products/$id"
      params={{ id: row.productId }}
      className="oak-tap flex min-h-[64px] items-center gap-3 px-3.5 py-2.5 active:bg-sd-soft"
    >
      <Thumb src={row.imageUrl} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-sd-ink">{row.title}</span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {row.missing.includes("photo") && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sd-soft px-2 py-0.5 text-[12px] font-medium text-sd-ink">
              <ImageOff size={12} /> No photo
            </span>
          )}
          {row.missing.includes("price") && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sd-soft px-2 py-0.5 text-[12px] font-medium text-sd-ink">
              <Tag size={12} /> Missing a price
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 text-[13px] font-bold text-sd-accent-ink">Fix</span>
      <ChevronRight size={15} className="shrink-0 text-sd-ink-faint" />
    </Link>
  );
}
