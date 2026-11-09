import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requireOwnStore } from "@/lib/server-auth";
import { recordOrderEvent } from "@/lib/order-events.server";
import { isOrderId } from "@/lib/order-status";
import { createTopUpRequest } from "@/lib/delivery-topup.server";
import { parseTopUpNaira, SELF_DELIVERY_METHOD } from "@/lib/self-delivery";

// The seller delivering a paid order themselves instead of booking the courier
// (see self-delivery.ts). Two actions:
//
//   { action: "dispatch" }  it's on its way. The order moves to shipped, and
//       from there it's released exactly like a courier order: the buyer taps
//       "I've received it", or it auto-releases (delivery-release.server.ts).
//       The seller can't mark it delivered themselves -- that would release
//       their own escrow.
//   { action: "request_fee", naira }  ask the buyer for more delivery money
//       first. Commits the order to self-delivery (no courier booking after
//       this), and the buyer pays the extra from their order page.
//
// Only the owning store, only while the order is paid and no courier was
// booked. Another store's order is a 404, like a made-up id.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: PRIVATE });
}

export const Route = createFileRoute("/api/store/orders/$orderId/self-deliver")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { orderId: string } }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) {
          if (auth.response.status === 403) return json({ error: "Not found" }, 404);
          return auth.response;
        }
        if (!isOrderId(params.orderId)) return json({ error: "Not found" }, 404);
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const action = body?.action;
        if (action !== "dispatch" && action !== "request_fee") {
          return json({ error: "Bad request" }, 400);
        }

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, shipbubble_order_id")
          .eq("id", params.orderId)
          .eq("store_id", auth.value.storeId)
          .maybeSingle();
        if (!order) return json({ error: "Not found" }, 404);
        if (order.status !== "paid" || order.shipbubble_order_id) {
          return json({ error: "This order isn't waiting to be sent." }, 409);
        }

        if (action === "request_fee") {
          const fee = parseTopUpNaira(body?.naira);
          if (!fee.ok) return json({ error: fee.error }, 400);
          const { data: committed, error } = await supabaseAdmin
            .from("orders")
            .update({ delivery_method: SELF_DELIVERY_METHOD, courier_name: null })
            .eq("id", order.id)
            .eq("status", "paid")
            .is("shipbubble_order_id", null)
            .select("id");
          if (error || !committed?.length) {
            return json({ error: "This order isn't waiting to be sent." }, 409);
          }
          const created = await createTopUpRequest(order.id, fee.kobo);
          if (!created) {
            return json({ error: "You've already asked the buyer for more on this order." }, 409);
          }
          return json({ ok: true });
        }

        const { data: shipped, error } = await supabaseAdmin
          .from("orders")
          .update({
            status: "shipped",
            delivery_method: SELF_DELIVERY_METHOD,
            courier_name: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "paid")
          .is("shipbubble_order_id", null)
          .select("id");
        if (error) {
          console.error("self-deliver dispatch failed", order.id, error);
          return json({ error: "Couldn't update this order. Try again." }, 500);
        }
        if (!shipped?.length) return json({ error: "This order isn't waiting to be sent." }, 409);
        await recordOrderEvent(order.id, "shipped", "Delivering it themselves");
        return json({ ok: true });
      },
    },
  },
});
