import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { untypedTable } from "@/lib/integrations/my-supabase/untyped";
import { pickOrderPayment } from "@/lib/order-status";

// The order timeline's event log (order_events, migration
// 20261008126000_orders.sql). Written and read only here, with the service role.
//
// Until that migration is applied the table doesn't exist, and every call below
// degrades instead of failing the action it rides along with: a decline or a
// courier booking must never fail because its log line couldn't be written.
// The timeline falls back to the order's own timestamps (see buildTimeline).

export type OrderEventKind =
  | "shipped"
  | "delivered"
  | "declined"
  | "cancelled"
  | "refund_started"
  | "refund_manual";

export type OrderEvent = { kind: OrderEventKind; note: string | null; at: string };

export async function recordOrderEvent(
  orderId: string,
  kind: OrderEventKind,
  note: string | null = null,
): Promise<void> {
  try {
    const { error } = await untypedTable(supabaseAdmin, "order_events").insert({
      order_id: orderId,
      kind,
      note: note ? note.slice(0, 1000) : null,
    });
    if (error) console.error("order event not recorded", orderId, kind, error.message);
  } catch (err) {
    console.error("order event not recorded", orderId, kind, err);
  }
}

export async function listOrderEvents(orderId: string): Promise<OrderEvent[]> {
  try {
    const { data, error } = await untypedTable(supabaseAdmin, "order_events")
      .select("kind, note, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) return [];
    return (
      (data ?? []) as { kind: OrderEventKind; note: string | null; created_at: string }[]
    ).map((e) => ({ kind: e.kind, note: e.note, at: e.created_at }));
  } catch {
    return [];
  }
}

/** The payment behind one order (see pickOrderPayment for which one). */
export async function loadOrderPayment(orderId: string) {
  const { data } = await supabaseAdmin
    .from("order_payments")
    .select("id, method, status, reference, amount_kobo, confirmed_at, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  return pickOrderPayment(data ?? []);
}

/** The same choice for many orders at once, for the list screens: order id ->
 *  that payment's status. Orders with no payment row are simply absent. */
export async function loadPaymentStatuses(orderIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (orderIds.length === 0) return out;
  const { data } = await supabaseAdmin
    .from("order_payments")
    .select("order_id, status, created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });
  const byOrder = new Map<string, { status: string }[]>();
  for (const p of data ?? []) byOrder.set(p.order_id, [...(byOrder.get(p.order_id) ?? []), p]);
  for (const [orderId, rows] of byOrder) {
    const picked = pickOrderPayment(rows);
    if (picked) out.set(orderId, picked.status);
  }
  return out;
}
