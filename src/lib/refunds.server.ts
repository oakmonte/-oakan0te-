import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { paystackConfigured } from "@/lib/paystack.server";
import { loadOrderPayment, recordOrderEvent } from "@/lib/order-events.server";

// Gives a buyer their money back when an order closes after they paid.
//
// Oakmonte collects every payment (Paystack, on Oakmonte's account), so a
// refund is always Oakmonte's to send. When Paystack can do it, it does; when
// it can't -- no key on this server, a bank-transfer payment, or Paystack
// refusing -- the refund is recorded as owed and someone sends it by hand.
// Either way the order page shows where the money stands, because the refund
// state is derived from the payment row (see refundStateFor), not from
// whether this function got to the end.

export type RefundPlan =
  | { kind: "none" }
  | { kind: "paystack"; paymentId: string; reference: string }
  | { kind: "manual"; paymentId: string; reason: string };

type PaymentLike = {
  id: string;
  method: string;
  status: string;
  reference: string | null;
};

/** What to do about a payment once its order is declined. Pure, so the
 *  decision is testable without Paystack or a database. */
export function planRefund(payment: PaymentLike | null, paystackReady: boolean): RefundPlan {
  // Nothing was taken (still pending, failed) or it's already been returned.
  if (!payment || payment.status !== "confirmed") return { kind: "none" };
  if (payment.method !== "paystack") {
    return { kind: "manual", paymentId: payment.id, reason: "Paid by bank transfer" };
  }
  if (!payment.reference) {
    return {
      kind: "manual",
      paymentId: payment.id,
      reason: "No Paystack reference on the payment",
    };
  }
  if (!paystackReady) {
    return { kind: "manual", paymentId: payment.id, reason: "Paystack isn't connected" };
  }
  return { kind: "paystack", paymentId: payment.id, reference: payment.reference };
}

export type PaystackRefundResult = { ok: true; status: string } | { ok: false; message: string };

/** POST /refund for the whole transaction. Never throws: a refund that can't
 *  be started is a state to record, not an error to bubble up through a
 *  decline that has already happened. `fetchImpl` is for tests only. */
export async function requestPaystackRefund(
  reference: string,
  opts: { secretKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<PaystackRefundResult> {
  const secretKey = opts.secretKey ?? process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { ok: false, message: "Paystack isn't connected" };
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      // No amount: a decline returns everything, delivery included, because no
      // courier was ever booked.
      body: JSON.stringify({ transaction: reference }),
    });
    const payload = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { status?: string };
    } | null;
    if (!res.ok || !payload?.status) {
      return { ok: false, message: payload?.message ?? `Paystack ${res.status}` };
    }
    // Paystack queues refunds ("pending" / "processing"); one it has already
    // marked failed is not a refund.
    const status = String(payload.data?.status ?? "pending");
    if (status === "failed") return { ok: false, message: payload.message ?? "Refund failed" };
    return { ok: true, status };
  } catch (err) {
    console.error("paystack refund request failed", err);
    return { ok: false, message: "Couldn't reach Paystack" };
  }
}

export type RefundOutcome = { outcome: "refunded" | "manual" | "none"; note?: string };

/** Refunds the payment behind an order that has just been declined. */
export async function refundOrderPayment(orderId: string): Promise<RefundOutcome> {
  const payment = await loadOrderPayment(orderId);
  const plan = planRefund(payment, paystackConfigured());
  if (plan.kind === "none") return { outcome: "none" };

  if (plan.kind === "manual") {
    console.error("manual refund needed", orderId, plan.reason);
    await recordOrderEvent(orderId, "refund_manual", plan.reason);
    return { outcome: "manual", note: plan.reason };
  }

  const result = await requestPaystackRefund(plan.reference);
  if (!result.ok) {
    console.error("manual refund needed", orderId, result.message);
    await recordOrderEvent(orderId, "refund_manual", `Paystack refused: ${result.message}`);
    return { outcome: "manual", note: result.message };
  }

  // Only now, with Paystack holding the refund, does the payment say so.
  const { error } = await supabaseAdmin
    .from("order_payments")
    .update({ status: "refunded" })
    .eq("id", plan.paymentId)
    .eq("status", "confirmed");
  if (error) {
    // The money is on its way back but the row still says confirmed, so the
    // order reads "refund pending". Leave a trail for whoever reconciles it --
    // retrying the refund would be refused by Paystack anyway.
    console.error("refund sent but payment row not updated", orderId, error);
    await recordOrderEvent(
      orderId,
      "refund_started",
      `Paystack accepted the refund (${result.status}); payment row not updated`,
    );
    return { outcome: "refunded" };
  }
  await recordOrderEvent(orderId, "refund_started", `Paystack refund ${result.status}`);
  return { outcome: "refunded" };
}
