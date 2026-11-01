import { createFileRoute } from "@tanstack/react-router";
import { releaseOverdueOrders } from "@/lib/delivery-release.server";

// Daily (vercel.json "crons"): releases orders that shipped AUTO_RELEASE_DAYS
// ago with no delivery confirmation, so a missed courier webhook never holds a
// seller's money. Vercel calls it with "Authorization: Bearer $CRON_SECRET";
// without CRON_SECRET set in the project, it refuses everyone.
export const Route = createFileRoute("/api/cron/release-payouts")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const released = await releaseOverdueOrders();
        console.log("release-payouts: released", released);
        return Response.json({ released });
      },
    },
  },
});
