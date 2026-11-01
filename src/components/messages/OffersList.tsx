import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { authedFetch } from "@/lib/authed-fetch";
import { TabPreview } from "./TabPreview";

/** Mirrors OfferView in offers.server.ts. */
type Offer = {
  id: string;
  status: "pending" | "countered" | "accepted" | "used";
  productId: string;
  variantId: string;
  title: string;
  variantLabel: string | null;
  image: string | null;
  storeName: string | null;
  listPrice: number;
  amount: number;
  counter: number | null;
  agreed: number | null;
};

const naira = (n: number) => `₦${n.toLocaleString()}`;

/** Messages -> Offers. A buyer sees the offers they made and the seller's
 *  answers (accept a counter, then buy at the agreed price). A seller sees
 *  the offers on their pieces and accepts or counters each one. */
export function OffersList({ buyer }: { buyer: boolean }) {
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch(buyer ? "/api/offers" : "/api/store/offers");
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { offers?: Offer[] };
      setOffers(body.offers ?? []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [buyer]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed && !offers) {
    return (
      <div className="flex flex-col items-center gap-3 px-10 pt-20 text-center">
        <p className="text-[16px] font-semibold">Couldn't load offers</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-chat-soft px-5 py-2.5 text-[15px] font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!offers) {
    return (
      <div className="flex justify-center pt-20 text-chat-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (offers.length === 0) return <TabPreview tab="offers" buyer={buyer} />;

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-3">
      {offers.map((o) => (
        <OfferCard key={o.id} offer={o} buyer={buyer} onChanged={() => void load()} />
      ))}
    </div>
  );
}

function OfferCard({
  offer,
  buyer,
  onChanged,
}: {
  offer: Offer;
  buyer: boolean;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countering, setCountering] = useState(false);
  const [counter, setCounter] = useState("");

  async function post(url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? "Something went wrong.");
      setCountering(false);
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const status = statusLine(offer, buyer);
  const primary =
    "flex h-11 flex-1 items-center justify-center rounded-full bg-chat-text text-[15px] font-semibold text-chat-inverse active:scale-[0.98] disabled:opacity-50";
  const secondary =
    "flex h-11 flex-1 items-center justify-center rounded-full border border-chat-border text-[15px] font-semibold active:scale-[0.98] disabled:opacity-50";

  return (
    <div className="rounded-2xl border border-chat-border p-3">
      <div className="flex gap-3">
        {offer.image ? (
          <img src={offer.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="h-16 w-16 shrink-0 rounded-xl bg-chat-soft" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{offer.title}</p>
          <p className="truncate text-[13px] text-chat-muted">
            {[offer.variantLabel, buyer ? offer.storeName : null].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-[14px]">
            <span className="font-semibold">{naira(offer.amount)}</span>{" "}
            <span className="text-chat-muted line-through">{naira(offer.listPrice)}</span>
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-[13.5px] text-chat-muted">{status}</p>

      {/* Seller: answer a new offer. */}
      {!buyer && offer.status === "pending" && !countering && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void post(`/api/store/offers/${offer.id}`, { action: "accept" })}
            className={primary}
          >
            Accept {naira(offer.amount)}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setCountering(true)}
            className={secondary}
          >
            Counter
          </button>
        </div>
      )}
      {!buyer && countering && (
        <div className="mt-3 flex gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-full border border-chat-border px-4">
            <span className="text-chat-muted">₦</span>
            <input
              autoFocus
              inputMode="decimal"
              value={counter}
              onChange={(e) => setCounter(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="Your price"
              aria-label="Counter price in naira"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || !counter}
            onClick={() =>
              void post(`/api/store/offers/${offer.id}`, {
                action: "counter",
                amount: Number(counter),
              })
            }
            className={`${primary} flex-none px-5`}
          >
            Send
          </button>
        </div>
      )}

      {/* Buyer: take the seller's counter, then buy at the agreed price. */}
      {buyer && offer.status === "countered" && offer.counter != null && (
        <div className="mt-3 flex">
          <button
            type="button"
            disabled={busy}
            onClick={() => void post(`/api/offers/${offer.id}`)}
            className={primary}
          >
            Accept {naira(offer.counter)}
          </button>
        </div>
      )}
      {buyer && offer.status === "accepted" && offer.agreed != null && (
        <div className="mt-3 flex">
          <button
            type="button"
            onClick={() =>
              void navigate({
                to: "/checkout/$productId",
                params: { productId: offer.productId },
                search: { variant: offer.variantId, offer: offer.id },
              })
            }
            className={primary}
          >
            Buy for {naira(offer.agreed)}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-red-500">{error}</p>}
    </div>
  );
}

function statusLine(o: Offer, buyer: boolean): string {
  switch (o.status) {
    case "pending":
      return buyer ? "Waiting for the seller to answer." : "New offer. Accept it or counter.";
    case "countered":
      return buyer
        ? `The seller countered with ${naira(o.counter ?? 0)}.`
        : `You countered with ${naira(o.counter ?? 0)}. Waiting for the buyer.`;
    case "accepted":
      return buyer
        ? `Accepted at ${naira(o.agreed ?? 0)}. Check out whenever you're ready.`
        : `Accepted at ${naira(o.agreed ?? 0)}. Waiting for the buyer to pay.`;
    case "used":
      return buyer ? "Bought." : "Sold.";
  }
}
