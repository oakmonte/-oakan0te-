import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import * as api from "@/lib/chat/api";
import { authedFetch } from "@/lib/authed-fetch";
import { useStorefrontChat } from "@/lib/buyer-session";
import { useOverlayHistory } from "@/hooks/use-overlay-history";

const naira = (n: number) => `₦${n.toLocaleString()}`;

/** The minimum the server accepts (offers.server.ts MIN_OFFER_SHARE). */
const MIN_SHARE = 0.5;

/** Make Offer, Depop-style: the buyer types the price they'd pay (or taps a
 *  quick 10/15/20% off), and it lands in the seller's Messages -> Offers to
 *  accept or counter. The answer shows in the buyer's own Offers tab, where an
 *  accepted price checks out at that price. Same sheet shape as EnquirySheet. */
export function OfferSheet({
  product,
  onClose,
  onSent,
}: {
  product: {
    id: string;
    variantId: string;
    title: string;
    variantLabel: string | null;
    price: number;
    image: string | null;
  };
  onClose: () => void;
  /** After the offer is in: the storefront switches to its Messages tab. */
  onSent: () => void;
}) {
  const chat = useStorefrontChat();
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  useOverlayHistory(true, onClose);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const value = Number(amount.replace(/[^0-9.]/g, ""));
  const min = Math.ceil(product.price * MIN_SHARE);
  const valid = value >= min && value < product.price;
  const quick = [10, 15, 20].map((pct) => Math.round((product.price * (100 - pct)) / 100));

  async function send() {
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await authedFetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantId: product.variantId,
          amount: value,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't send your offer.");
      // A line in the chat too, so the seller hears about it where they talk
      // to buyers. Best effort: the offer itself is already saved.
      if (chat?.ownerId && chat.me) {
        try {
          const conversationId = await api.startDirectConversation(chat.ownerId);
          await api.insertMessage({
            id: crypto.randomUUID(),
            conversationId,
            senderId: chat.me,
            kind: "text",
            body: `I'd like to offer ${naira(value)} for this.`,
            meta: {
              product: {
                id: product.id,
                title: product.title,
                price: product.price,
                images: product.image ? [product.image] : [],
              },
            },
          });
        } catch {
          // The offer is in the Offers tab either way.
        }
      }
      onSent();
    } catch (reason) {
      setError((reason as Error).message || "Couldn't send your offer.");
      setSending(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[210]"
      role="dialog"
      aria-modal="true"
      aria-label="Make an offer"
    >
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[28px] bg-white px-4 pt-4 text-[#111] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          transform: shown ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Make an offer</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 grid h-10 w-10 place-items-center rounded-full active:bg-black/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-black/25 p-2.5">
          {product.image ? (
            <img
              src={product.image}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="h-14 w-14 shrink-0 rounded-xl bg-black/5" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{product.title}</p>
            <p className="text-[13.5px] text-black/55">
              {[product.variantLabel, `Listed at ${naira(product.price)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <label className="mt-4 flex h-16 items-center gap-1 rounded-2xl border border-black/30 px-4 focus-within:border-black">
          <span className="text-[26px] font-semibold text-black/40">₦</span>
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder={quick[0].toLocaleString()}
            aria-label="Your offer in naira"
            className="min-w-0 flex-1 bg-transparent text-[26px] font-semibold outline-none placeholder:text-black/25"
          />
        </label>

        <div className="mt-3 flex gap-2">
          {quick.map((q, i) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className="flex-1 rounded-full border border-black/25 py-2 text-[13.5px] font-medium active:scale-[0.97]"
            >
              {naira(q)}
              <span className="block text-[11px] text-black/50">{[10, 15, 20][i]}% off</span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-[13px] leading-snug text-black/55">
          {amount && !valid
            ? value >= product.price
              ? "That's the full price — just buy it."
              : `Offers start at ${naira(min)}.`
            : "The seller can accept or counter. Their answer shows in Messages → Offers."}
        </p>
        {error && <p className="mt-2 text-[13.5px] text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => void send()}
          disabled={!valid || sending}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111] text-[16px] font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
        >
          {sending && <Loader2 size={18} className="animate-spin" />}
          {valid ? `Offer ${naira(value)}` : "Send offer"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
