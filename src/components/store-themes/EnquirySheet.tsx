import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import * as api from "@/lib/chat/api";
import type { EnquiryProduct } from "@/lib/chat/model";
import { useStorefrontChat } from "@/lib/buyer-session";
import { useOverlayHistory } from "@/hooks/use-overlay-history";

const naira = (n: number) => `₦${n.toLocaleString()}`;

/** A buyer's question about one piece, sent to the seller as a chat message:
 *  the product (photos and price) as a card, the buyer's words underneath.
 *  On a store's website the sender is whoever useStorefrontBuyer says --
 *  an anonymous buyer unless they're signed in with a real account. */
export function EnquirySheet({
  product,
  onClose,
  onSent,
}: {
  product: EnquiryProduct;
  onClose: () => void;
  /** After the message is in: the storefront switches to its Messages tab. */
  onSent: () => void;
}) {
  const chat = useStorefrontChat();
  const [text, setText] = useState("Hi, is this still available?");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  useOverlayHistory(true, onClose);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    if (!chat?.ownerId || !chat.me) {
      setError(chat?.error ?? "Messaging isn't ready yet. Try again in a moment.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const conversationId = await api.startDirectConversation(chat.ownerId);
      await api.insertMessage({
        id: crypto.randomUUID(),
        conversationId,
        senderId: chat.me,
        kind: "text",
        body,
        meta: { product },
      });
      onSent();
    } catch (reason) {
      setError((reason as Error).message || "Message not sent");
      setSending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[210]" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white px-4 pt-4 text-[#111] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          transform: shown ? "translateY(0)" : "translateY(100%)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Message {chat?.storeName ?? "the seller"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 grid h-10 w-10 place-items-center rounded-full active:bg-black/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* The piece being asked about, exactly as the seller will see it. */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-black/10">
          {product.images.length > 0 && (
            <div className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar">
              {product.images.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="aspect-[4/5] w-full shrink-0 snap-center bg-black/5 object-cover"
                  style={{ maxHeight: 260 }}
                />
              ))}
            </div>
          )}
          <div className="px-3 py-2.5">
            <p className="truncate text-[15px] font-medium">{product.title}</p>
            {product.price != null && (
              <p className="text-[15px] font-semibold">{naira(product.price)}</p>
            )}
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Ask about sizes, colours, delivery…"
          className="mt-3 w-full resize-none rounded-2xl bg-black/[0.05] px-3.5 py-3 text-[16px] outline-none placeholder:text-black/40"
        />
        {error && <p className="mt-2 text-[13.5px] text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || sending}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111] text-[16px] font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-40"
        >
          {sending && <Loader2 size={18} className="animate-spin" />}
          Send
        </button>
      </div>
    </div>,
    document.body,
  );
}
