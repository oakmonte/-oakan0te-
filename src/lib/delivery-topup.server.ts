import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requestPaystackRefund } from "@/lib/refunds.server";
import { isTopUpReference, topUpReference } from "@/lib/self-delivery";

// The extra delivery money a self-delivering seller asks for after checkout
// (see self-delivery.ts). Stored as order_payments rows with a dlv_ reference:
// the seller's request is the first pending row, and every "Pay" tap by the
// buyer adds another pending row with a fresh reference (Paystack won't
// initialise one reference twice). Whichever settles first is applied; a
// second one settling means the buyer paid twice, and it goes straight back.

export type TopUp = {
  amountKobo: number;
  status: "pending" | "paid" | "refunded";
};

type Row = {
  id: string;
  amount_kobo: number;
  status: string;
  reference: string | null;
  created_at: string;
};

async function topUpRows(orderId: string): Promise<Row[]> {
  const { data } = await supabaseAdmin
    .from("order_payments")
    .select("id, amount_kobo, status, reference, created_at")
    .eq("order_id", orderId)
    .eq("method", "paystack")
    .like("reference", "dlv%")
    .order("created_at", { ascending: false });
  return (data ?? []).filter((r) => isTopUpReference(r.reference));
}

/** Where the order's extra delivery fee stands, or null if none was asked. */
export async function loadTopUp(orderId: string): Promise<TopUp | null> {
  const rows = await topUpRows(orderId);
  const paid = rows.find((r) => r.status === "confirmed");
  if (paid) return { amountKobo: paid.amount_kobo, status: "paid" };
  const refunded = rows.find((r) => r.status === "refunded");
  if (refunded) return { amountKobo: refunded.amount_kobo, status: "refunded" };
  const pending = rows.find((r) => r.status === "pending");
  return pending ? { amountKobo: pending.amount_kobo, status: "pending" } : null;
}

/** The seller's request. One per order: false if one already exists. */
export async function createTopUpRequest(orderId: string, amountKobo: number): Promise<boolean> {
  if ((await topUpRows(orderId)).length > 0) return false;
  const { error } = await supabaseAdmin.from("order_payments").insert({
    order_id: orderId,
    method: "paystack",
    amount_kobo: amountKobo,
    status: "pending",
    reference: topUpReference(orderId),
  });
  if (error) {
    console.error("top-up request insert failed", orderId, error);
    return false;
  }
  return true;
}

/** A new pending attempt for the buyer to pay, at the requested amount. Null
 *  when nothing is owed (none asked, or already paid/refunded). */
export async function startTopUpAttempt(
  orderId: string,
): Promise<{ reference: string; amountKobo: number } | null> {
  const topUp = await loadTopUp(orderId);
  if (!topUp || topUp.status !== "pending") return null;
  const reference = topUpReference(orderId);
  const { error } = await supabaseAdmin.from("order_payments").insert({
    order_id: orderId,
    method: "paystack",
    amount_kobo: topUp.amountKobo,
    status: "pending",
    reference,
  });
  if (error) {
    console.error("top-up attempt insert failed", orderId, error);
    return null;
  }
  return { reference, amountKobo: topUp.amountKobo };
}

/** The newest pending attempt's reference, for the order page to check with
 *  Paystack when the buyer comes back from paying. */
export async function latestPendingTopUpReference(orderId: string): Promise<string | null> {
  const rows = await topUpRows(orderId);
  if (rows.some((r) => r.status === "confirmed")) return null;
  return rows.find((r) => r.status === "pending")?.reference ?? null;
}

async function sendBack(paymentId: string, reference: string, why: string) {
  const result = await requestPaystackRefund(reference);
  if (result.ok) {
    await supabaseAdmin
      .from("order_payments")
      .update({ status: "refunded" })
      .eq("id", paymentId)
      .eq("status", "confirmed");
  } else {
    console.error("top-up refund needed by hand", reference, why, result.message);
  }
}

/** Called by settlePaystackPayment once it has claimed a top-up payment
 *  (pending -> confirmed). Adds it to the order, or sends it back when the
 *  order no longer wants it. */
export async function applyTopUpPayment(payment: {
  id: string;
  order_id: string;
  amount_kobo: number;
  reference: string;
}): Promise<void> {
  const rows = await topUpRows(payment.order_id);
  if (rows.some((r) => r.status === "confirmed" && r.id !== payment.id)) {
    // Paid on two Paystack pages: keep the first.
    await sendBack(payment.id, payment.reference, "paid twice");
    return;
  }
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("status, delivery_fee_kobo, total_kobo")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (!order || order.status === "declined" || order.status === "cancelled") {
    await sendBack(payment.id, payment.reference, "order closed");
    return;
  }
  // updated_at is left alone on purpose: on a shipped order it marks when it
  // shipped, which the auto-release clock counts from.
  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      delivery_fee_kobo: order.delivery_fee_kobo + payment.amount_kobo,
      total_kobo: order.total_kobo + payment.amount_kobo,
    })
    .eq("id", payment.order_id);
  if (error) console.error("top-up not added to order", payment.order_id, error);
  if (order.status === "delivered") {
    // The payout went out before this landed; the seller's extra is owed by hand.
    console.error("delivery top-up paid after payout", payment.order_id, payment.amount_kobo);
  }
}
