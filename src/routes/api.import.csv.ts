import { createFileRoute } from "@tanstack/react-router";
import { requireStoreOwner } from "@/lib/server-auth";
import type { Json } from "@/lib/integrations/my-supabase/types";

/**
 * Accepts a CSV upload, parks it on Bunny Storage, and enqueues an import job
 * for the worker to pick up.
 *
 * The upload lands here rather than going straight to the worker because the
 * worker is a Render Background Worker with no public URL, and because this
 * route is where the session already is. `import_jobs.file_path` then holds a
 * URL the worker can fetch — which is exactly what the existing Bumpa path
 * already assumes.
 *
 * POST multipart/form-data:
 *   file       the CSV                                    (required)
 *   storeId    uuid                                        (required)
 *   platform   'csv' | 'bumpa'                             (default 'csv')
 *   profile    force a CSV profile instead of detecting    (optional)
 *   columnMap  JSON object mapping canonical field -> column header (optional)
 */

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_PLATFORMS = new Set(["csv", "bumpa"]);

export const Route = createFileRoute("/api/import/csv")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
        const password = process.env.BUNNY_STORAGE_PASSWORD;
        const endpoint = process.env.BUNNY_STORAGE_ENDPOINT ?? "https://storage.bunnycdn.com";
        const pullZone = process.env.BUNNY_PULL_ZONE_HOSTNAME;

        if (!zone || !password || !pullZone) {
          console.error("CSV import: Bunny Storage is not configured");
          return Response.json({ error: "File storage is not configured" }, { status: 500 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }

        const file = form.get("file");
        const storeId = form.get("storeId");
        const platform = (form.get("platform") as string) ?? "csv";
        const profile = form.get("profile") as string | null;
        const columnMapRaw = form.get("columnMap") as string | null;

        if (!(file instanceof File)) {
          return Response.json({ error: "file is required" }, { status: 400 });
        }
        if (typeof storeId !== "string" || !storeId) {
          return Response.json({ error: "storeId is required" }, { status: 400 });
        }

        // Uploads a file to Bunny and enqueues a service-role import against
        // this store. Unauthenticated, anyone could push products into any
        // seller's catalogue and burn their storage quota.
        const owns = await requireStoreOwner(request, storeId);
        if (!owns.ok) return owns.response;
        if (!ALLOWED_PLATFORMS.has(platform)) {
          return Response.json(
            { error: `platform must be one of: ${[...ALLOWED_PLATFORMS].join(", ")}` },
            { status: 400 },
          );
        }
        if (file.size === 0) {
          return Response.json({ error: "File is empty" }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
          return Response.json(
            {
              error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB, over the ${MAX_BYTES / 1024 / 1024} MB limit`,
            },
            { status: 413 },
          );
        }

        let columnMap: Record<string, string> = {};
        if (columnMapRaw) {
          try {
            const parsed = JSON.parse(columnMapRaw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) columnMap = parsed;
          } catch {
            return Response.json({ error: "columnMap must be a JSON object" }, { status: 400 });
          }
        }

        // The path carries a uuid, so the URL is unguessable. It is still a
        // public URL — Bunny pull zones have no auth — which is the tradeoff
        // for letting the worker fetch it with a plain GET. Sellers' CSVs are
        // therefore protected by obscurity of the path, not by access control;
        // if that stops being acceptable, the fix is a signed URL on the pull
        // zone rather than moving the file.
        const uploadId = crypto.randomUUID();
        const safeName = (file.name || "import.csv").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
        const remotePath = `imports/${storeId}/${uploadId}/${safeName}`;

        const uploadRes = await fetch(`${endpoint.replace(/\/+$/, "")}/${zone}/${remotePath}`, {
          method: "PUT",
          headers: { AccessKey: password, "Content-Type": "application/octet-stream" },
          body: file.stream(),
          // @ts-expect-error — required by undici whenever the body is a stream
          duplex: "half",
        });

        if (!uploadRes.ok) {
          const body = await uploadRes.text().catch(() => "");
          console.error("Bunny upload failed:", uploadRes.status, body.slice(0, 300));
          return Response.json({ error: "Could not store the uploaded file" }, { status: 502 });
        }

        const fileUrl = `https://${pullZone}/${remotePath}`;

        const { supabaseAdmin: supabase } =
          await import("@/lib/integrations/my-supabase/client.server");

        const metadata: Record<string, unknown> = {};
        if (profile) metadata.profile = profile;
        if (Object.keys(columnMap).length > 0) metadata.columnMap = columnMap;
        // Route a Bumpa upload through the new engine explicitly; the legacy
        // mapper stays the default for jobs created anywhere else.
        if (platform === "bumpa" && profile) metadata.engine = "universal";

        const jobPayload = {
          store_id: storeId,
          platform,
          status: "pending",
          file_path: fileUrl,
          metadata: metadata as Json,
        };

        const { data: job, error } = await supabase
          .from("import_jobs")
          .insert(jobPayload)
          .select("id, status, created_at")
          .single();

        if (error) {
          console.error("Failed to create import job:", error.message);
          return (
            console.error("csv import failed", error),
            Response.json({ error: "Something went wrong" }, { status: 500 })
          );
        }

        return Response.json({ jobId: job.id, status: job.status, fileUrl }, { status: 202 });
      },
    },
  },
});
