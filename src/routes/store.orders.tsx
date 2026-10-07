import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { ComingSoonState } from "@/components/store/ComingSoonState";
import { authedFetch } from "@/lib/authed-fetch";

export const Route = createFileRoute("/store/orders")({
  component: OrdersPage,
});

type StoreOrder = {
  id: string;
  status: string;
  total_kobo: number;
  ship_to: { name?: string; phone?: string; address?: string } | null;
  courier_name: string | null;
  tracking_url: string | null;
  created_at: string;
  items: {
    title: string;
    variant_label: string | null;
    image_url: string | null;
    quantity: number;
  }[];
};

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;

const BADGE: Record<string, string> = {
  paid: "To ship",
  shipped: "Shipped",
  delivered: "Delivered",
};

function OrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await authedFetch("/api/store/orders");
    const body = res.ok ? ((await res.json()) as { orders: StoreOrder[] }) : null;
    setOrders(body?.orders ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function ship(id: string) {
    setError("");
    setBusy(id);
    try {
      const res = await authedFetch(`/api/store/orders/${id}/ship`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Couldn't book the courier.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (orders === null) {
    return <p className="px-4 pt-6 text-[14px] text-sd-ink-muted">Loading orders…</p>;
  }
  if (orders.length === 0) {
    return (
      <ComingSoonState
        icon={ShoppingBag}
        title="No orders yet"
        description="Paid orders show up here, ready to ship."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      <h1 className="sd-editorial text-[26px] leading-[1.1] tracking-[-0.02em] text-sd-ink">
        Orders
      </h1>
      {error && <p className="text-[13px] text-sd-danger-ink">{error}</p>}
      {orders.map((o) => (
        <div key={o.id} className="rounded-2xl border border-sd-line bg-sd-surface p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-sd-soft px-2.5 py-1 text-[12px] font-semibold text-sd-ink">
              {BADGE[o.status] ?? o.status}
            </span>
            <span className="text-[15px] font-semibold text-sd-ink">{naira(o.total_kobo)}</span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {o.items.map((it, i) => (
              <div key={i} className="flex items-center gap-3">
                {it.image_url && (
                  <img src={it.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-sd-ink">{it.title}</p>
                  <p className="text-[12px] text-sd-ink-muted">
                    {[it.variant_label, `Qty ${it.quantity}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-sd-line pt-3 text-[13px] text-sd-ink-muted">
            <p className="text-sd-ink">{o.ship_to?.name}</p>
            <p>{o.ship_to?.phone}</p>
            <p>{o.ship_to?.address}</p>
            {o.courier_name && <p className="mt-1">Courier: {o.courier_name}</p>}
          </div>
          {o.status === "paid" && (
            <button
              type="button"
              disabled={busy === o.id}
              onClick={() => void ship(o.id)}
              className="mt-3 h-11 w-full rounded-full bg-sd-ink text-[14px] font-semibold text-sd-bg disabled:opacity-50"
            >
              {busy === o.id ? "Booking courier…" : "Book courier and ship"}
            </button>
          )}
          {o.tracking_url && (
            <a
              href={o.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-[13px] text-sd-ink underline"
            >
              Track delivery
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
