import { createFileRoute } from "@tanstack/react-router";
import { verifyPaystackSignature } from "@/lib/paystack.server";
import { settlePaystackPayment } from "@/lib/orders.server";

// Paystack calls this when a charge succeeds. The body is only trusted after
// its HMAC-SHA512 signature checks out against our secret key; an unsigned or
// forged call gets a 401 and changes nothing.
export const Route = createFileRoute("/api/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY ?? "";
        const raw = await request.text();
        if (!verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: { event?: string; data?: Record<string, unknown> };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        if (event.event === "charge.success" && event.data) {
          const result = await settlePaystackPayment({
            reference: String(event.data.reference ?? ""),
            amountKobo: Number(event.data.amount),
            currency: String(event.data.currency ?? ""),
          });
          console.log("paystack charge.success", event.data.reference, result);
        }
        // Always 200 for a valid signature so Paystack stops retrying; an
        // unknown reference is logged above, not an error to retry forever.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
