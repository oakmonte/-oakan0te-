import { Lock } from "lucide-react";
import { SAMPLE_OFFER, SAMPLE_ORDER } from "@/lib/messages-seed";

/**
 * Offers / Orders aren't wired to real data yet. Rather than an empty
 * "coming soon" line, show a blurred sample of the real card so the shape of
 * the feature reads at a glance.
 */
export function TabPreview({ tab }: { tab: "offers" | "orders" }) {
  const cards = tab === "offers" ? [0, 1, 2] : [0, 1];

  return (
    <div className="relative px-4 pt-4">
      <div className="space-y-3 blur-[5px] select-none" aria-hidden>
        {cards.map((index) =>
          tab === "offers" ? (
            <article
              key={index}
              className="flex items-center gap-3 rounded-[18px] border border-chat-border bg-chat-surface p-3"
            >
              <img src={SAMPLE_OFFER.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-chat-muted">{SAMPLE_OFFER.buyer} offered</p>
                <p className="text-[17px] font-bold text-chat-text">{SAMPLE_OFFER.offered}</p>
                <p className="text-[11px] text-chat-muted line-through">{SAMPLE_OFFER.listed}</p>
              </div>
              <span className="h-9 rounded-full bg-chat-text px-4 text-[13px] font-semibold leading-9 text-chat-inverse">
                Accept
              </span>
            </article>
          ) : (
            <article
              key={index}
              className="flex items-center gap-3 rounded-[18px] border border-chat-border bg-chat-surface p-3"
            >
              <img src={SAMPLE_ORDER.image} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-chat-muted">{SAMPLE_ORDER.code}</p>
                <p className="truncate text-[14px] font-semibold text-chat-text">
                  {SAMPLE_ORDER.title}
                </p>
                <p className="text-[12px] text-chat-muted">{SAMPLE_ORDER.status}</p>
              </div>
            </article>
          ),
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-chat-text">
          <Lock size={19} />
        </span>
        <p className="text-[15px] font-semibold text-chat-text">
          {tab === "offers" ? "Offers" : "Orders"} arrive at full launch
        </p>
        <p className="text-[13px] text-chat-muted">
          {tab === "offers"
            ? "Haggle, counter and close deals right inside the chat."
            : "Track payment, dispatch and delivery beside the conversation."}
        </p>
      </div>
    </div>
  );
}
