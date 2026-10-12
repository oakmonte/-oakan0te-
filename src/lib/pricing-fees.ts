// What a sale costs, and what a seller actually receives.
//
// These constants and this arithmetic used to live inside PricingSheet.tsx,
// which was fine while the only consumer was that one sheet. They are here now
// because the fee-passthrough toggle needs the inverse as well as the forward
// calculation, and because checkout and payouts will need the same numbers —
// two copies of a money rule is one copy too many.
//
// Amounts are naira in major units, matching product_variants.price, which is
// a plain number and not kobo.

/** Oakmonte's cut. */
export const COMMISSION_RATE = 0.03;

/** Paystack's processing fee. Oakmonte + Paystack = a flat 4.5% on every sale. */
export const PAYSTACK_RATE = 0.015;

export type Fees = {
  commission: number;
  paystackFee: number;
  total: number;
};

export function formatNaira(n: number): string {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** What comes off an amount of `charged` naira. */
export function computeFees(charged: number): Fees {
  const commission = charged * COMMISSION_RATE;
  const paystackFee = charged * PAYSTACK_RATE;
  return { commission, paystackFee, total: commission + paystackFee };
}

/** What the seller keeps out of an amount of `charged` naira. */
export function netFromCharged(charged: number): number {
  return charged - computeFees(charged).total;
}

// Rounding up rather than to nearest, and only ever by a fraction of a naira:
// the seller asked to receive a specific amount, so the error has to land in
// their favour, never leaving them a kobo short of the price they set.
function roundUpToKobo(n: number): number {
  return Math.ceil(n * 100) / 100;
}

/**
 * The inverse of `netFromCharged`: what the customer must be charged for the
 * seller to receive exactly `net`.
 *
 * This cannot be done by adding `computeFees(net).total` to the price. Both
 * fees are a share of the amount *charged*, not the amount received, so fees
 * computed on the net price are too small and the seller ends up short:
 * net = charged × (1 − 4.5%), so charged = net ÷ 0.955.
 */
export function grossUpForNet(net: number): number {
  if (!(net > 0)) return 0;
  // Rounded up, never down, so the error lands in the seller's favour.
  return roundUpToKobo(net / (1 - COMMISSION_RATE - PAYSTACK_RATE));
}

/**
 * Recover the amount the seller originally typed from the amount stored.
 *
 * `product_variants.price` always holds what the customer is charged, so that
 * every consumer — feed, storefront, cart, exports — reads one number and needs
 * to know nothing about fee policy. Re-opening the form has to undo that.
 *
 * Rounding DOWN is what keeps it stable. grossUpForNet rounds up by at most a
 * kobo, so the recovered net is at most a kobo high; rounding to nearest would
 * sometimes hand back that extra kobo, which would then be grossed up again on
 * the next save, and the price would creep upward once per edit.
 */
export function sellerEntryFromCharged(charged: number): number {
  return Math.floor(netFromCharged(charged) * 100) / 100;
}

export type PriceBreakdown = {
  /** What the customer is charged. */
  charged: number;
  /** What the seller receives after both fees. */
  net: number;
  fees: Fees;
};

/**
 * Resolve a seller's entered price into both sides of the transaction.
 *
 * `passFeesToBuyer` is the seller's choice of which number they typed:
 *   false — they typed what the customer pays, and absorb the fees.
 *   true  — they typed what they want to receive, and the customer is charged
 *           enough to cover both fees on top.
 */
export function resolvePrice(enteredPrice: number, passFeesToBuyer: boolean): PriceBreakdown {
  const charged = passFeesToBuyer ? grossUpForNet(enteredPrice) : enteredPrice;
  const fees = computeFees(charged);
  return { charged, net: charged - fees.total, fees };
}
