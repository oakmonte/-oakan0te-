import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { payOutOrder } from "@/lib/payouts.server";
import { recordOrderEvent } from "@/lib/order-events.server";

// How an order becomes "delivered", and with it the seller's payout. Three
// ways, the norm for a marketplace that holds the money until delivery:
//
//   1. Shipbubble says the courier completed it (api.shipbubble.webhook).
//   2. The buyer taps "I've received it" (api.orders.$orderId.received).
//   3. Nobody said anything: AUTO_RELEASE_DAYS after it shipped, it's released
//      (api.cron.release-payouts, daily). Without this a webhook that never
//      arrives would hold a seller's money forever.
//
// Every path goes through markDelivered, and only the call that actually
// moves shipped -> delivered pays out, so two of them racing can't pay twice.

/** Days after shipping before a quiet order is released to the seller. */
export const AUTO_RELEASE_DAYS = 7;

/** Moves one shipped order to delivered and pays the seller. False when the
 *  order wasn't "shipped" (already delivered, declined, or never shipped). */
export async function markDelivered(orderId: string, note: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ status: "delivered", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "shipped")
    .select("id");
  if (error) {
    console.error("markDelivered failed", orderId, error);
    return false;
  }
  if (!data?.length) return false;
  await recordOrderEvent(orderId, "delivered", note);
  await payOutOrder(orderId);
  return true;
}

/** Releases every order that has sat in "shipped" for AUTO_RELEASE_DAYS. An
 *  order's updated_at only moves on a status change, so it marks when it
 *  shipped. Returns how many were released. */
export async function releaseOverdueOrders(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("status", "shipped")
    .lt("updated_at", cutoff.toISOString())
    .limit(200);
  if (error) {
    console.error("releaseOverdueOrders: lookup failed", error);
    return 0;
  }
  let released = 0;
  for (const { id } of data ?? []) {
    if (await markDelivered(id, `Released automatically ${AUTO_RELEASE_DAYS} days after shipping`))
      released++;
  }
  return released;
}
