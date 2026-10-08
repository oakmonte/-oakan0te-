import { createFileRoute } from "@tanstack/react-router";
import { requireOwnStore } from "@/lib/server-auth";
import { declineOrder } from "@/lib/order-decline.server";
import { composeDeclineReason, isOrderId } from "@/lib/order-status";

// Turns down a paid order that hasn't shipped: closes it with the seller's
// reason (the buyer sees it), returns the units to stock and refunds the
// buyer. Only the owning store can do it; the store comes from the session.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: PRIVATE });
}

export const Route = createFileRoute("/api/store/orders/$orderId/decline")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { orderId: string } }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) return auth.response;
        if (!isOrderId(params.orderId)) return json({ error: "Not found" }, 404);

        const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
        const reason = composeDeclineReason(
          null,
          typeof body?.reason === "string" ? body.reason : "",
        );
        if (!reason) {
          return json({ error: "Say why you're declining. The buyer sees it." }, 400);
        }

        const result = await declineOrder({
          orderId: params.orderId,
          storeId: auth.value.storeId,
          reason,
        });
        if (!result.ok) return json({ error: result.error }, result.status);
        return json({ ok: true, refund: result.refund.outcome });
      },
    },
  },
});
