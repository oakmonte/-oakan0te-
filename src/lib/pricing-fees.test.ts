import { test, expect, describe } from "bun:test";
import {
  computeFees,
  sellerEntryFromCharged,
  grossUpForNet,
  netFromCharged,
  resolvePrice,
} from "./pricing-fees";

describe("computeFees", () => {
  test("a flat 4.5%: 3% Oakmonte + 1.5% Paystack, at any price", () => {
    for (const price of [500, 2000, 2500, 20_000, 1_000_000]) {
      const fees = computeFees(price);
      expect(fees.commission).toBeCloseTo(price * 0.03);
      expect(fees.paystackFee).toBeCloseTo(price * 0.015);
      expect(fees.total).toBeCloseTo(price * 0.045);
    }
  });

  test("₦20,000 costs ₦900", () => {
    expect(computeFees(20_000).total).toBeCloseTo(900);
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
    for (const net of [100, 999.99, 2_500, 10_000, 126_000, 5_000_000]) {
      const charged = grossUpForNet(net);
      expect({ net, received: netFromCharged(charged) >= net - 0.01 }).toEqual({
        net,
        received: true,
      });
    }
  });

  test("never overcharges by more than a rounding kobo", () => {
    for (const net of [100, 2_600, 10_000, 500_000]) {
      // Charging a kobo more than necessary is the accepted cost of rounding
      // in the seller's favour; anything beyond that is a broken solve.
      expect(netFromCharged(grossUpForNet(net)) - net).toBeLessThan(0.02);
    }
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
    for (const net of [100, 2_500, 10_000, 126_000, 500_000]) {
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
