import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useActiveStoreId } from "@/hooks/use-own-store";
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
// This matters more later than it does today. The analytics section is currently
// an honest empty state with no charting library behind it, because there is no
// orders table to chart; recharts is in package.json and imported by nothing.
// When that data exists and the chart becomes real, it lands inside this chunk
// rather than the checklist one, with no further thought required.
const StoreDashboard = lazy(() => import("@/components/store/dashboard"));

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
 *  yet, so this reads `complete` alone for now. */
function StoreHome() {
  const { storeId, loading: storeLoading } = useActiveStoreId();
  const { loading: statusLoading, complete, productCount } = useStoreSetupStatus(storeId ?? null);

  // useStoreSetupStatus reports loading:true whenever storeId is null, which is
  // also the permanent state of an account with no store row -- so reading its
  // `loading` alone left such an account on a skeleton forever. Asking
  // useActiveStoreId whether IT is still looking separates "we don't know yet"
  // from "there is nothing to know", which is what lets the page render at all.
  const resolvingStore = storeLoading || (!!storeId && statusLoading);

  if (resolvingStore) {
    // Deliberately branch-AGNOSTIC. The checklist's own skeleton is shaped like
    // its rows, which was right when rows were the only thing this route could
    // render; across a fork that same shape actively misleads, because a seller
    // whose setup is finished would watch five checklist rows resolve into a
    // dashboard. A neutral block promises nothing about which page is coming.
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

  if (!complete) return <SetupChecklist />;

  return (
    <Suspense
      fallback={
        <div className="px-4 py-6">
          <Skeleton className="h-[72px] w-[72px] rounded-full" />
          <Skeleton className="mt-4 h-10 w-full rounded-full" />
          <Skeleton className="mt-6 h-[172px] w-full rounded-3xl" />
        </div>
      }
    >
      <StoreDashboard productCount={productCount} />
    </Suspense>
  );
}
