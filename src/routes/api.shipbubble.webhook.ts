import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { verifyShipbubbleSignature } from "@/lib/paystack.server";

// Shipbubble tells us when a shipment moves. Trusted only after its HMAC-SHA512
// signature (keyed with our API key) checks out. A completed shipment marks the
// order delivered; everything else is acknowledged and ignored for now.
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
            await supabaseAdmin
              .from("orders")
              .update({ status: "delivered", updated_at: new Date().toISOString() })
              .eq("shipbubble_order_id", shipbubbleOrderId)
              .eq("status", "shipped");
          }
          console.log("shipbubble status", shipbubbleOrderId, status);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
