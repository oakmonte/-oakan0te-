import { createFileRoute } from "@tanstack/react-router";
import { paystackConfigured } from "@/lib/paystack.server";

// Whether checkout can actually finish, asked once as checkout opens. Buying
// can be switched on (VITE_LAUNCH_UNLOCKED) before the payment and courier
// keys are in, and a buyer shouldn't learn that only after typing a whole
// address. Two booleans, no account detail: public on purpose.
export const Route = createFileRoute("/api/checkout/status")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            payments: paystackConfigured(),
            delivery: Boolean(process.env.SHIPBUBBLE_API_KEY),
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
