import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser, requireStoreOwner } from "@/lib/server-auth";

/**
 * Job status for the import UI to poll.
 *
 *   GET /api/import/status?jobId=...            one job
 *   GET /api/import/status?storeId=...&limit=10 recent jobs for a store
 *
 * The worker writes a terminal status on every path, so a job that stays
 * `running` past STALE_JOB_MINUTES gets reaped and failed rather than spinning
 * forever. The UI can treat `pending` and `running` as in-progress and
 * everything else as final.
 */

const TERMINAL = new Set(["succeeded", "failed", "partial", "done"]);

export const Route = createFileRoute("/api/import/status")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get("jobId");
        const storeId = url.searchParams.get("storeId");
        // Number("abc") is NaN, which PostgREST rejected with a parse error that
        // was then echoed straight back to the caller.
        const requested = Number(url.searchParams.get("limit") ?? 10);
        const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 50) : 10;

        if (!jobId && !storeId) {
          return Response.json({ error: "jobId or storeId required" }, { status: 400 });
        }

        // Runs on the service-role key, so RLS is bypassed and this check is
        // the only thing standing between a guessed id and another seller's
        // import history (which includes free-text error summaries).
        const user = await getRequestUser(request);
        if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

        const { supabaseAdmin: supabase } =
          await import("@/lib/integrations/my-supabase/client.server");

        // Selects every column rather than naming them.
        //
        // `result` arrives in migration 20260819120000_import_infrastructure.sql
        // and is absent from the generated types until they are regenerated —
        // naming it explicitly makes supabase-js reject the whole select. "*"
        // sidesteps that in both directions: it returns `result` at runtime the
        // moment the migration lands, without this file needing to change.
        //
        // Worth knowing when reading the response: `error` is the
        // human-readable summary for partial and succeeded runs too, not only
        // failures — it is the only free-text column on the row.
        const columns = "*";

        if (jobId) {
          const { data, error } = await supabase
            .from("import_jobs")
            .select(columns)
            .eq("id", jobId)
            .maybeSingle();

          if (error) {
            console.error("import status lookup failed", error);
            return Response.json({ error: "Could not load job" }, { status: 500 });
          }
          if (!data) return Response.json({ error: "job not found" }, { status: 404 });

          // Same 404 for "not yours" as for "doesn't exist", so job ids can't
          // be enumerated by comparing responses.
          const owns = await requireStoreOwner(request, data.store_id);
          if (!owns.ok) return Response.json({ error: "job not found" }, { status: 404 });

          return Response.json({ ...data, done: TERMINAL.has(data.status) });
        }

        const owns = await requireStoreOwner(request, storeId);
        if (!owns.ok) return owns.response;

        const { data, error } = await supabase
          .from("import_jobs")
          .select(columns)
          .eq("store_id", storeId!)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error)
          return (
            console.error("import status failed", error),
            Response.json({ error: "Something went wrong" }, { status: 500 })
          );

        return Response.json({
          jobs: (data ?? []).map((job) => ({ ...job, done: TERMINAL.has(job.status) })),
        });
      },
    },
  },
});
