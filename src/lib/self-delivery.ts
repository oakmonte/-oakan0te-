import { COMMISSION_RATE, PAYSTACK_RATE } from "@/lib/pricing-fees";

// A paid order goes out one of two ways, the seller's choice on the order
// screen: Oakmonte books the courier the buyer picked at checkout (Shipbubble),
// or the seller delivers it themselves. Checkout always quotes a courier, so the
// buyer's delivery fee is the courier's price either way.
//
// A seller-delivered order is stored as delivery_method 'flat' -- the value the
// schema (20261007120000_orders_checkout.sql) reserved for delivery the seller
// handles -- so no migration was needed. Read it through isSelfDelivered, never
// by comparing to the string, so the meaning lives in one place.

/** Days after shipping before a quiet order is released to the seller
 *  (delivery-release.server.ts). Here so client screens can say it too. */
export const AUTO_RELEASE_DAYS = 7;

/** orders.delivery_method for an order the seller delivers themselves. */
export const SELF_DELIVERY_METHOD = "flat" as const;

export function isSelfDelivered(deliveryMethod: string | null | undefined): boolean {
  return deliveryMethod === SELF_DELIVERY_METHOD;
}

// A seller delivering it themselves can ask the buyer for more delivery money
// than checkout charged (a far address, a bulky parcel). That is a second
// Paystack payment on the same order: an order_payments row whose reference
// starts with TOP_UP_PREFIX. Once it settles, its amount is added to the
// order's delivery_fee_kobo and total_kobo, so the payout and refunds see it.
// It is never "the" payment of the order (see loadOrderPayment).

export const TOP_UP_PREFIX = "dlv_";
/** Naira, whole. Low enough to catch a slipped extra zero. */
export const TOP_UP_MIN_NAIRA = 100;
export const TOP_UP_MAX_NAIRA = 200_000;

export function isTopUpReference(reference: string | null | undefined): boolean {
  return !!reference && reference.startsWith(TOP_UP_PREFIX);
}

/** A fresh reference for one Paystack attempt at a top-up. Each "Pay" tap gets
 *  its own: Paystack refuses to initialise the same reference twice. */
export function topUpReference(orderId: string): string {
  return `${TOP_UP_PREFIX}${orderId}_${crypto.randomUUID().slice(0, 8)}`;
}

/** The order a top-up reference belongs to, or null. */
export function orderIdFromTopUp(reference: string): string | null {
  if (!isTopUpReference(reference)) return null;
  const id = reference.slice(TOP_UP_PREFIX.length).split("_")[0];
  return id || null;
}

/** Validates a seller's extra-fee entry (naira) and returns kobo, or an error. */
export function parseTopUpNaira(
  raw: unknown,
): { ok: true; kobo: number } | { ok: false; error: string } {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[,\s₦]/g, ""));
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return { ok: false, error: "Enter a whole naira amount." };
  }
  if (n < TOP_UP_MIN_NAIRA) {
    return { ok: false, error: `Ask for at least ₦${TOP_UP_MIN_NAIRA.toLocaleString()}.` };
  }
  if (n > TOP_UP_MAX_NAIRA) {
    return { ok: false, error: `That's more than ₦${TOP_UP_MAX_NAIRA.toLocaleString()}.` };
  }
  return { ok: true, kobo: n * 100 };
}

/** The seller's payout for a delivered order, in kobo. The items less 4.5%
 *  (Oakmonte's commission + Paystack). The delivery fee is the courier's money
 *  on a courier order; when the seller delivered it themselves it is theirs,
 *  less only Paystack's 1.5% (Oakmonte takes no commission on delivery).
 *  Rounded down to the kobo -- never pay out more than was taken. */
export function sellerPayoutKobo(order: {
  itemsKobo: number;
  deliveryKobo: number;
  deliveryMethod: string | null | undefined;
}): number {
  const items = order.itemsKobo * (1 - COMMISSION_RATE - PAYSTACK_RATE);
  const delivery = isSelfDelivered(order.deliveryMethod)
    ? order.deliveryKobo * (1 - PAYSTACK_RATE)
    : 0;
  return Math.floor(items + delivery);
}
