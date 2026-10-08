import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requireOwnStore } from "@/lib/server-auth";
import { shipbubble } from "@/lib/shipping.server";
import { recordOrderEvent } from "@/lib/order-events.server";

// Books the courier for a paid order, from Oakmonte's Shipbubble wallet. Only
// the owning store can do it, only while the order is paid and not yet booked,
// and the booking details are the ones saved on the order at checkout.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

export const Route = createFileRoute("/api/store/orders/$orderId/ship")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { orderId: string } }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) return auth.response;

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select(
            "id, status, store_id, shipbubble_request_token, courier_service_code, courier_id, shipbubble_order_id",
          )
          .eq("id", params.orderId)
          .eq("store_id", auth.value.storeId)
          .maybeSingle();
        // Someone else's order looks exactly like one that doesn't exist.
        if (!order) return Response.json({ error: "Not found" }, { status: 404 });
        if (order.status !== "paid" || order.shipbubble_order_id) {
          return Response.json(
            { error: "This order isn't waiting to be shipped." },
            { status: 409, headers: PRIVATE },
          );
        }
        if (!order.shipbubble_request_token || !order.courier_service_code || !order.courier_id) {
          return Response.json({ error: "This order has no courier on it." }, { status: 422 });
        }

        try {
          const label = await shipbubble("/shipping/labels", {
            method: "POST",
            body: JSON.stringify({
              request_token: order.shipbubble_request_token,
              service_code: order.courier_service_code,
              courier_id: order.courier_id,
            }),
          });
          const { data: shipped, error } = await supabaseAdmin
            .from("orders")
            .update({
              status: "shipped",
              shipbubble_order_id: String(label.order_id ?? ""),
              tracking_url: typeof label.tracking_url === "string" ? label.tracking_url : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id)
            .eq("status", "paid")
            .select("id");
          if (error) throw error;
          if (shipped?.length) {
            // Kept separately because updated_at moves on again at delivery;
            // this is the only record of when it shipped.
            await recordOrderEvent(order.id, "shipped", String(label.order_id ?? "") || null);
          } else {
            // The order left "paid" (declined) while the label was being
            // bought. The courier is booked and paid for regardless.
            console.error(
              "courier booked for an order that is no longer paid",
              order.id,
              label.order_id,
            );
          }
          return Response.json({ ok: true }, { headers: PRIVATE });
        } catch (err) {
          console.error("ship order failed", err);
          return Response.json(
            {
              error:
                "Couldn't book the courier. The delivery quote may have expired or the shipping wallet needs topping up.",
            },
            { status: 502, headers: PRIVATE },
          );
        }
      },
    },
  },
});
