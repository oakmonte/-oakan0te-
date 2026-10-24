/** A list still loading: outlined rows with a thumbnail and two lines, in the
 *  dashboard's shimmer (sd-skeleton), instead of a bare "Loading…" -- the page
 *  reads as on its way, not broken. Shapes match the product/collection rows,
 *  so nothing jumps when the real rows land. */
export function ListSkeleton({ rows = 5, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-4">
      <span className="sr-only" role="status">
        {label}
      </span>
      <div className="contents" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-sd-line p-3"
            style={{ opacity: 1 - i * 0.12 }}
          >
            <div className="sd-skeleton h-14 w-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="sd-skeleton h-[15px] w-2/5 rounded-full" />
              <div className="sd-skeleton mt-2 h-[12px] w-1/4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
