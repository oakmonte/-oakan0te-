import { createFileRoute } from "@tanstack/react-router";
import {
  chatError,
  failure,
  fetchSupportThread,
  insertSupportMessage,
  privateJson,
  requireCaller,
  validateBody,
} from "@/lib/chat/chat.server";
import type { Json } from "@/lib/integrations/my-supabase/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The caller's own Oakmonte Support thread. Bodies are encrypted at rest, so
 * the browser reads and writes them here rather than on support_messages
 * directly. Runs as the caller: the table's RLS still decides what they see
 * and that they can only write as `sender = 'user'`.
 *
 * GET  ?latest=1 (inbox preview) | ?id= (a realtime insert) | all, oldest-first
 * POST { body, mediaPath?, meta? } -- mediaPath must be in the caller's own
 *      support/<user id>/ folder; a photo may have no caption.
 */
export const Route = createFileRoute("/api/support-messages/mine")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const caller = await requireCaller(request);
        if (!caller.ok) return caller.response;
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (id && !UUID.test(id)) return chatError("Invalid id", 400);
        try {
          const messages = await fetchSupportThread(caller.value.db, caller.value.me, {
            latest: url.searchParams.get("latest") === "1",
            id,
          });
          return privateJson({ messages });
        } catch (err) {
          return failure(err, "Messages are temporarily unavailable.");
        }
      },

      POST: async ({ request }: { request: Request }) => {
        const caller = await requireCaller(request);
        if (!caller.ok) return caller.response;
        let input: { body?: unknown; mediaPath?: unknown; meta?: unknown };
        try {
          input = await request.json();
        } catch {
          return chatError("Request body must be JSON", 400);
        }
        const mediaPath = typeof input?.mediaPath === "string" ? input.mediaPath : null;
        // Only a photo in the caller's own support folder (storage RLS also
        // stops them uploading anywhere else).
        if (mediaPath && !mediaPath.startsWith(`support/${caller.value.me}/`))
          return chatError("Invalid photo", 400);
        const check = validateBody(input?.body, !mediaPath);
        if (!check.ok || (!check.body && !mediaPath))
          return chatError(check.ok ? "Message is empty" : check.error, 400);
        const body = check.body ?? "";
        const meta = input?.meta && typeof input.meta === "object" ? (input.meta as Json) : null;
        try {
          const message = await insertSupportMessage(caller.value.db, {
            userId: caller.value.me,
            body,
            sender: "user",
            mediaPath,
            mediaMeta: meta,
          });
          return privateJson({ message }, { status: 201 });
        } catch (err) {
          return failure(err, "Your message could not be sent. Please try again.");
        }
      },
    },
  },
});
