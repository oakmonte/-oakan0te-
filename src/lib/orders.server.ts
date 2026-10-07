import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";

// Settles an order from a confirmed Paystack payment. Called from the signed
// webhook and from the return-page verify; both can fire for one payment, so
// it must be idempotent: the second caller finds the payment already confirmed
// and does nothing.
export async function settlePaystackPayment(input: {
  reference: string;
  amountKobo: number;
  currency: string;
}): Promise<"settled" | "already" | "mismatch" | "unknown"> {
  const { data: payment } = await supabaseAdmin
    .from("order_payments")
    .select("id, order_id, amount_kobo, status")
    .eq("method", "paystack")
    .eq("reference", input.reference)
    .maybeSingle();
  if (!payment) return "unknown";
  if (payment.status === "confirmed") return "already";

  // The amount Paystack actually took must match what we asked for; anything
  // else is flagged, never silently accepted as a paid order.
  if (input.currency !== "NGN" || input.amountKobo !== payment.amount_kobo) {
    console.error("paystack amount mismatch", input, payment);
    await supabaseAdmin.from("order_payments").update({ status: "failed" }).eq("id", payment.id);
    return "mismatch";
  }

  // Claim the payment first (only while still pending) so a concurrent second
  // delivery loses the race instead of double-settling.
  const { data: claimed } = await supabaseAdmin
    .from("order_payments")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return "already";

  await supabaseAdmin
    .from("orders")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", payment.order_id)
    .eq("status", "awaiting_payment");

  // Take the unit(s) out of stock now that it is paid.
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("variant_id, quantity")
    .eq("order_id", payment.order_id);
  for (const it of items ?? []) {
    if (!it.variant_id) continue;
    const { data: v } = await supabaseAdmin
      .from("product_variants")
      .select("stock_qty, continue_selling_out_of_stock")
      .eq("id", it.variant_id)
      .maybeSingle();
    if (v && v.stock_qty != null) {
      await supabaseAdmin
        .from("product_variants")
        .update({ stock_qty: Math.max(0, v.stock_qty - it.quantity) })
        .eq("id", it.variant_id);
    }
  }
  return "settled";
}
