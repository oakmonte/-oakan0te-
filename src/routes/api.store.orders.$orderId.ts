import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requireOwnStore } from "@/lib/server-auth";
import { listOrderEvents, loadOrderPayment } from "@/lib/order-events.server";
import { buildTimeline, isOrderId, refundStateFor } from "@/lib/order-status";
import { paystackConfigured } from "@/lib/paystack.server";
import { planRefund } from "@/lib/refunds.server";

// One of the caller's own store's orders, with everything the seller's order
// screen shows: items, who it goes to, delivery, money, the timeline and which
// actions are still open. Scoped by the session's store, so another store's
// order is a 404 exactly like a made-up id.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: PRIVATE });
}

export const Route = createFileRoute("/api/store/orders/$orderId")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { orderId: string } }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) {
          // No store on this account: there is no order of theirs to find.
          if (auth.response.status === 403) return json({ error: "Not found" }, 404);
          return auth.response;
        }
        if (!isOrderId(params.orderId)) return json({ error: "Not found" }, 404);

        const { data: order, error } = await supabaseAdmin
          .from("orders")
          .select(
            "id, buyer_id, status, items_total_kobo, delivery_fee_kobo, platform_fee_kobo, total_kobo, delivery_method, ship_to, courier_name, courier_service_code, courier_id, shipbubble_request_token, shipbubble_order_id, tracking_url, decline_reason, created_at, updated_at",
          )
          .eq("id", params.orderId)
          .eq("store_id", auth.value.storeId)
          .maybeSingle();
        if (error) {
          console.error("store order read failed", error);
          return json({ error: "Couldn't load this order" }, 500);
        }
        if (!order) return json({ error: "Not found" }, 404);

        const [{ data: items }, payment, events, { data: buyer }] = await Promise.all([
          supabaseAdmin
            .from("order_items")
            .select("title, variant_label, image_url, unit_price_kobo, quantity")
            .eq("order_id", order.id),
          loadOrderPayment(order.id),
          listOrderEvents(order.id),
          order.buyer_id
            ? supabaseAdmin
                .from("profiles")
                .select("personal_username")
                .eq("id", order.buyer_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const shipTo = (order.ship_to ?? {}) as { name?: string; phone?: string; address?: string };
        const open = order.status === "paid" && !order.shipbubble_order_id;
        const hasCourier = Boolean(
          order.shipbubble_request_token && order.courier_service_code && order.courier_id,
        );
        const refundNote =
          [...events]
            .reverse()
            .find((e) => e.kind === "refund_manual" || e.kind === "refund_started")?.note ?? null;

        return json({
          id: order.id,
          status: order.status,
          createdAt: order.created_at,
          itemsKobo: order.items_total_kobo,
          deliveryKobo: order.delivery_fee_kobo,
          platformFeeKobo: order.platform_fee_kobo,
          totalKobo: order.total_kobo,
          deliveryMethod: order.delivery_method,
          shipTo: {
            name: shipTo.name ?? "",
            phone: shipTo.phone ?? "",
            address: shipTo.address ?? "",
          },
          courierName: order.courier_name,
          shipbubbleOrderId: order.shipbubble_order_id,
          trackingUrl: order.tracking_url,
          declineReason: order.decline_reason,
          buyerUsername: buyer?.personal_username ?? null,
          isGuest: !order.buyer_id,
          payment: payment
            ? {
                method: payment.method,
                status: payment.status,
                amountKobo: payment.amount_kobo,
                confirmedAt: payment.confirmed_at,
              }
            : null,
          refund: refundStateFor(order.status, payment?.status ?? null),
          refundNote,
          timeline: buildTimeline({
            status: order.status,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            paidAt: payment?.confirmed_at ?? null,
            paymentStatus: payment?.status ?? null,
            events,
          }),
          items: items ?? [],
          canShip: open && hasCourier,
          // Without courier details the order can still be turned down; it
          // just can't be booked from here.
          shipBlockedReason: open && !hasCourier ? "This order has no courier on it." : null,
          canDecline: open,
          // How a decline would return the money, so the confirm sheet can say
          // so before the seller commits rather than after.
          declineRefund: open ? planRefund(payment, paystackConfigured()).kind : null,
        });
      },
    },
  },
});
