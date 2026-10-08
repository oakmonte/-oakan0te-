import { ChevronDown, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { MAX_LINE_QTY } from "@/lib/order-lines";
import {
  capFor,
  chooseCartVariant,
  removeFromCart,
  setCartQuantity,
  subtotalOf,
  type CartItem,
  type CartNotice,
  type FreshProduct,
  type LineStatus,
} from "@/lib/cart";

const naira = (n: number) => `₦${n.toLocaleString()}`;

/** One line of the bag: photo, name, option, what changed since it was added,
 *  and the quantity stepper. Written in chat-* tokens so it follows the
 *  phone's light/dark setting with the rest of /cart. */
export function CartLine({
  item,
  status,
  product,
  notice,
}: {
  item: CartItem;
  status: LineStatus;
  /** The product as the database has it now; undefined until checked. */
  product: FreshProduct | undefined;
  notice: CartNotice | undefined;
}) {
  const cap = capFor(item.maxQuantity);
  const blocked = status === "gone" || status === "soldout";
  // The picker only exists where there is something to pick between.
  const options = product && product.variants.length > 1 ? product.variants : null;
  const optionName = product?.optionName ?? "Option";
  // Nothing valid is selected: never picked (added from the feed), or the
  // picked option was deleted. A blank placeholder makes any pick register.
  const unchosen = status === "needsChoice" || status === "gone";
  const lineTotal = subtotalOf([item]);

  return (
    <li className="flex gap-3 py-3.5">
      <div className="h-[92px] w-[74px] shrink-0 overflow-hidden rounded-xl bg-chat-soft">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${blocked ? "opacity-50" : ""}`}
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-chat-faint">
            <ShoppingBag size={22} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <p className="line-clamp-2 flex-1 pt-0.5 text-[15px] font-medium leading-snug">
            {item.title}
          </p>
          <button
            type="button"
            onClick={() => removeFromCart([item.variantId])}
            aria-label={`Remove ${item.title}`}
            className="-mr-2 -mt-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-chat-muted active:bg-chat-text/10"
          >
            <X size={18} />
          </button>
        </div>

        {options ? (
          // A native select under a styled pill: the phone's own picker wheel,
          // which beats anything drawn in the page at this size.
          <label
            className={`relative mt-1 inline-flex h-10 max-w-full items-center gap-1 rounded-full px-3.5 text-[13.5px] ${
              unchosen
                ? "border border-chat-accent text-chat-accent"
                : "bg-chat-soft text-chat-text"
            }`}
          >
            <span className="truncate">
              {status === "needsChoice"
                ? `Choose ${optionName.toLowerCase()}`
                : status === "gone"
                  ? `Choose another ${optionName.toLowerCase()}`
                  : `${optionName}: ${item.variantLabel ?? "—"}`}
            </span>
            <ChevronDown size={15} className="shrink-0" />
            <select
              aria-label={`${optionName} for ${item.title}`}
              // Blank while unchosen, so picking the option it happens to sit
              // on still counts as a choice (a select only fires on change).
              value={unchosen ? "" : item.variantId}
              onChange={(e) => {
                const v = options.find((o) => o.id === e.target.value);
                if (!v) return;
                chooseCartVariant(item.variantId, {
                  variantId: v.id,
                  variantLabel: v.label,
                  unitPrice: v.unitPrice,
                  imageUrl: v.imageUrl,
                  maxQuantity: v.stock,
                });
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {unchosen && (
                <option value="" disabled>
                  Choose {optionName.toLowerCase()}
                </option>
              )}
              {options.map((o) => {
                const out = o.stock === 0 || o.unitPrice == null;
                return (
                  <option key={o.id} value={o.id} disabled={out}>
                    {(o.label ?? "Default") + (out ? " (sold out)" : "")}
                  </option>
                );
              })}
            </select>
          </label>
        ) : (
          item.variantLabel && (
            <p className="mt-0.5 text-[13.5px] text-chat-muted">{item.variantLabel}</p>
          )
        )}

        {status === "soldout" && <p className="mt-1 text-[13px] text-chat-danger">Sold out</p>}
        {status === "gone" && (
          <p className="mt-1 text-[13px] text-chat-danger">
            {options ? "This option isn't available any more" : "No longer available"}
          </p>
        )}
        {status === "needsChoice" && (
          <p className="mt-1 text-[13px] text-chat-muted">
            Added from a post. Pick the {optionName.toLowerCase()} you want.
          </p>
        )}
        {!blocked && notice?.kind === "price" && (
          <p className="mt-1 text-[13px] text-chat-muted">
            Price {notice.to > notice.from ? "went up" : "dropped"} from {naira(notice.from)}
          </p>
        )}
        {!blocked && notice?.kind === "reduced" && (
          <p className="mt-1 text-[13px] text-chat-muted">
            Only {notice.to} left, so we lowered your quantity
          </p>
        )}

        {!blocked && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex h-10 items-center rounded-full border border-chat-border">
              <button
                type="button"
                onClick={() => setCartQuantity(item.variantId, item.quantity - 1)}
                disabled={item.quantity <= 1}
                aria-label="One fewer"
                className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-30"
              >
                <Minus size={16} />
              </button>
              <span
                className="min-w-[22px] text-center text-[15px] tabular-nums"
                aria-live="polite"
              >
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => setCartQuantity(item.variantId, item.quantity + 1)}
                disabled={item.quantity >= cap}
                aria-label="One more"
                className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-30"
              >
                <Plus size={16} />
              </button>
            </div>
            <p className="text-[15px] font-semibold tabular-nums">
              {lineTotal != null ? naira(lineTotal) : "—"}
            </p>
          </div>
        )}
        {!blocked && item.maxQuantity != null && item.quantity >= cap && cap < MAX_LINE_QTY && (
          <p className="mt-1 text-[12.5px] text-chat-muted">That&apos;s all there is</p>
        )}
      </div>
    </li>
  );
}
