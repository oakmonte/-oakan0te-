import { createFileRoute } from "@tanstack/react-router";
import { requireStoreOwner } from "@/lib/server-auth";
import type { Json } from "@/lib/integrations/my-supabase/types";

/**
 * Enqueues a credential-based catalogue pull — Shopify (OAuth token) or Bumpa
 * (API key). The counterpart to api.import.csv.ts, which enqueues a file.
 *
 * There is nothing to upload here: the credential already lives in
 * store_credentials, so the job row carries only the platform, and the worker
 * reads the credential itself with the service-role key. That is deliberate —
 * a token must never make the round trip out to the browser and back just to
 * be handed to the worker.
 *
 * POST application/json:
 *   storeId    uuid                              (required)
 *   platform   'shopify' | 'bumpa-api'           (required)
 *   dryRun     plan and report, write nothing    (optional)
 */

// 'bumpa-api' rather than 'bumpa': the existing 'bumpa' platform is a CSV
// upload path despite the name, and reusing it would route an API pull into
// the CSV engine, which would then fail on a job with no file_path.
const ALLOWED_PLATFORMS = new Set(["shopify", "bumpa-api"]);

const CREDENTIAL_COLUMN: Record<string, string> = {
  shopify: "shopify_access_token",
  "bumpa-api": "bumpa_api_key",
};

export const Route = createFileRoute("/api/import/start")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { storeId?: string; platform?: string; dryRun?: boolean };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const { storeId, platform, dryRun } = body;

        if (!storeId || !platform) {
          return Response.json({ error: "storeId and platform are required" }, { status: 400 });
        }
        if (!ALLOWED_PLATFORMS.has(platform)) {
          return Response.json(
            { error: `platform must be one of: ${[...ALLOWED_PLATFORMS].join(", ")}` },
            { status: 400 },
          );
        }

        // Enqueues work that runs as the service role against this store's
        // rows. Unauthenticated, anyone could make someone else's store import
        // — and, for Shopify, spend their API rate limit.
        const owns = await requireStoreOwner(request, storeId);
        if (!owns.ok) return owns.response;

        const { supabaseAdmin: supabase } =
          await import("@/lib/integrations/my-supabase/client.server");

        // Checked here rather than left to the worker so the seller finds out
        // now, in the UI they are standing in, instead of via a job that fails
        // a minute later for a reason they have to go looking for.
        const column = CREDENTIAL_COLUMN[platform];
        const { data: credentials, error: credentialsError } = await supabase
          .from("store_credentials")
          .select(column)
          .eq("store_id", storeId)
          .maybeSingle();

        if (credentialsError) {
          console.error("import start: credential lookup failed", credentialsError.message);
          return Response.json({ error: "Something went wrong" }, { status: 500 });
        }

        if (!credentials?.[column as keyof typeof credentials]) {
          return Response.json(
            {
              error:
                platform === "shopify"
                  ? "Connect Shopify before importing."
                  : "Connect Bumpa before importing.",
            },
            { status: 409 },
          );
        }

        // One running import per store per platform. Without this, tapping the
        // button twice runs the same catalogue walk twice against the same
        // rows — harmless for correctness (the reconciliation key makes the
        // second run an update) but it burns the platform's rate limit and
        // makes the job list unreadable.
        const { data: inFlight } = await supabase
          .from("import_jobs")
          .select("id, status")
          .eq("store_id", storeId)
          .eq("platform", platform)
          .in("status", ["pending", "running"])
          .limit(1)
          .maybeSingle();

        if (inFlight) {
          return Response.json(
            { jobId: inFlight.id, status: inFlight.status, alreadyRunning: true },
            { status: 202 },
          );
        }

        const metadata: Record<string, unknown> = {};
        if (dryRun) metadata.dryRun = true;

        const { data: job, error } = await supabase
          .from("import_jobs")
          .insert({
            store_id: storeId,
            platform,
            status: "pending",
            metadata: metadata as Json,
          })
          .select("id, status")
          .single();

        if (error) {
          console.error("import start: failed to create job", error.message);
          return Response.json({ error: "Something went wrong" }, { status: 500 });
        }

        return Response.json({ jobId: job.id, status: job.status }, { status: 202 });
      },
    },
  },
});
