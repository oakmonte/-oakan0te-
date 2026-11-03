import { createFileRoute } from "@tanstack/react-router";

/**
 * Instagram webhook endpoint. Meta's Instagram Business Login setup will not
 * let an app move past "Configure webhooks" without a callback URL that passes
 * its verification handshake, so this exists to answer that handshake.
 *
 * Nothing subscribes to events yet: POST acknowledges and drops them. If a
 * feature ever acts on these events, verify `X-Hub-Signature-256` (HMAC-SHA256
 * of the raw body with IG_APP_SECRET) before trusting the payload.
 */
export const Route = createFileRoute("/api/instagram/webhook")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.IG_WEBHOOK_VERIFY_TOKEN;

        if (mode === "subscribe" && expected && token === expected && challenge) {
          return new Response(challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async () => new Response("OK", { status: 200 }),
    },
  },
});
