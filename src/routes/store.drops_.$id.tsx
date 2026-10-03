import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { DROPS_ENABLED, deleteDrop } from "@/lib/drops";
import { DropForm } from "@/components/store/drops/DropForm";
import { DROPS_RETURN_TO, loadDrop, type DropFormValues } from "@/lib/drop-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/store/drops_/$id")({
  beforeLoad: () => {
    if (!DROPS_ENABLED) throw redirect({ to: "/store/products" });
  },
  component: EditDrop,
});

function EditDrop() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { storeId, loading } = useActiveStoreId();
  // undefined = loading, null = not found
  const [initial, setInitial] = useState<DropFormValues | null | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    void loadDrop(id, storeId).then((v) => {
      if (!cancelled) setInitial(v);
    });
    return () => {
      cancelled = true;
    };
  }, [id, storeId]);

  if (loading || (storeId && initial === undefined))
    return <div className="px-4 py-8 text-sm text-sd-ink-faint">Loading…</div>;
  if (!storeId || !initial)
    return <div className="px-4 py-8 text-sm text-sd-ink-faint">Drop not found.</div>;

  async function handleDelete() {
    if (!storeId) return;
    const { error } = await deleteDrop(id, storeId);
    if (error) return setDeleteError("Couldn't delete: " + error);
    navigate(DROPS_RETURN_TO);
  }

  return (
    <>
      <DropForm
        heading="Edit Drop"
        storeId={storeId}
        dropId={id}
        initial={initial}
        footer={
          <div className="mx-4 mt-6">
            {deleteError && <p className="mb-2 text-sm text-sd-danger-ink">{deleteError}</p>}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border border-sd-line py-3.5 text-[15px] font-medium text-sd-danger-ink"
            >
              <Trash2 size={16} />
              Delete drop
            </button>
          </div>
        }
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-[92vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this drop?</AlertDialogTitle>
            <AlertDialogDescription>
              The collections and products in it are kept — only the drop is removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-sd-ink text-sd-bg rounded-full">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
