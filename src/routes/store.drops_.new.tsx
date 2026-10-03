import { createFileRoute, redirect } from "@tanstack/react-router";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { DROPS_ENABLED } from "@/lib/drops";
import { DropForm } from "@/components/store/drops/DropForm";
import { EMPTY_DROP } from "@/lib/drop-form";

export const Route = createFileRoute("/store/drops_/new")({
  beforeLoad: () => {
    if (!DROPS_ENABLED) throw redirect({ to: "/store/products" });
  },
  component: NewDrop,
});

function NewDrop() {
  const { storeId, loading } = useActiveStoreId();
  if (loading) return <div className="px-4 py-8 text-sm text-sd-ink-faint">Loading…</div>;
  if (!storeId)
    return (
      <div className="px-4 py-8 text-sm text-sd-ink-faint">No store found on this account.</div>
    );
  return <DropForm heading="New Drop" storeId={storeId} dropId={null} initial={EMPTY_DROP} />;
}
