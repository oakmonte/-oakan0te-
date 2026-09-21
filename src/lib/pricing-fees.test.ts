import { test, expect, describe } from "bun:test";
import {
  computeFees,
  sellerEntryFromCharged,
  grossUpForNet,
  netFromCharged,
  resolvePrice,
  PAYSTACK_FEE_CAP,
  PAYSTACK_FLAT_FEE_THRESHOLD,
} from "./pricing-fees";

describe("computeFees", () => {
  test("no flat fee below the threshold", () => {
    const fees = computeFees(2000);
    expect(fees.hasFlatFee).toBe(false);
    expect(fees.commission).toBeCloseTo(90);
    expect(fees.paystackFee).toBeCloseTo(30);
  });

  test("the flat fee applies from the threshold up", () => {
    const fees = computeFees(PAYSTACK_FLAT_FEE_THRESHOLD);
    expect(fees.hasFlatFee).toBe(true);
    expect(fees.paystackFee).toBeCloseTo(2500 * 0.015 + 100);
  });

  test("Paystack's fee stops at the cap", () => {
    const fees = computeFees(1_000_000);
    expect(fees.isCapped).toBe(true);
    expect(fees.paystackFee).toBe(PAYSTACK_FEE_CAP);
    // The commission is uncapped, so the total keeps climbing past it.
    expect(fees.commission).toBeCloseTo(45_000);
  });
});

describe("grossUpForNet", () => {
  // The bug this guards, and the whole reason the inverse exists: you cannot
  // pass fees on by adding computeFees(price) to the price. Both fees are
  // functions of the amount CHARGED, so fees worked out on the net price are
  // always too small and the seller quietly ends up short.
  test("adding the fee on the net price would leave the seller short", () => {
    const net = 10_000;
    const naive = net + computeFees(net).total;
    expect(netFromCharged(naive)).toBeLessThan(net);
    expect(grossUpForNet(net)).toBeGreaterThan(naive);
  });

  test("the seller receives at least what they asked for, across the range", () => {
    for (const net of [100, 999.99, 2_200, 2_350, 2_500, 10_000, 126_000, 200_000, 5_000_000]) {
      const charged = grossUpForNet(net);
      expect({ net, received: netFromCharged(charged) >= net - 0.01 }).toEqual({
        net,
        received: true,
      });
    }
  });

  test("never overcharges by more than a rounding kobo", () => {
    for (const net of [100, 2_400, 2_600, 10_000, 500_000]) {
      // Charging a kobo more than necessary is the accepted cost of rounding
      // in the seller's favour; anything beyond that is a broken solve.
      expect(netFromCharged(grossUpForNet(net)) - net).toBeLessThan(0.02);
    }
  });

  // Each regime is inverted separately, so each needs to be shown to land in
  // the regime it assumed. Solving the wrong branch yields a plausible number
  // that is simply wrong.
  test("picks the branch that is actually self-consistent", () => {
    expect(grossUpForNet(1_000)).toBeLessThan(PAYSTACK_FLAT_FEE_THRESHOLD);
    expect(grossUpForNet(10_000)).toBeGreaterThan(PAYSTACK_FLAT_FEE_THRESHOLD);
    expect(computeFees(grossUpForNet(5_000_000)).isCapped).toBe(true);
  });

  // The fee schedule steps by ₦100 at ₦2,500, so a narrow band of net amounts
  // is reachable either just under the threshold or well over it. The buyer
  // should be charged the smaller of the two.
  test("prefers the cheaper charge where two branches both hold", () => {
    const charged = grossUpForNet(2_300);
    expect(charged).toBeLessThan(PAYSTACK_FLAT_FEE_THRESHOLD);
  });

  test("a non-price is worth nothing, not NaN", () => {
    expect(grossUpForNet(0)).toBe(0);
    expect(grossUpForNet(-5)).toBe(0);
    expect(grossUpForNet(NaN)).toBe(0);
  });
});

describe("resolvePrice", () => {
  test("absorbed: the seller eats the fees out of the price they typed", () => {
    const { charged, net } = resolvePrice(10_000, false);
    expect(charged).toBe(10_000);
    expect(net).toBeLessThan(10_000);
  });

  test("passed on: the seller receives the price they typed", () => {
    const { charged, net } = resolvePrice(10_000, true);
    expect(charged).toBeGreaterThan(10_000);
    expect(net).toBeGreaterThanOrEqual(10_000 - 0.01);
  });

  // What the buyer is charged is what gets stored and shown, so the two modes
  // have to agree about which number that is.
  test("the two modes are inverses of one another", () => {
    const passedOn = resolvePrice(10_000, true);
    const absorbed = resolvePrice(passedOn.charged, false);
    expect(absorbed.net).toBeCloseTo(passedOn.net, 2);
  });
});

describe("sellerEntryFromCharged", () => {
  // product_variants.price stores what the CUSTOMER pays, so re-opening the
  // form has to undo the gross-up to show the seller their asking price again.
  test("hands back exactly what the seller typed", () => {
    for (const net of [100, 2_300, 2_500, 10_000, 126_000, 500_000]) {
      expect({ net, recovered: sellerEntryFromCharged(grossUpForNet(net)) }).toEqual({
        net,
        recovered: net,
      });
    }
  });

  // The failure this guards is a slow one: round to nearest instead of down and
  // the recovered price is sometimes a kobo high, which is then grossed up
  // again on the next save. Editing a product ten times would raise its price.
  test("does not creep when a product is edited repeatedly", () => {
    let charged = grossUpForNet(10_000);
    for (let i = 0; i < 10; i++) {
      charged = grossUpForNet(sellerEntryFromCharged(charged));
    }
    expect(sellerEntryFromCharged(charged)).toBe(10_000);
  });
});
