import { HandCoins, Package } from "lucide-react";

/**
 * The Offers and Orders tabs while they have nothing in them. Buying is live,
 * so this is a plain empty state -- not the blurred sample cards and "arrive
 * at full launch" lock they showed while sales were held back.
 */
export function TabPreview({ tab }: { tab: "offers" | "orders" }) {
  const offers = tab === "offers";
  const Icon = offers ? HandCoins : Package;

  return (
    <div className="flex flex-col items-center gap-2 px-10 pt-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-chat-text/10 text-chat-text">
        <Icon size={21} />
      </span>
      <p className="mt-1 text-[17px] font-semibold text-chat-text">
        {offers ? "No offers yet" : "No orders yet"}
      </p>
      <p className="text-[14px] text-chat-muted">
        {offers
          ? "When someone makes an offer, it shows up here."
          : "Orders show up here once they're placed."}
      </p>
    </div>
  );
}
