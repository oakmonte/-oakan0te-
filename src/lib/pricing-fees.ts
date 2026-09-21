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
export const COMMISSION_RATE = 0.045;

// Paystack's standard Nigerian local-card pricing. VERIFY AGAINST THE LIVE
// PAYSTACK DASHBOARD BEFORE LAUNCH — these are the published rates, and
// Paystack is not actually wired yet (POSTPONED.md §1.5). A negotiated or
// international rate would change all four numbers.
export const PAYSTACK_RATE = 0.015;
export const PAYSTACK_FLAT_FEE = 100;
export const PAYSTACK_FLAT_FEE_THRESHOLD = 2500;
export const PAYSTACK_FEE_CAP = 2000;

export type Fees = {
  commission: number;
  paystackFee: number;
  /** Whether the ₦100 applied, so the UI can label the rate honestly. */
  hasFlatFee: boolean;
  /** Whether Paystack's fee hit its ceiling. */
  isCapped: boolean;
  total: number;
};

export function formatNaira(n: number): string {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** What comes off an amount of `charged` naira. */
export function computeFees(charged: number): Fees {
  const commission = charged * COMMISSION_RATE;
  const hasFlatFee = charged >= PAYSTACK_FLAT_FEE_THRESHOLD;
  const raw = charged * PAYSTACK_RATE + (hasFlatFee ? PAYSTACK_FLAT_FEE : 0);
  const isCapped = raw > PAYSTACK_FEE_CAP;
  const paystackFee = isCapped ? PAYSTACK_FEE_CAP : raw;
  return { commission, paystackFee, hasFlatFee, isCapped, total: commission + paystackFee };
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
 * fees are functions of the amount *charged*, not the amount received, so fees
 * computed on the net price are always too small — and the seller quietly ends
 * up short. It has to be solved.
 *
 * Three regimes, because Paystack's fee is piecewise:
 *   A  charged < ₦2,500          no flat fee      net = 0.940·charged
 *   B  flat fee applies, uncapped                 net = 0.940·charged − 100
 *   C  Paystack's fee is capped                   net = 0.955·charged − 2,000
 *
 * Each is inverted directly, then every candidate is checked with the FORWARD
 * calculation and the cheapest survivor wins. Taking the first survivor is not
 * enough: at ₦500,000 the uncapped branch does leave the seller whole, because
 * the real fee turns out lower than that branch assumed — while overcharging
 * the buyer by nearly ₦6,000. The minimum is the only defensible answer, and
 * it also settles the ₦2,500 boundary, where the ₦100 step makes a narrow band
 * of net amounts reachable two ways.
 */
export function grossUpForNet(net: number): number {
  if (!(net > 0)) return 0;

  const rateAfterBoth = 1 - COMMISSION_RATE - PAYSTACK_RATE;

  const candidates = [
    // A — under the flat-fee threshold.
    net / rateAfterBoth,
    // B — flat fee applies, still under the cap.
    (net + PAYSTACK_FLAT_FEE) / rateAfterBoth,
    // C — Paystack's fee is pinned at the cap, so it behaves as a constant.
    (net + PAYSTACK_FEE_CAP) / (1 - COMMISSION_RATE),
  ];

  // Trust the forward calculation, not the algebra: a branch is only a real
  // answer if charging it actually leaves the seller whole. A kobo of slack
  // absorbs the rounding up.
  const viable = candidates
    .map(roundUpToKobo)
    .filter((charged) => netFromCharged(charged) >= net - 0.01);

  if (viable.length === 0) {
    // Unreachable for any positive net, but returning something coherent beats
    // putting NaN into a price field.
    return roundUpToKobo(candidates[candidates.length - 1]);
  }

  return Math.min(...viable);
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
