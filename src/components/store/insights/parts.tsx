import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Package, type LucideIcon } from "lucide-react";
import { formatKobo, type ProductSales } from "@/lib/insights";

// Small pieces the insights screens share. Same voice as the dashboard: a
// Fraunces headline, plain Inter copy, hairline cards on --sd-* tokens.

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header>
      <h1 className="sd-editorial text-[26px] leading-[1.1] tracking-[-0.02em] text-sd-ink">
        {title}
      </h1>
      {children && (
        <p className="mt-1.5 text-[14px] leading-relaxed text-sd-ink-muted">{children}</p>
      )}
    </header>
  );
}

export function SectionHeading({
  id,
  children,
  aside,
}: {
  id: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="text-[17px] font-semibold tracking-[-0.02em] text-sd-ink">
        {children}
      </h2>
      {aside}
    </div>
  );
}

/** The quiet surface for "nothing here yet": one icon, one sentence. Solid,
 *  never dashed -- a dashed box means "tap to add" everywhere else in /store. */
export function QuietNote({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-sd-line bg-sd-elevated p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sd-surface">
        <Icon size={17} className="text-sd-ink-muted" />
      </span>
      <div className="pt-1.5 text-[14px] leading-relaxed text-sd-ink-muted">{children}</div>
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-sd-line bg-sd-surface p-4">
      <p className="text-[14px] font-semibold text-sd-ink">{message}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-sd-ink-muted">
        That&apos;s usually the connection. Nothing in your store has changed.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 h-10 rounded-full bg-sd-ink px-5 text-[14px] font-semibold text-sd-bg oak-motion-control active:scale-[0.97]"
      >
        Try again
      </button>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-sd-line bg-sd-surface p-3.5">
      <p className="truncate text-[12px] font-medium text-sd-ink-muted">{label}</p>
      <p className="mt-1.5 truncate text-[18px] font-bold leading-none tracking-[-0.02em] text-sd-ink">
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-[11px] text-sd-ink-muted">{hint}</p>}
    </div>
  );
}

export function Thumb({ src, size = 48 }: { src: string | null; size?: number }) {
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-xl bg-sd-soft object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-xl bg-sd-soft"
    >
      <Package size={Math.round(size * 0.38)} className="text-sd-ink-faint" />
    </span>
  );
}

/** A ranked product list. Rows link to the product's edit screen when the
 *  product still has an id; a line whose product was deleted stays as text. */
export function ProductRanking({
  rows,
  metric,
}: {
  rows: ProductSales[];
  metric: "units" | "revenue";
}) {
  return (
    <ol className="flex flex-col divide-y divide-sd-line overflow-hidden rounded-2xl border border-sd-line bg-sd-surface">
      {rows.map((r, i) => {
        const body = (
          <>
            <span className="w-4 shrink-0 text-center text-[13px] font-semibold tabular-nums text-sd-ink-muted">
              {i + 1}
            </span>
            <Thumb src={r.imageUrl} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-sd-ink">{r.title}</span>
              <span className="mt-0.5 block text-[12px] text-sd-ink-muted">
                {metric === "units"
                  ? `${formatKobo(r.revenueKobo)} · ${r.orders === 1 ? "1 order" : `${r.orders} orders`}`
                  : `${r.units} sold · ${r.orders === 1 ? "1 order" : `${r.orders} orders`}`}
              </span>
            </span>
            <span className="shrink-0 text-right text-[14px] font-semibold tabular-nums text-sd-ink">
              {metric === "units" ? `${r.units} sold` : formatKobo(r.revenueKobo)}
            </span>
          </>
        );
        const cls = "flex min-h-[64px] items-center gap-3 px-3.5 py-2.5";
        return (
          <li key={r.key}>
            {r.productId ? (
              <Link
                to="/store/products/$id"
                params={{ id: r.productId }}
                className={`oak-tap ${cls} active:bg-sd-soft`}
              >
                {body}
                <ChevronRight size={15} className="shrink-0 text-sd-ink-faint" />
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sd-skeleton h-16 rounded-2xl" />
      ))}
    </div>
  );
}

/** For a store whose history is longer than one request reads. Says so rather
 *  than presenting a partial sum as the whole. */
export function TruncatedNote() {
  return (
    <p className="text-[12px] leading-snug text-sd-ink-muted">
      Showing your most recent 10,000 orders. Older orders aren&apos;t counted here yet.
    </p>
  );
}
