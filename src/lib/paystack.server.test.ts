import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyPaystackSignature, verifyShipbubbleSignature } from "./paystack.server";

const secret = "sk_test_example";
const body = JSON.stringify({
  event: "charge.success",
  data: { reference: "ord_1", amount: 3000000 },
});
const sign = (b: string, k: string) => createHmac("sha512", k).update(b).digest("hex");

describe("webhook signatures", () => {
  test("accepts a correctly signed body", () => {
    expect(verifyPaystackSignature(body, sign(body, secret), secret)).toBe(true);
    expect(verifyShipbubbleSignature(body, sign(body, secret), secret)).toBe(true);
  });

  test("rejects a tampered body", () => {
    const tampered = body.replace("3000000", "1");
    expect(verifyPaystackSignature(tampered, sign(body, secret), secret)).toBe(false);
  });

  test("rejects the wrong key, a missing signature and an empty secret", () => {
    expect(verifyPaystackSignature(body, sign(body, "other"), secret)).toBe(false);
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackSignature(body, sign(body, ""), "")).toBe(false);
  });

  test("rejects a signature of the wrong length without throwing", () => {
    expect(verifyPaystackSignature(body, "abc", secret)).toBe(false);
  });
});
