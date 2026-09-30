import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { insertSupportMessage, isSupportTool, type ChatDb } from "@/lib/chat/chat.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/support-messages/reply")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!(await isSupportTool(request))) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await getRequestUser(request);
        if (!user) {
          return Response.json({ error: "Not signed in" }, { status: 401 });
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
        }

        const targetUserId =
          typeof payload === "object" && payload !== null && "user_id" in payload
            ? payload.user_id
            : undefined;
        const body =
          typeof payload === "object" && payload !== null && "body" in payload
            ? payload.body
            : undefined;

        if (typeof targetUserId !== "string" || !UUID_PATTERN.test(targetUserId)) {
          return Response.json({ error: "user_id must be a valid UUID" }, { status: 400 });
        }
        if (typeof body !== "string") {
          return Response.json({ error: "body must be a string" }, { status: 400 });
        }

        const trimmedBody = body.trim();
        if (trimmedBody.length < 1 || trimmedBody.length > 4000) {
          return Response.json(
            { error: "body must contain between 1 and 4000 characters" },
            { status: 400 },
          );
        }

        // This authenticates the trusted caller, not the individual staff member.
        // There is no per-staff identity or admin-role system yet; that is an accepted gap.
        // The body is stored encrypted, like every support message.
        let data;
        try {
          data = await insertSupportMessage(supabaseAdmin as unknown as ChatDb, {
            userId: targetUserId,
            body: trimmedBody,
            sender: "support",
          });
        } catch (error) {
          console.error("support reply: failed to insert message", error);
          return Response.json({ error: "Could not send support reply" }, { status: 500 });
        }

        return Response.json({ message: data }, { status: 201 });
      },
    },
  },
});
