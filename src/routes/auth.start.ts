import { createFileRoute } from "@tanstack/react-router";
import { MY_SUPABASE_URL } from "@/lib/integrations/my-supabase/config";

// Why this route exists at all.
//
// iOS presents a cross-origin navigation out of an installed web app as a
// modal browser sheet. The sheet shares the app's storage jar -- so the PKCE
// round trip does complete -- but it has no access to the platform
// authenticator, so a passkey-first Google account is offered a QR code or a
// security key and nothing else. A seller who signs in with a passkey has no
// working route through that screen, and "tap the X, then find Try another
// way" is not a sign-in flow.
//
// iOS only intercepts the navigation the page itself initiates. It follows
// redirects in the same webview. Supabase's authorize URL is cross-origin, so
// sending the browser there directly is always the intercepted hop -- but
// sending it HERE is same-origin, and the 302 out of here is a redirect. The
// flow then stays in the app's own webview, which is Safari's engine with
// WebAuthn intact, and Face ID works.
//
// SECURITY: `to` comes from the client, which makes this an open redirect
// unless it is pinned. It is pinned to exactly one prefix -- this project's
// Supabase authorize endpoint. An open redirect on the domain that also serves
// /auth/callback is a credible phishing primitive, not a lint-level concern:
// the link would carry a real oakmonte.store origin.
const AUTHORIZE_PREFIX = `${MY_SUPABASE_URL}/auth/v1/authorize?`;

export const Route = createFileRoute("/auth/start")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const to = new URL(request.url).searchParams.get("to");

        if (!to || !to.startsWith(AUTHORIZE_PREFIX)) {
          return new Response("Invalid sign-in target", {
            status: 400,
            headers: { "Cache-Control": "no-store" },
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: to,
            // The URL carries a single-use PKCE challenge. Nothing about it
            // should survive in a cache or a shared proxy.
            "Cache-Control": "no-store, private",
          },
        });
      },
    },
  },
});
