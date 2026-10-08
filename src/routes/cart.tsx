import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RefreshCw, ShoppingBag } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { CartLine } from "@/components/cart/CartLine";
import { useFreshCart } from "@/components/cart/use-fresh-cart";
import { useOwnUsername } from "@/hooks/use-own-username";
import { useSession } from "@/hooks/use-session";
import { useGoRoot } from "@/hooks/use-back";
import {
  groupByStore,
  lineCount,
  lineStatus,
  subtotalOf,
  useCart,
  useCartReady,
  type LineStatus,
} from "@/lib/cart";

export const Route = createFileRoute("/cart")({
  // No theme-color here: /cart is on the "social" surface (lib/surface.ts),
  // whose light/dark pair the root renders, and a route-level one would win.
  head: () => ({ meta: [{ title: "Bag — Oakmonte" }] }),
  component: CartPage,
});

const naira = (n: number) => `₦${n.toLocaleString()}`;

/** Why a store's lines can't go to checkout yet, or null when they can. While
 *  the lookup is out, checkout waits for it; if the lookup FAILED, it doesn't:
 *  the server re-prices and re-checks stock anyway, so a flaky connection
 *  shouldn't stop someone paying. */
function blockedReason(statuses: LineStatus[], failed: boolean): string | null {
  if (statuses.some((s) => s === "gone" || s === "soldout")) {
    return "Remove what's sold out or unavailable to check out.";
  }
  if (statuses.some((s) => s === "needsChoice")) return "Pick an option for every piece first.";
  if (!failed && statuses.some((s) => s === "checking")) return "Checking prices…";
  return null;
}

// The bag: one section per store, because each store is its own order (one
// courier pickup is one address). Prices and stock are re-read from the
// database on open, and whatever moved since a piece was added is shown on
// its line rather than silently changing the total.
//
// The "social" surface, like /home and /messages: chat-* tokens follow the
// phone's light/dark setting.
function CartPage() {
  const ownUsername = useOwnUsername();
  const navigate = useNavigate();
  const goRoot = useGoRoot();
  const { user, loading: sessionLoading } = useSession();
  const ready = useCartReady();
  const items = useCart();
  const { fresh, queried, failed, notices, retry } = useFreshCart(items, ready);

  const groups = groupByStore(items);
  const count = lineCount(items);
  const changed = notices.some((n) => items.some((i) => i.variantId === n.variantId));

  return (
    <div
      className="min-h-screen bg-chat-bg pb-[calc(env(safe-area-inset-bottom)+7rem)] text-chat-text"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="mx-auto w-full max-w-[560px]">
        <header className="sticky top-0 z-20 bg-chat-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-[56px] items-center gap-2 px-4">
            <h1 className="flex-1 text-[28px] font-bold tracking-[-0.02em]">Bag</h1>
            {ready && count > 0 && (
              <span className="text-[14px] text-chat-muted">
                {count} {count === 1 ? "piece" : "pieces"}
              </span>
            )}
          </div>
        </header>

        {/* Nothing is drawn until the stored bag is read: an "empty" flash on
            a full bag reads as everything having vanished. */}
        {!ready ? null : items.length === 0 ? (
          <div className="flex min-h-[calc(100vh-13rem)] flex-col items-center justify-center px-10 text-center">
            <div className="animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center duration-500 ease-out">
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-chat-soft text-chat-muted">
                <ShoppingBag size={28} />
              </span>
              <p className="mt-5 text-[20px] font-bold">Your bag is empty</p>
              <p className="mt-2 max-w-[280px] text-[14.5px] leading-relaxed text-chat-muted">
                Tap Add to Bag on a piece you like, or +Cart on a post, and it lands here.
              </p>
              <button
                type="button"
                onClick={() => goRoot({ to: "/home" })}
                className="mt-6 flex h-12 items-center rounded-full bg-chat-text px-8 text-[16px] font-semibold text-chat-inverse active:scale-[0.98]"
              >
                Start shopping
              </button>
            </div>
          </div>
        ) : (
          <>
            {!sessionLoading && !user && (
              <div className="mx-4 mt-2 flex items-center gap-3 rounded-[18px] bg-chat-elevated px-4 py-3">
                <p className="flex-1 text-[13.5px] leading-snug text-chat-muted">
                  You can check out as a guest. Sign in to track orders in the app.
                </p>
                <Link
                  to="/sign-in"
                  className="flex h-10 shrink-0 items-center rounded-full bg-chat-soft px-4 text-[14px] font-semibold text-chat-text"
                >
                  Sign in
                </Link>
              </div>
            )}

            {failed && (
              <div className="mx-4 mt-2 flex items-center gap-3 rounded-[18px] bg-chat-elevated px-4 py-3">
                <p className="flex-1 text-[13.5px] leading-snug text-chat-muted">
                  Couldn&apos;t check the latest prices. You&apos;ll see the final amount before you
                  pay.
                </p>
                <button
                  type="button"
                  onClick={retry}
                  aria-label="Check prices again"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-chat-soft text-chat-text"
                >
                  <RefreshCw size={17} />
                </button>
              </div>
            )}

            {changed && (
              <p className="mx-4 mt-2 rounded-[18px] bg-chat-elevated px-4 py-3 text-[13.5px] leading-snug text-chat-muted">
                Some prices or stock changed since you added them. What moved is marked below.
              </p>
            )}

            {groups.map((g) => {
              const statuses = g.items.map((i) => lineStatus(i, fresh, queried));
              const reason = blockedReason(statuses, failed);
              const subtotal = subtotalOf(g.items);
              const pieces = lineCount(g.items);
              return (
                <section
                  key={g.storeId}
                  className="mx-4 mt-4 rounded-[22px] bg-chat-surface px-4 pb-4 pt-3.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="min-w-0 truncate text-[17px] font-semibold">{g.storeName}</h2>
                    <span className="shrink-0 text-[13px] text-chat-muted">
                      {pieces} {pieces === 1 ? "piece" : "pieces"}
                    </span>
                  </div>
                  <ul className="mt-1 divide-y divide-chat-border">
                    {g.items.map((item, i) => (
                      <CartLine
                        key={item.variantId}
                        item={item}
                        status={statuses[i]}
                        product={fresh?.get(item.productId)}
                        notice={notices.find((n) => n.variantId === item.variantId)}
                      />
                    ))}
                  </ul>
                  <div className="border-t border-chat-border pt-3">
                    <div className="flex items-baseline justify-between text-[15px]">
                      <span className="text-chat-muted">Subtotal</span>
                      <span className="font-semibold tabular-nums">
                        {subtotal != null ? naira(subtotal) : "—"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-chat-muted">
                      Delivery is priced for your address at checkout.
                    </p>
                    <button
                      type="button"
                      disabled={!!reason}
                      onClick={() =>
                        void navigate({ to: "/checkout/cart", search: { store: g.storeId } })
                      }
                      className="mt-3 h-12 w-full rounded-full bg-chat-text text-[16px] font-semibold text-chat-inverse active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
                    >
                      {groups.length > 1 ? `Check out from ${g.storeName}` : "Checkout"}
                    </button>
                    {reason && (
                      <p className="mt-2 text-center text-[13px] text-chat-muted">{reason}</p>
                    )}
                  </div>
                </section>
              );
            })}

            {groups.length > 1 && (
              <p className="mx-6 mt-4 text-center text-[12.5px] leading-snug text-chat-muted">
                Each store ships separately, so each one is its own checkout.
              </p>
            )}
          </>
        )}
      </div>

      <BottomNav active="cart" ownUsername={ownUsername} />
    </div>
  );
}
