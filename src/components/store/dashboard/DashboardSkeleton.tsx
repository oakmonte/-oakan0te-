/** Shown while the dashboard chunk itself is still downloading (see the
 *  lazy() + Suspense in store.index.tsx). Outlines the real layout --
 *  IdentityBlock's avatar+pills, each section's title-and-card shape, the
 *  sales hero, the tile grid, the payout row, QuickActions -- with the same
 *  shimmer sweep the Messages page's own skeletons use (sd-skeleton shares
 *  its @keyframes with messages-skeleton in styles.css, retinted with
 *  --sd-ink so it reads on both the light and dark dashboard, not just a
 *  fixed-dark screen like Messages).
 *
 *  Pure shimmer blocks throughout, no real copy mixed in -- same choice the
 *  Messages skeleton makes, and it sidesteps a layout jump if any block's
 *  real content ends up a different width than its placeholder. */
export function DashboardSkeleton() {
  return (
    <div
      className="flex flex-col gap-8 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5"
      aria-hidden
    >
      <span className="sr-only" role="status">
        Loading your store
      </span>

      {/* IdentityBlock */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <div className="sd-skeleton h-[72px] w-[72px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="sd-skeleton h-[22px] w-40 rounded-full" />
            <div className="sd-skeleton mt-2 h-[13px] w-24 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="sd-skeleton h-11 rounded-full" />
          <div className="sd-skeleton h-11 rounded-full" />
          <div className="sd-skeleton h-11 rounded-full" />
        </div>
      </div>

      <TitledCard />
      <TitledCard />

      <div className="flex flex-col gap-6">
        {/* TotalSales hero */}
        <div className="rounded-3xl border-2 border-sd-line-strong bg-sd-hero-bg p-5">
          <div className="sd-skeleton h-3 w-24 rounded-full" />
          <div className="sd-skeleton mt-3 h-7 w-3/4 rounded-full" />
          <div className="sd-skeleton mt-2 h-4 w-full rounded-full" />
          <div className="sd-skeleton mt-1.5 h-4 w-2/3 rounded-full" />
          <div className="sd-skeleton mt-5 h-12 w-full rounded-full" />
        </div>

        <TitledCard />

        {/* StatTiles */}
        <div>
          <div className="sd-skeleton h-[17px] w-24 rounded-full" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-sd-line bg-sd-surface p-4">
                <div className="sd-skeleton h-[13px] w-20 rounded-full" />
                <div className="sd-skeleton mt-2 h-[22px] w-10 rounded-full" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-sd-line bg-sd-surface p-4">
            <div className="sd-skeleton h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="sd-skeleton h-[15px] w-32 rounded-full" />
              <div className="sd-skeleton mt-1.5 h-[13px] w-48 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* QuickActions */}
      <div>
        <div className="sd-skeleton h-[17px] w-28 rounded-full" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex aspect-[1/0.92] flex-col items-center gap-2 rounded-xl border border-sd-line px-1 pt-4"
            >
              <div className="sd-skeleton h-5 w-5 rounded-full" />
              <div className="sd-skeleton h-[10px] w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** One section title bar + a card shaped like QuietNote (the icon-badge +
 *  two text lines every empty section on this page currently renders). */
function TitledCard() {
  return (
    <div>
      <div className="sd-skeleton h-[17px] w-28 rounded-full" />
      <div className="mt-3 flex items-start gap-3 rounded-2xl border border-sd-line bg-sd-elevated p-4">
        <span className="sd-skeleton h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 pt-1.5">
          <div className="sd-skeleton h-[13px] w-3/4 rounded-full" />
          <div className="sd-skeleton mt-2 h-[13px] w-1/2 rounded-full" />
        </div>
      </div>
    </div>
  );
}
