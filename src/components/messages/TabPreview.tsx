import { ArrowDown, Package, Tag } from "lucide-react";

/**
 * The Offers and Orders tabs while they have nothing in them. Buying is live,
 * so this is a plain empty state -- not the blurred sample cards and "arrive
 * at full launch" lock they showed while sales were held back.
 */
export function TabPreview({
  tab,
  buyer = false,
}: {
  tab: "offers" | "orders";
  /** A shopper in a store's own Messages: the offers and orders are theirs. */
  buyer?: boolean;
}) {
  const offers = tab === "offers";

  return (
    <div className="flex flex-col items-center gap-2 px-10 pt-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-chat-text/10 text-chat-text">
        {offers ? (
          // An offer is a bargain -- the buyer pushing the price down (offering
          // 230k on a 300k piece) -- so a price tag with a down arrow, not coins.
          <span className="relative">
            <Tag size={21} />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full bg-chat-text text-chat-bg">
              <ArrowDown size={11} strokeWidth={3} />
            </span>
          </span>
        ) : (
          <Package size={21} />
        )}
      </span>
      <p className="mt-1 text-[17px] font-semibold text-chat-text">
        {offers ? "No offers yet" : "No orders yet"}
      </p>
      <p className="text-[14px] text-chat-muted">
        {buyer
          ? offers
            ? "When you make an offer, it appears here."
            : "When you place an order, it appears here."
          : offers
            ? "When someone makes an offer, it shows up here."
            : "Orders show up here once they're placed."}
      </p>
    </div>
  );
}
