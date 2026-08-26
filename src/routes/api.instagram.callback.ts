import { createFileRoute } from "@tanstack/react-router";

/**
 * Step 2 of the Instagram connect flow.
 *
 * Exchanges the code for a token, upgrades it to a long-lived one, stores it,
 * and enqueues an import job. It deliberately does NOT pull any media.
 *
 * The previous implementation (oakmonte-backend/ig-mmu/ig-server.js) downloaded
 * every post and uploaded it to Bunny inside this request. That fails two ways:
 * the short-lived token expires in an hour, and a seller with a few hundred
 * posts sits on a hanging redirect for minutes with no progress and no way to
 * retry. Handing the work to import_jobs makes the redirect instant and the
 * work resumable.
 */
async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const APP_URL = "https://oakmonte.store";

function fail(reason: string) {
  return Response.redirect(
    `${APP_URL}/store/products?instagram=error&reason=${encodeURIComponent(reason)}`,
    302,
  );
}

export const Route = createFileRoute("/api/instagram/callback")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        // The seller pressed Cancel on Instagram's consent screen.
        if (error) {
          console.log("Instagram OAuth declined:", error, errorDescription);
          return fail(errorDescription ?? error);
        }

        if (!code || !state) return fail("missing code or state");

        const secret = process.env.IG_APP_SECRET;
        const appId = process.env.IG_APP_ID;
        const redirectUri = process.env.IG_REDIRECT_URI;

        if (!secret || !appId || !redirectUri) {
          console.error("Instagram callback: missing app credentials");
          return fail("Instagram is not configured");
        }

        const [storeId, providedSig] = state.split(".");
        if (!storeId || !providedSig) return fail("invalid state");
        if ((await hmacHex(secret, storeId)) !== providedSig)
          return fail("state verification failed");

        // ---- exchange the code for a short-lived token ---------------------
        const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: appId,
            client_secret: secret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
          }),
        });

        const rawText = await tokenRes.text();

        let tokenData: { access_token?: string };
        try {
          tokenData = JSON.parse(rawText);
        } catch {
          console.error("Instagram token exchange returned non-JSON:", rawText.slice(0, 300));
          return fail("token exchange failed");
        }

        if (!tokenRes.ok || !tokenData.access_token) {
          console.error("Instagram token exchange failed:", tokenRes.status, rawText.slice(0, 300));
          return fail("token exchange failed");
        }

        // user_id comes back as a BARE NUMBER in this response, unlike every
        // other Instagram id. It is 17-19 digits, so JSON.parse has already
        // rounded it by the time we could read tokenData.user_id —
        // 17912345678901234 becomes ...232, nothing throws, and the worker
        // then queries media for an account that does not exist. Pull it out
        // of the raw body as a string instead.
        const userIdMatch = rawText.match(/"user_id":\s*"?(\d+)"?/);
        const instagramUserId = userIdMatch?.[1] ?? null;

        if (!instagramUserId) {
          console.error("Instagram token exchange had no user_id:", rawText.slice(0, 300));
          return fail("no Instagram user id returned");
        }

        // ---- upgrade to a long-lived (60 day) token ------------------------
        // The short-lived token expires in an hour. The media pull happens in
        // the worker, minutes to hours later, and re-runs weeks later — so the
        // stored token has to be the long-lived one.
        let accessToken = tokenData.access_token;
        let expiresAt: string | null = null;

        const longLivedRes = await fetch(
          `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(accessToken)}`,
        );
        const longLived = (await longLivedRes.json().catch(() => ({}))) as {
          access_token?: string;
          expires_in?: number;
        };

        if (longLivedRes.ok && longLived.access_token) {
          accessToken = longLived.access_token;
          expiresAt = new Date(Date.now() + (longLived.expires_in ?? 0) * 1000).toISOString();
        } else {
          // Not fatal — the short-lived token still works for about an hour, so
          // an import queued now will succeed. It just will not survive a
          // retry tomorrow.
          console.warn(
            "Instagram long-lived exchange failed, storing short-lived token",
            longLivedRes.status,
          );
        }

        const { supabaseAdmin: supabase } =
          await import("@/lib/integrations/my-supabase/client.server");

        const credentialsPayload = {
          store_id: storeId,
          instagram_user_id: instagramUserId,
          instagram_access_token: accessToken,
          instagram_token_expires_at: expiresAt,
          instagram_connected_at: new Date().toISOString(),
        };

        const { error: credentialsError } = await supabase
          .from("store_credentials")
          .upsert(credentialsPayload, { onConflict: "store_id" });

        if (credentialsError) {
          console.error("Failed to store Instagram credentials:", credentialsError.message);
          return fail("could not save the Instagram connection");
        }

        // ---- enqueue the media pull ---------------------------------------
        const jobPayload = {
          store_id: storeId,
          platform: "instagram",
          status: "pending",
          metadata: {},
        };

        const { data: job, error: jobError } = await supabase
          .from("import_jobs")
          .insert(jobPayload)
          .select("id")
          .single();

        if (jobError) {
          // The connection itself succeeded, so say so rather than implying
          // the whole thing failed — the seller can trigger an import again
          // without reconnecting.
          console.error("Failed to enqueue Instagram import:", jobError.message);
          return Response.redirect(
            `${APP_URL}/store/products?instagram=connected&import=failed`,
            302,
          );
        }

        return Response.redirect(
          `${APP_URL}/store/products?instagram=connected&job=${job.id}`,
          302,
        );
      },
    },
  },
});
