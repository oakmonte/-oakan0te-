import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/shipbubble/ping")({
  server: {
    handlers: {
      GET: async () => {
        const res = await fetch("https://api.shipbubble.com/v1/shipping/labels/boxes", {
          headers: {
            Authorization: `Bearer ${process.env.SHIPBUBBLE_API_KEY}`,
          },
        });

        if (!res.ok) {
          const body = await res.text();
          console.error("Shipbubble ping failed:", res.status, body);
          return Response.json({ error: "Shipbubble auth failed", detail: body }, { status: 401 });
        }

        const data = await res.json();
        return Response.json({ success: true, data });
      },
    },
  },
});
