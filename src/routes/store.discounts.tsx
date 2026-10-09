import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Store as StoreIcon, Tag } from "lucide-react";
import { ComingSoonState } from "@/components/store/ComingSoonState";
import { DiscountCard } from "@/components/store/discounts/DiscountCard";
import { DiscountSheet } from "@/components/store/discounts/DiscountSheet";
import {
  loadDiscounts,
  setDiscountActive,
  type DiscountStore,
  type StoreDiscount,
} from "@/components/store/discounts/discounts-api";
import { useActiveStore } from "@/hooks/use-own-store";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { discountStatus, type DiscountStatus } from "@/lib/discounts";

export const Route = createFileRoute("/store/discounts")({
  component: DiscountsPage,
});

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "setup_pending" }
  | { kind: "ok"; store: DiscountStore | null; discounts: StoreDiscount[] };

type Sheet = { mode: "new" } | { mode: "edit"; discount: StoreDiscount } | null;

// Live codes first, then what's coming, then what's finished: the order a
// seller checks them in.
const STATUS_ORDER: Record<DiscountStatus, number> = {
  active: 0,
  scheduled: 1,
  off: 2,
  used_up: 3,
  expired: 4,
};

function DiscountsPage() {
  const { storeId: activeStoreId } = useActiveStore();
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const closeSheet = useCallback(() => setSheet(null), []);
  useOverlayHistory(sheet !== null, closeSheet);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const result = await loadDiscounts();
      setNow(new Date());
      setState(
        result.kind === "ok"
          ? { kind: "ok", store: result.store, discounts: result.discounts }
          : { kind: "setup_pending" },
      );
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't load your discount codes.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Status is a function of time (a scheduled code goes live at its start
  // without anything being saved), so a list left open has to re-read the
  // clock or it will keep saying "Scheduled" after the code is live.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const patchList = useCallback((fn: (list: StoreDiscount[]) => StoreDiscount[]) => {
    setState((s) => (s.kind === "ok" ? { ...s, discounts: fn(s.discounts) } : s));
  }, []);

  const replace = useCallback(
    (d: StoreDiscount) => patchList((list) => list.map((x) => (x.id === d.id ? d : x))),
    [patchList],
  );

  async function toggle(d: StoreDiscount, next: boolean) {
    setNotice(null);
    setToggling(d.id);
    // Optimistic: the switch should move under the thumb, not a round trip later.
    replace({ ...d, active: next });
    try {
      replace(await setDiscountActive(d.id, next));
    } catch (err) {
      replace(d);
      setNotice(err instanceof Error ? err.message : "Couldn't change the code.");
    } finally {
      setToggling(null);
    }
  }

  const rows = useMemo(() => {
    if (state.kind !== "ok") return [];
    return state.discounts
      .map((d) => ({ d, status: discountStatus(d, now) }))
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          b.d.created_at.localeCompare(a.d.created_at),
      );
  }, [state, now]);

  const summary = useMemo(() => {
    const live = rows.filter((r) => r.status === "active").length;
    const scheduled = rows.filter((r) => r.status === "scheduled").length;
    return [
      live ? `${live} live` : null,
      scheduled ? `${scheduled} scheduled` : null,
      `${rows.length} code${rows.length === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [rows]);

  const store = state.kind === "ok" ? state.store : null;
  const canCreate = state.kind === "ok" && state.store !== null;

  return (
    <div className="flex flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="sd-editorial text-[26px] leading-[1.1] tracking-[-0.02em] text-sd-ink">
            Discounts
          </h1>
          {state.kind === "ok" && rows.length > 0 && (
            <p className="mt-1 text-[13px] text-sd-ink-muted">{summary}</p>
          )}
        </div>
        {canCreate && rows.length > 0 && (
          <button
            type="button"
            onClick={() => setSheet({ mode: "new" })}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-sd-ink px-4 text-[14px] font-semibold text-sd-bg oak-motion-control active:scale-[0.97]"
          >
            <Plus size={16} strokeWidth={2.5} />
            New code
          </button>
        )}
      </div>

      {/* requireOwnStore answers for the account's first store, the same one
          /store/orders reads. A seller who switched to another store in the
          drawer must not mistake these codes for that store's. */}
      {store && activeStoreId && activeStoreId !== store.id && (
        <p className="rounded-2xl bg-sd-soft px-4 py-3 text-[13px] leading-snug text-sd-ink">
          These codes are for <span className="font-semibold">{store.brand_name}</span>. Codes for
          your other stores aren&apos;t supported yet.
        </p>
      )}

      {notice && (
        <p className="text-[13px] text-sd-danger-ink" role="alert">
          {notice}
        </p>
      )}

      {state.kind === "loading" && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading discount codes">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[138px] animate-pulse rounded-2xl bg-sd-soft" />
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="max-w-[280px] text-[14px] text-sd-ink-muted">{state.message}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="h-10 rounded-full border border-sd-line px-5 text-[14px] font-semibold text-sd-ink oak-motion-control active:scale-[0.97]"
          >
            Try again
          </button>
        </div>
      )}

      {state.kind === "setup_pending" && (
        <ComingSoonState
          icon={Tag}
          title="Discount codes are almost ready"
          description="They switch on with the next database update. There's nothing for you to do."
        />
      )}

      {state.kind === "ok" && state.store === null && (
        <ComingSoonState
          icon={StoreIcon}
          title="Set up your store first"
          description="Discount codes belong to a store. Create yours to start making them."
        />
      )}

      {canCreate && rows.length === 0 && (
        <div className="flex flex-col items-center">
          <ComingSoonState
            icon={Tag}
            title="No discount codes yet"
            description="Make a code buyers enter at checkout for money off: a percentage or a fixed amount."
          />
          <button
            type="button"
            onClick={() => setSheet({ mode: "new" })}
            className="-mt-8 flex h-11 items-center gap-1.5 rounded-full bg-sd-ink px-5 text-[15px] font-semibold text-sd-bg oak-motion-control active:scale-[0.97]"
          >
            <Plus size={17} strokeWidth={2.5} />
            Create a code
          </button>
        </div>
      )}

      {rows.map(({ d, status }) => (
        <DiscountCard
          key={d.id}
          discount={d}
          status={status}
          store={store}
          toggling={toggling === d.id}
          onEdit={() => setSheet({ mode: "edit", discount: d })}
          onToggle={(next) => void toggle(d, next)}
        />
      ))}

      {rows.length > 0 && (
        <p className="px-1 pt-1 text-[12px] leading-relaxed text-sd-ink-muted">
          Buyers enter a code at checkout, one per order. It comes off the items, never the delivery
          fee.
        </p>
      )}

      {sheet && (
        <DiscountSheet
          store={store}
          existing={sheet.mode === "edit" ? sheet.discount : null}
          onClose={closeSheet}
          onSaved={(saved) => {
            if (sheet.mode === "edit") replace(saved);
            else patchList((list) => [saved, ...list]);
            setNow(new Date());
            setSheet(null);
          }}
          onDeleted={(id) => {
            patchList((list) => list.filter((x) => x.id !== id));
            setSheet(null);
          }}
        />
      )}
    </div>
  );
}
