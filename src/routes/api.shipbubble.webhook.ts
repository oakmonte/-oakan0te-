import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { verifyShipbubbleSignature } from "@/lib/paystack.server";
import { payOutOrder } from "@/lib/payouts.server";

// Shipbubble tells us when a shipment moves. Trusted only after its HMAC-SHA512
// signature (keyed with our API key) checks out. A completed shipment marks the
// order delivered and releases the seller's payout (Oakmonte holds the money
// until then); everything else is acknowledged and ignored for now.
export const Route = createFileRoute("/api/shipbubble/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.SHIPBUBBLE_API_KEY ?? "";
        const raw = await request.text();
        if (!verifyShipbubbleSignature(raw, request.headers.get("x-ship-signature"), key)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { event?: string; data?: Record<string, unknown> };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const data = event.data ?? {};
        const shipbubbleOrderId = String(data.order_id ?? "");
        const status = String(data.status ?? "");
        if (event.event === "shipment.status.changed" && shipbubbleOrderId) {
          if (status === "completed") {
            // Only the call that actually moves shipped -> delivered pays the
            // seller, so a repeated webhook can't start a second payout.
            const { data: delivered } = await supabaseAdmin
              .from("orders")
              .update({ status: "delivered", updated_at: new Date().toISOString() })
              .eq("shipbubble_order_id", shipbubbleOrderId)
              .eq("status", "shipped")
              .select("id");
            for (const o of delivered ?? []) await payOutOrder(o.id);
          }
          console.log("shipbubble status", shipbubbleOrderId, status);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
