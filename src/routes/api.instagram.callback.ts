import { createFileRoute } from "@tanstack/react-router";
import { encryptField, fieldContext } from "@/lib/field-encryption.server";
import { GRAPH_BASE, GRAPH_HOST } from "@/lib/instagram-graph";

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

/**
 * Which Instagram account did the seller connect? Unified login's token can
 * be a Facebook user token or a business system-user token, and each exposes
 * the Instagram account differently, so try each shape in turn. Ids are read
 * as strings: Graph returns them quoted, and 17-19 digit ids lose precision
 * as JSON numbers.
 */
async function findInstagramUserId(token: string): Promise<string | null> {
  const get = async (path: string) => {
    const res = await fetch(`${GRAPH_BASE}${path}&access_token=${encodeURIComponent(token)}`);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) console.warn("Instagram account lookup failed:", path, res.status, body);
    return res.ok ? body : null;
  };
  type Row = { id?: string; instagram_business_account?: { id?: string } };

  // Facebook Pages the seller manages, each with its linked Instagram account.
  const pages = await get("/me/accounts?fields=instagram_business_account");
  const viaPage = ((pages?.data as Row[] | undefined) ?? []).find(
    (p) => p.instagram_business_account?.id,
  );
  if (viaPage?.instagram_business_account?.id) return String(viaPage.instagram_business_account.id);

  // Instagram accounts assigned through a business portfolio.
  const assigned = await get("/me/assigned_instagram_accounts?fields=id");
  const first = ((assigned?.data as Row[] | undefined) ?? [])[0];
  if (first?.id) return String(first.id);

  // "Continue with Instagram": /me may be the Instagram account itself.
  const me = await get("/me?fields=id,username");
  if (me?.username && me.id) return String(me.id);

  console.error("Instagram callback: no Instagram account on this token", { pages, assigned, me });
  return null;
}

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

        // ---- exchange the code for a token (unified login) -----------------
        // Unified login codes exchange on graph.facebook.com; the old
        // api.instagram.com endpoint rejects them. See src/lib/instagram-graph.ts.
        const tokenRes = await fetch(
          `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
            client_id: appId,
            client_secret: secret,
            redirect_uri: redirectUri,
            code,
          }).toString()}`,
        );
        const tokenData = (await tokenRes.json().catch(() => ({}))) as {
          access_token?: string;
          expires_in?: number;
        };

        if (!tokenRes.ok || !tokenData.access_token) {
          console.error("Instagram token exchange failed:", tokenRes.status, tokenData);
          return fail("token exchange failed");
        }

        let accessToken = tokenData.access_token;
        let expiresIn = tokenData.expires_in ?? null;

        // ---- upgrade a short-lived token -----------------------------------
        // Unified login often returns a token that never expires (no
        // expires_in). When it is short-lived (hours), swap it for a ~60-day
        // one: the worker's media pull runs later and re-runs weeks later.
        if (expiresIn !== null && expiresIn < 24 * 60 * 60) {
          const longLivedRes = await fetch(
            `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
              grant_type: "fb_exchange_token",
              client_id: appId,
              client_secret: secret,
              fb_exchange_token: accessToken,
            }).toString()}`,
          );
          const longLived = (await longLivedRes.json().catch(() => ({}))) as {
            access_token?: string;
            expires_in?: number;
          };
          if (longLivedRes.ok && longLived.access_token) {
            accessToken = longLived.access_token;
            expiresIn = longLived.expires_in ?? null;
          } else {
            // Not fatal: the short-lived token still covers an import queued now.
            console.warn("Instagram long-lived exchange failed", longLivedRes.status, longLived);
          }
        }
        const expiresAt =
          expiresIn !== null ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

        // ---- find the seller's Instagram professional account --------------
        const instagramUserId = await findInstagramUserId(accessToken);
        if (!instagramUserId) {
          return fail("no Instagram professional account found on this login");
        }

        const { supabaseAdmin: supabase } =
          await import("@/lib/integrations/my-supabase/client.server");

        // Stored encrypted; see field-encryption.server.ts.
        let sealedToken: string;
        try {
          sealedToken = await encryptField(accessToken, fieldContext.instagramAccessToken(storeId));
        } catch (err) {
          console.error("Instagram callback: could not encrypt token", err);
          return fail("could not save the Instagram connection");
        }

        const credentialsPayload = {
          store_id: storeId,
          instagram_user_id: instagramUserId,
          instagram_access_token: sealedToken,
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
          // Unified login tokens only work on graph.facebook.com; the worker
          // must call that host (not graph.instagram.com) with this token.
          metadata: { graph_host: GRAPH_HOST },
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
