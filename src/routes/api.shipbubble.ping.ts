import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";

export const Route = createFileRoute("/api/shipbubble/ping")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // This handler spends the project's Shipbubble API key on behalf of
        // whoever calls it. Unauthenticated, anyone could burn the vendor
        // quota in a loop and read back the upstream error body to probe
        // whether the key is still live.
        const user = await getRequestUser(request);
        if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

        const res = await fetch("https://api.shipbubble.com/v1/shipping/labels/boxes", {
          headers: {
            Authorization: `Bearer ${process.env.SHIPBUBBLE_API_KEY}`,
          },
        });

        if (!res.ok) {
          const body = await res.text();
          // The upstream body is vendor account state — log it, don't echo it.
          console.error("Shipbubble ping failed:", res.status, body);
          return Response.json({ error: "Shipbubble auth failed" }, { status: 502 });
        }

        const data = await res.json();
        return Response.json({ success: true, data });
      },
    },
  },
});
