import { describe, expect, test } from "bun:test";
import { planRefund, requestPaystackRefund } from "./refunds.server";

const paid = { id: "p1", method: "paystack", status: "confirmed", reference: "ord_1" };

describe("planRefund", () => {
  test("a confirmed Paystack payment goes back through Paystack when it's connected", () => {
    expect(planRefund(paid, true)).toEqual({
      kind: "paystack",
      paymentId: "p1",
      reference: "ord_1",
    });
  });

  test("without a Paystack key the refund is recorded as owed, by hand", () => {
    expect(planRefund(paid, false)).toMatchObject({ kind: "manual", paymentId: "p1" });
  });

  test("a bank-transfer payment, or one with no reference, is refunded by hand", () => {
    expect(planRefund({ ...paid, method: "transfer" }, true).kind).toBe("manual");
    expect(planRefund({ ...paid, reference: null }, true).kind).toBe("manual");
  });

  test("nothing to refund when no money was taken or it's already back", () => {
    expect(planRefund(null, true)).toEqual({ kind: "none" });
    expect(planRefund({ ...paid, status: "pending" }, true)).toEqual({ kind: "none" });
    expect(planRefund({ ...paid, status: "failed" }, true)).toEqual({ kind: "none" });
    expect(planRefund({ ...paid, status: "refunded" }, true)).toEqual({ kind: "none" });
  });
});

// A stand-in fetch that records the request and answers with `reply`. No
// network: these never leave the process.
function fakeFetch(reply: { status: number; body: unknown } | Error) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  return { impl, calls };
}

describe("requestPaystackRefund", () => {
  test("asks for a full refund of the transaction by reference", async () => {
    const f = fakeFetch({
      status: 200,
      body: {
        status: true,
        message: "Refund has been queued for processing",
        data: { status: "pending" },
      },
    });
    const result = await requestPaystackRefund("ord_1", {
      secretKey: "sk_test_x",
      fetchImpl: f.impl,
    });
    expect(result).toEqual({ ok: true, status: "pending" });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe("https://api.paystack.co/refund");
    expect(f.calls[0].init?.method).toBe("POST");
    // No amount: everything goes back, delivery included.
    expect(JSON.parse(String(f.calls[0].init?.body))).toEqual({ transaction: "ord_1" });
    expect(new Headers(f.calls[0].init?.headers).get("Authorization")).toBe("Bearer sk_test_x");
  });

  test("a refusal comes back as a message, not a throw", async () => {
    const f = fakeFetch({
      status: 400,
      body: { status: false, message: "Transaction has been fully reversed" },
    });
    expect(await requestPaystackRefund("ord_1", { secretKey: "k", fetchImpl: f.impl })).toEqual({
      ok: false,
      message: "Transaction has been fully reversed",
    });
  });

  test("a refund Paystack already marks failed is not a success", async () => {
    const f = fakeFetch({ status: 200, body: { status: true, data: { status: "failed" } } });
    const result = await requestPaystackRefund("ord_1", { secretKey: "k", fetchImpl: f.impl });
    expect(result.ok).toBe(false);
  });

  test("a network failure or a non-JSON reply is reported, not thrown", async () => {
    const down = fakeFetch(new Error("ECONNRESET"));
    expect(
      (await requestPaystackRefund("ord_1", { secretKey: "k", fetchImpl: down.impl })).ok,
    ).toBe(false);
    const html = (async () =>
      new Response("<html>502</html>", { status: 502 })) as unknown as typeof fetch;
    expect(await requestPaystackRefund("ord_1", { secretKey: "k", fetchImpl: html })).toEqual({
      ok: false,
      message: "Paystack 502",
    });
  });

  test("no key means no request at all", async () => {
    const f = fakeFetch({ status: 200, body: { status: true } });
    const result = await requestPaystackRefund("ord_1", { secretKey: "", fetchImpl: f.impl });
    expect(result.ok).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
});
