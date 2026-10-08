import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { recordOrderEvent } from "@/lib/order-events.server";
import { refundOrderPayment, type RefundOutcome } from "@/lib/refunds.server";

// A seller turning down a paid order: close it, put the units back, return the
// money. The caller has already resolved storeId from the session.

export type DeclineResult =
  | { ok: true; refund: RefundOutcome }
  | { ok: false; status: 404 | 409 | 500; error: string };

export async function declineOrder(input: {
  orderId: string;
  storeId: string;
  reason: string;
}): Promise<DeclineResult> {
  const { orderId, storeId, reason } = input;

  const { data: order, error: readErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, shipbubble_order_id")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (readErr) {
    console.error("decline: order read failed", readErr);
    return { ok: false, status: 500, error: "Couldn't decline the order. Try again." };
  }
  // Someone else's order looks exactly like one that doesn't exist.
  if (!order) return { ok: false, status: 404, error: "Not found" };
  if (order.status !== "paid" || order.shipbubble_order_id) {
    return {
      ok: false,
      status: 409,
      error: "This order can't be declined any more. It has already shipped or closed.",
    };
  }

  // Claim the order first, conditionally, so a decline and a courier booking
  // racing each other can't both win: whichever write lands second matches no
  // row. Everything after this runs exactly once per order.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("orders")
    .update({ status: "declined", decline_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("store_id", storeId)
    .eq("status", "paid")
    .is("shipbubble_order_id", null)
    .select("id");
  if (claimErr) {
    console.error("decline: claim failed", claimErr);
    return { ok: false, status: 500, error: "Couldn't decline the order. Try again." };
  }
  if (!claimed?.length) {
    return {
      ok: false,
      status: 409,
      error: "This order can't be declined any more. It has already shipped or closed.",
    };
  }

  await recordOrderEvent(orderId, "declined", reason);
  // Stock before money: a lost restock is invisible, whereas an unsent refund
  // still shows as owed on both order pages (refundStateFor).
  await restockOrderItems(orderId);
  const refund = await refundOrderPayment(orderId);
  return { ok: true, refund };
}

/** Puts a declined order's units back on the shelf -- the mirror of the stock
 *  settlePaystackPayment took out when the order was paid. Same read-then-write
 *  shape as that function (there is no increment RPC), and variants without
 *  stock tracking (stock_qty null) are skipped there and here alike. */
async function restockOrderItems(orderId: string) {
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("variant_id, quantity")
    .eq("order_id", orderId);
  for (const it of items ?? []) {
    if (!it.variant_id) continue;
    const { data: v } = await supabaseAdmin
      .from("product_variants")
      .select("stock_qty")
      .eq("id", it.variant_id)
      .maybeSingle();
    if (!v || v.stock_qty == null) continue;
    const { error } = await supabaseAdmin
      .from("product_variants")
      .update({ stock_qty: v.stock_qty + it.quantity })
      .eq("id", it.variant_id);
    if (error) console.error("decline: restock failed", orderId, it.variant_id, error);
  }
}
