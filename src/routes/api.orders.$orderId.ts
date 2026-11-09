import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { getRequestUser } from "@/lib/server-auth";
import { verifyTransaction, paystackConfigured } from "@/lib/paystack.server";
import { settlePaystackPayment } from "@/lib/orders.server";
import { listOrderEvents, loadOrderPayment } from "@/lib/order-events.server";
import { buildTimeline, isOrderId, refundStateFor } from "@/lib/order-status";
import { latestPendingTopUpReference, loadTopUp } from "@/lib/delivery-topup.server";
import { isSelfDelivered } from "@/lib/self-delivery";

// One order, for the buyer who placed it: a signed-in owner, or a guest holding
// the guest_token from their link. Anything else is a 404 (never a 403, so ids
// can't be probed). While the order is still awaiting payment, the paystack
// reference is checked directly, so the page works even before the webhook lands.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export const Route = createFileRoute("/api/orders/$orderId")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { orderId: string } }) => {
        if (!isOrderId(params.orderId)) return json({ error: "Not found" }, 404);
        const token = new URL(request.url).searchParams.get("t");
        const user = await getRequestUser(request);

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select(
            "id, buyer_id, guest_token, status, items_total_kobo, delivery_fee_kobo, total_kobo, delivery_method, ship_to, courier_name, tracking_url, store_id, decline_reason, created_at, updated_at",
          )
          .eq("id", params.orderId)
          .maybeSingle();
        const isOwner = !!order && !!user && order.buyer_id === user.id;
        const hasToken = !!order && !!token && token === order.guest_token;
        if (!order || (!isOwner && !hasToken)) return json({ error: "Not found" }, 404);

        if (order.status === "awaiting_payment" && paystackConfigured()) {
          try {
            const v = await verifyTransaction(`ord_${order.id}`);
            if (v.status === "success") {
              const settled = await settlePaystackPayment({
                reference: v.reference,
                amountKobo: v.amountKobo,
                currency: v.currency,
              });
              // A mismatched amount is flagged, not paid -- don't tell the
              // buyer otherwise.
              if (settled === "settled" || settled === "already") order.status = "paid";
            }
          } catch {
            // Not paid yet, or Paystack unreachable: show the order as it is.
          }
        }

        // Back from paying the seller's extra delivery fee: settle it now
        // rather than waiting on the webhook, like the main payment above.
        if (
          isSelfDelivered(order.delivery_method) &&
          (order.status === "paid" || order.status === "shipped") &&
          paystackConfigured()
        ) {
          const ref = await latestPendingTopUpReference(order.id);
          if (ref) {
            try {
              const v = await verifyTransaction(ref);
              if (v.status === "success") {
                await settlePaystackPayment({
                  reference: v.reference,
                  amountKobo: v.amountKobo,
                  currency: v.currency,
                });
                // The fee was added to the order; read the new totals.
                const { data: fresh } = await supabaseAdmin
                  .from("orders")
                  .select("delivery_fee_kobo, total_kobo")
                  .eq("id", order.id)
                  .maybeSingle();
                if (fresh) Object.assign(order, fresh);
              }
            } catch {
              // Not paid (or never opened), or Paystack unreachable.
            }
          }
        }

        const [{ data: items }, { data: store }, payment, events, topUp] = await Promise.all([
          supabaseAdmin
            .from("order_items")
            .select("title, variant_label, image_url, unit_price_kobo, quantity")
            .eq("order_id", order.id),
          supabaseAdmin
            .from("stores")
            .select("brand_name, owner_id")
            .eq("id", order.store_id)
            .maybeSingle(),
          // After the verify above, so a payment it just settled reads as paid.
          loadOrderPayment(order.id),
          listOrderEvents(order.id),
          loadTopUp(order.id),
        ]);
        // The seller's personal username is what /messages?to= resolves, and
        // it's already public on their profile.
        const { data: owner } = store?.owner_id
          ? await supabaseAdmin
              .from("profiles")
              .select("personal_username")
              .eq("id", store.owner_id)
              .maybeSingle()
          : { data: null };

        const shipTo = (order.ship_to ?? {}) as { name?: string; address?: string };
        const refund = refundStateFor(order.status, payment?.status ?? null);
        return json({
          id: order.id,
          status: order.status,
          itemsKobo: order.items_total_kobo,
          deliveryKobo: order.delivery_fee_kobo,
          totalKobo: order.total_kobo,
          courierName: order.courier_name,
          selfDelivered: isSelfDelivered(order.delivery_method),
          // Extra delivery money the seller asked for after checkout. Payable
          // while the order is open (paid or on its way).
          deliveryTopUp: topUp,
          canPayTopUp:
            topUp?.status === "pending" &&
            (order.status === "paid" || order.status === "shipped") &&
            paystackConfigured(),
          trackingUrl: order.tracking_url,
          storeName: store?.brand_name ?? null,
          sellerUsername: owner?.personal_username ?? null,
          shipTo: { name: shipTo.name ?? "", address: shipTo.address ?? "" },
          items: items ?? [],
          createdAt: order.created_at,
          declineReason: order.decline_reason,
          refund,
          // An extra delivery fee paid on top goes back with the order.
          refundKobo:
            refund === "none"
              ? 0
              : (payment?.amount_kobo ?? order.total_kobo) +
                (topUp && topUp.status !== "pending" ? topUp.amountKobo : 0),
          timeline: buildTimeline({
            status: order.status,
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            paidAt: payment?.confirmed_at ?? null,
            paymentStatus: payment?.status ?? null,
            events,
          }),
          viewerIsBuyer: isOwner,
        });
      },
    },
  },
});
