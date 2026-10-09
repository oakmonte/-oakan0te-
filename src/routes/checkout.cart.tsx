import { useMemo, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { DeliveryCheckout } from "@/components/checkout/DeliveryCheckout";
import { useFreshCart } from "@/components/cart/use-fresh-cart";
import { useNavigateUp } from "@/hooks/use-back";
import {
  lineCount,
  lineStatus,
  removeFromCart,
  subtotalOf,
  useCart,
  useCartReady,
  type CartItem,
} from "@/lib/cart";
import { SALES_LOCKED } from "@/lib/launch-locks";

export const Route = createFileRoute("/checkout/cart")({
  // Until launch there's no checkout to reach, even by typing the address
  // (lib/launch-locks.ts).
  beforeLoad: () => {
    if (SALES_LOCKED) throw redirect({ to: "/cart" });
  },
  validateSearch: (s: Record<string, unknown>): { store?: string } => ({
    store: typeof s.store === "string" && s.store ? s.store : undefined,
  }),
  head: () => ({ meta: [{ title: "Checkout — Oakmonte" }] }),
  component: CartCheckoutPage,
});

const naira = (n: number) => `₦${n.toLocaleString()}`;

// Checkout for one store's lines from the bag: one order, several items, one
// courier. Same delivery and payment steps as Buy Now (DeliveryCheckout); the
// server prices every line again and refuses a bag that spans stores.
function CartCheckoutPage() {
  const { store } = Route.useSearch();
  const navigateUp = useNavigateUp();
  const ready = useCartReady();
  const cart = useCart();
  // Once the order exists its lines leave the bag, but this page stays up
  // until the browser reaches Paystack. Frozen so it keeps showing what was
  // ordered instead of flashing "nothing to check out" on the way out.
  const [frozen, setFrozen] = useState<CartItem[] | null>(null);
  const live = useMemo(() => cart.filter((i) => i.storeId === store), [cart, store]);
  const lines = frozen ?? live;
  const { fresh, queried, failed } = useFreshCart(lines, ready && !frozen);

  const statuses = lines.map((l) => lineStatus(l, fresh, queried));
  const problem = statuses.some((s) => s === "gone" || s === "soldout" || s === "needsChoice");
  const checking = !failed && statuses.some((s) => s === "checking");
  const subtotal = subtotalOf(lines);
  const count = lineCount(lines);
  const orderLines = useMemo(
    () => ({
      items: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        quantity: l.quantity,
      })),
    }),
    [lines],
  );

  const back = (
    <BackButton
      to={{ to: "/cart" }}
      icon="chevron"
      alwaysShow
      ariaLabel="Back to your bag"
      className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
    />
  );

  if (!ready) return <CheckoutShell back={back}>{null}</CheckoutShell>;

  if (lines.length === 0) {
    return (
      <CheckoutShell back={back}>
        <div className="flex flex-col items-center px-6 pt-16 text-center">
          <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white/[0.06] text-white/60">
            <ShoppingBag size={28} />
          </span>
          <p className="mt-5 text-[18px] font-semibold">Nothing to check out</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55">
            There&apos;s nothing from this store in your bag any more.
          </p>
          <button
            type="button"
            onClick={() => navigateUp({ to: "/cart" })}
            className="mt-6 h-12 rounded-full bg-white px-8 text-[16px] font-semibold text-black"
          >
            Back to your bag
          </button>
        </div>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell back={back}>
      <div className="rounded-2xl bg-white/[0.06] p-3">
        <p className="px-1 pb-1 text-[13px] text-white/55">
          {count} {count === 1 ? "piece" : "pieces"} from {lines[0].storeName}
        </p>
        <ul className="divide-y divide-white/10">
          {lines.map((l, i) => {
            const total = subtotalOf([l]);
            const status = statuses[i];
            return (
              <li key={l.variantId} className="flex items-center gap-3 py-2.5">
                {l.imageUrl ? (
                  <img
                    src={l.imageUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-white/40">
                    <ShoppingBag size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{l.title}</p>
                  <p className="text-[13px] text-white/55">
                    {[l.variantLabel, `Qty ${l.quantity}`].filter(Boolean).join(" · ")}
                  </p>
                  {(status === "gone" || status === "soldout") && (
                    <p className="text-[13px] text-red-400">
                      {status === "soldout" ? "Sold out" : "No longer available"}
                    </p>
                  )}
                  {status === "needsChoice" && (
                    <p className="text-[13px] text-white/70">Pick an option in your bag</p>
                  )}
                </div>
                {total != null && (
                  <p className="shrink-0 text-[15px] tabular-nums">{naira(total)}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {problem && (
        <div className="mt-3 rounded-2xl border border-white/15 p-4 text-[14px] leading-snug text-white/75">
          Something in this order changed since you added it.{" "}
          <button
            type="button"
            onClick={() => navigateUp({ to: "/cart" })}
            className="font-semibold text-white underline underline-offset-2"
          >
            Sort it out in your bag
          </button>
        </div>
      )}

      <DeliveryCheckout
        lines={orderLines}
        subtotal={subtotal}
        subtotalLabel={count === 1 ? "Item" : `Items (${count})`}
        blockedReason={
          problem ? "Fix the changes in your bag first." : checking ? "Checking prices…" : null
        }
        onOrderCreated={() => {
          setFrozen(lines);
          removeFromCart(lines.map((l) => l.variantId));
        }}
      />
    </CheckoutShell>
  );
}
