import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SeedMessage } from "@/lib/messages-seed";

export function OfferCard({ message }: { message: SeedMessage }) {
  const [settled, setSettled] = useState<string | null>(null);
  const offer = message.offer;
  if (!offer) return null;

  return (
    <article className="w-[270px] overflow-hidden rounded-[18px] border border-chat-border bg-chat-elevated p-3">
      <div className="flex gap-3">
        <img src={offer.image} alt={offer.title} className="h-14 w-14 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-chat-muted">Nia offered</p>
          <p className="text-[17px] font-bold text-chat-text">{offer.amount}</p>
          <p className="text-[11px] text-chat-muted"><span className="line-through">{offer.listPrice}</span> · {offer.expiresIn}</p>
        </div>
      </div>
      {settled ? (
        <p className="mt-3 border-t border-chat-border pt-3 text-center text-[12px] font-semibold text-chat-text">Offer {settled} · 08:31</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {(["accepted", "countered", "declined"] as const).map((action) => (
            <Button key={action} type="button" size="sm" variant={action === "accepted" ? "default" : "secondary"} onClick={() => setSettled(action)} className="h-9 rounded-full px-2 text-[11px] capitalize active:scale-95">
              {action === "countered" ? "Counter" : action.replace("ed", "")}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}
