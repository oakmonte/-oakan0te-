import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { useSession } from "@/hooks/use-session";
import { useStoreSetupStatus } from "@/hooks/use-store-setup-status";
import { SetupChecklist } from "@/components/store/SetupChecklist";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/store/")({
  component: StoreHome,
});

// React.lazy, not a plain import. TanStack Start splits by ROUTE, and both
// branches below live behind one route, so a static import would put the entire
// dashboard into the chunk every seller still working through the setup
// checklist has to download -- and the checklist is, by definition, what someone
// sees on their slowest, earliest visits. The dynamic import is what creates the
// second chunk.
//
// The analytics section is currently an honest empty state with no charting
// library behind it, because there is no orders table to chart; recharts is in
// package.json and imported by nothing. When that data exists and the chart
// becomes real, it lands inside this chunk rather than the checklist one.
const loadDashboard = () => import("@/components/store/dashboard");
const StoreDashboard = lazy(loadDashboard);

// Remembers that this browser has reached the dashboard before, so the next
// visit can start downloading it immediately instead of waiting for the setup
// status to come back first and only THEN fetching the chunk -- two round trips
// in series on the connection most sellers are on. A hint, never a decision:
// which page to show is still decided by the server-derived status below.
const DASHBOARD_HINT_KEY = "oak_store_dashboard_seen";

/** /store is two different pages.
 *
 *      setup not finished  ->  the checklist
 *      setup finished      ->  the dashboard
 *
 *  `complete` is derived from the seller's data: a payout account, at least one
 *  pickup location, at least one product, and a storefront theme. It
 *  deliberately excludes "get the webapp", which is hidden on desktop and would
 *  otherwise leave every laptop seller permanently unfinished.
 *
 *  Once stores.onboarded_at is applied, this should read
 *  `complete || onboarded_at`, so that graduating is ONE-WAY. Deriving it live
 *  means it flips both ways, and a seller who deletes their last product would
 *  be dropped from a dashboard they have used for weeks back into an onboarding
 *  checklist. A regression like that belongs in Needs attention, not in a
 *  full-page demotion. The column ships in the migration and is not applied
 *  yet, so this reads `complete` alone for now.
 *
 *  Every state has its own screen. The page used to have exactly one answer to
 *  "not ready yet" -- a skeleton -- which is how an account with no store, or a
 *  seller on a connection that dropped one request, ended up staring at a
 *  skeleton that could never resolve. */
function StoreHome() {
  const { user, loading: sessionLoading } = useSession();
  const { storeId, loading: storeLoading } = useActiveStoreId();
  const status = useStoreSetupStatus(storeId ?? null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DASHBOARD_HINT_KEY) === "1") void loadDashboard();
    } catch {
      // Private mode or blocked storage: no prefetch, nothing else lost.
    }
  }, []);

  useEffect(() => {
    if (!status.complete) return;
    try {
      localStorage.setItem(DASHBOARD_HINT_KEY, "1");
    } catch {
      // As above.
    }
  }, [status.complete]);

  if (sessionLoading || storeLoading) return <NeutralPlaceholder />;
  if (!user) {
    return (
      <Notice
        title="Sign in to manage your store"
        body="Your store dashboard lives behind your Oakmonte account."
        action={{ label: "Sign in", to: "/sign-in" }}
      />
    );
  }
  if (!storeId) {
    return (
      <Notice
        title="No store on this account yet"
        body="Name your store and you can start listing straight away."
        action={{ label: "Set up your store", to: "/name-your-store" }}
      />
    );
  }
  if (status.failed) return <LoadFailed onRetry={status.retry} />;
  if (status.loading) return <NeutralPlaceholder />;
  if (!status.complete) return <SetupChecklist status={status} />;

  return (
    <Suspense
      fallback={
        <div className="px-4 py-6">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <Skeleton className="mt-4 h-11 w-full rounded-full" />
          <Skeleton className="mt-6 h-[220px] w-full rounded-3xl" />
        </div>
      }
    >
      <StoreDashboard productCount={status.productCount} payoutStatus={status.payoutStatus} />
    </Suspense>
  );
}

/** Deliberately branch-AGNOSTIC. The checklist's own skeleton is shaped like
 *  its rows, which was right when rows were the only thing this route could
 *  render; across a fork that shape actively misleads, because a seller whose
 *  setup is finished would watch checklist rows resolve into a dashboard. A
 *  neutral block promises nothing about which page is coming. */
function NeutralPlaceholder() {
  return (
    <div className="px-4 py-6">
      <span className="sr-only" role="status">
        Loading your store
      </span>
      <Skeleton className="h-6 w-56 rounded" />
      <Skeleton className="mt-3 h-4 w-40 rounded" />
      <Skeleton className="mt-6 h-[168px] w-full rounded-2xl" />
    </div>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { label: string; to: "/sign-in" | "/name-your-store" };
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <p className="sd-editorial text-[22px] leading-tight text-sd-ink">{title}</p>
      <p className="mt-2 max-w-[30ch] text-[14px] leading-relaxed text-sd-ink-muted">{body}</p>
      <Link
        to={action.to}
        className="mt-6 grid h-11 place-items-center rounded-full bg-sd-ink px-6 text-[14px] font-semibold text-sd-bg oak-motion-control active:scale-[0.97]"
      >
        {action.label}
      </Link>
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-16 text-center">
      <p className="sd-editorial text-[22px] leading-tight text-sd-ink">
        We couldn&apos;t load your store
      </p>
      <p className="mt-2 max-w-[30ch] text-[14px] leading-relaxed text-sd-ink-muted">
        That&apos;s usually the connection. Your store is fine — nothing has changed.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 h-11 rounded-full bg-sd-ink px-6 text-[14px] font-semibold text-sd-bg oak-motion-control active:scale-[0.97]"
      >
        Try again
      </button>
    </div>
  );
}
