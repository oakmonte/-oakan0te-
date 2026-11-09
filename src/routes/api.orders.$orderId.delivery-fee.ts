import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { getRequestUser } from "@/lib/server-auth";
import { isOrderId } from "@/lib/order-status";
import { initializeTransaction, paystackConfigured } from "@/lib/paystack.server";
import { startTopUpAttempt } from "@/lib/delivery-topup.server";

// The buyer paying the extra delivery fee a self-delivering seller asked for
// (self-delivery.ts). Same access rule as the order page -- the signed-in
// buyer, or a guest holding the guest_token -- and anyone else gets a 404.
// Returns a Paystack page to send them to; the amount is the seller's request
// as stored, never a number from the browser.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export const Route = createFileRoute("/api/orders/$orderId/delivery-fee")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { orderId: string } }) => {
        if (!isOrderId(params.orderId)) return json({ error: "Not found" }, 404);
        const token = new URL(request.url).searchParams.get("t");
        const user = await getRequestUser(request);

        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, buyer_id, guest_token, guest_email, status")
          .eq("id", params.orderId)
          .maybeSingle();
        const isOwner = !!order && !!user && order.buyer_id === user.id;
        const hasToken = !!order && !!token && token === order.guest_token;
        if (!order || (!isOwner && !hasToken)) return json({ error: "Not found" }, 404);

        if (order.status !== "paid" && order.status !== "shipped") {
          return json({ error: "This order can't take a payment now." }, 409);
        }
        if (!paystackConfigured()) {
          return json({ error: "Payments aren't available right now. Try again later." }, 503);
        }
        const attempt = await startTopUpAttempt(order.id);
        if (!attempt) return json({ error: "There's nothing extra to pay on this order." }, 409);

        const origin = new URL(request.url).origin;
        try {
          const init = await initializeTransaction({
            email: user?.email ?? order.guest_email ?? "orders@oakmonte.store",
            amountKobo: attempt.amountKobo,
            reference: attempt.reference,
            callbackUrl: `${origin}/order/${order.id}?t=${order.guest_token}`,
            metadata: { orderId: order.id, kind: "delivery_top_up" },
          });
          return json({ authorizationUrl: init.authorizationUrl });
        } catch (err) {
          console.error("top-up initialize failed", order.id, err);
          return json({ error: "Couldn't open the payment. Try again in a moment." }, 502);
        }
      },
    },
  },
});
