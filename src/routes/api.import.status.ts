import { createFileRoute } from "@tanstack/react-router";

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
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 50);

        if (!jobId && !storeId) {
          return Response.json({ error: "jobId or storeId required" }, { status: 400 });
        }

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

          if (error) return Response.json({ error: error.message }, { status: 500 });
          if (!data) return Response.json({ error: "job not found" }, { status: 404 });

          return Response.json({ ...data, done: TERMINAL.has(data.status) });
        }

        const { data, error } = await supabase
          .from("import_jobs")
          .select(columns)
          .eq("store_id", storeId!)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) return Response.json({ error: error.message }, { status: 500 });

        return Response.json({
          jobs: (data ?? []).map((job) => ({ ...job, done: TERMINAL.has(job.status) })),
        });
      },
    },
  },
});
