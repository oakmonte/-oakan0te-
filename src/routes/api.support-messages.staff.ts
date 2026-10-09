import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import {
  chatError,
  failure,
  fetchSupportThread,
  isSupportTool,
  privateJson,
  type ChatDb,
} from "@/lib/chat/chat.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET ?user_id=  — one user's support thread, decrypted, for the support tool.
 *
 * Support bodies are encrypted at rest, so the Supabase dashboard now shows
 * ciphertext; this is how staff read a thread. Same gate as
 * api.support-messages.reply: the tool's shared secret AND a signed-in
 * session. Uses the service-role key because staff read other people's
 * threads, which no RLS policy allows.
 */
export const Route = createFileRoute("/api/support-messages/staff")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        if (!(await isSupportTool(request))) return chatError("Unauthorized", 401);
        if (!(await getRequestUser(request))) return chatError("Not signed in", 401);

        const userId = new URL(request.url).searchParams.get("user_id");
        if (!userId || !UUID.test(userId)) return chatError("user_id must be a valid UUID", 400);

        try {
          const rows = await fetchSupportThread(supabaseAdmin as unknown as ChatDb, userId);
          // Photos sit in the private chat-media bucket; staff get an
          // hour-long link to each.
          const messages = await Promise.all(
            rows.map(async (m) => {
              if (!m.media_path) return m;
              const { data } = await supabaseAdmin.storage
                .from("chat-media")
                .createSignedUrl(m.media_path, 3600);
              return { ...m, media_url: data?.signedUrl ?? null };
            }),
          );
          return privateJson({ messages });
        } catch (err) {
          return failure(err, "Could not load the thread");
        }
      },
    },
  },
});
