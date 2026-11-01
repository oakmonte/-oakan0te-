import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { getRequestUser } from "@/lib/server-auth";
import { isOrderId } from "@/lib/order-status";
import { markDelivered } from "@/lib/delivery-release.server";

// The buyer's "I've received it": marks a shipped order delivered, which
// releases the seller's payout (delivery-release.server.ts). Same access rule
// as the order page -- the signed-in buyer, or a guest holding the order's
// guest_token -- and anyone else gets a 404, never a 403, so ids can't be probed.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export const Route = createFileRoute("/api/orders/$orderId/received")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { orderId: string } }) => {
        if (!isOrderId(params.orderId)) return json({ error: "Not found" }, 404);
        const token = new URL(request.url).searchParams.get("t");
        const user = await getRequestUser(request);

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, buyer_id, guest_token, status")
          .eq("id", params.orderId)
          .maybeSingle();
        const isOwner = !!order && !!user && order.buyer_id === user.id;
        const hasToken = !!order && !!token && token === order.guest_token;
        if (!order || (!isOwner && !hasToken)) return json({ error: "Not found" }, 404);

        if (order.status === "delivered") return json({ ok: true });
        if (order.status !== "shipped") {
          return json({ error: "This order hasn't been sent yet." }, 409);
        }
        const done = await markDelivered(order.id, "Confirmed by the buyer");
        return done ? json({ ok: true }) : json({ error: "Couldn't update this order." }, 409);
      },
    },
  },
});
