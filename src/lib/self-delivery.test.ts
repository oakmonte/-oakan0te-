import { describe, expect, test } from "bun:test";
import {
  isSelfDelivered,
  isTopUpReference,
  orderIdFromTopUp,
  parseTopUpNaira,
  SELF_DELIVERY_METHOD,
  sellerPayoutKobo,
  topUpReference,
} from "./self-delivery";

describe("sellerPayoutKobo", () => {
  test("a courier order pays the items less 4.5%, never the delivery fee", () => {
    expect(
      sellerPayoutKobo({ itemsKobo: 2_000_000, deliveryKobo: 300_000, deliveryMethod: "courier" }),
    ).toBe(1_910_000);
  });

  test("a seller-delivered order adds the delivery fee less Paystack's 1.5%", () => {
    expect(
      sellerPayoutKobo({
        itemsKobo: 2_000_000,
        deliveryKobo: 300_000,
        deliveryMethod: SELF_DELIVERY_METHOD,
      }),
    ).toBe(1_910_000 + 295_500);
  });

  test("rounds down to the kobo", () => {
    expect(sellerPayoutKobo({ itemsKobo: 333, deliveryKobo: 333, deliveryMethod: "flat" })).toBe(
      Math.floor(333 * 0.955 + 333 * 0.985),
    );
  });
});

describe("delivery top-ups", () => {
  const orderId = "3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b";

  test("a top-up reference carries its order and is never the order's own", () => {
    const ref = topUpReference(orderId);
    expect(isTopUpReference(ref)).toBe(true);
    expect(orderIdFromTopUp(ref)).toBe(orderId);
    expect(isTopUpReference(`ord_${orderId}`)).toBe(false);
    expect(isTopUpReference(null)).toBe(false);
  });

  test("each attempt gets a new reference", () => {
    expect(topUpReference(orderId)).not.toBe(topUpReference(orderId));
  });

  test("parses whole naira within the limits", () => {
    expect(parseTopUpNaira("1,500")).toEqual({ ok: true, kobo: 150_000 });
    expect(parseTopUpNaira(2000)).toEqual({ ok: true, kobo: 200_000 });
    expect(parseTopUpNaira("12.5").ok).toBe(false);
    expect(parseTopUpNaira("50").ok).toBe(false);
    expect(parseTopUpNaira("2000000").ok).toBe(false);
    expect(parseTopUpNaira("").ok).toBe(false);
  });
});

test("only 'flat' reads as seller-delivered", () => {
  expect(isSelfDelivered("flat")).toBe(true);
  expect(isSelfDelivered("courier")).toBe(false);
  expect(isSelfDelivered("pickup")).toBe(false);
  expect(isSelfDelivered(null)).toBe(false);
});
