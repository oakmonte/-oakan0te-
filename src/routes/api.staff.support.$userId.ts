import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import {
  fetchSupportThread,
  insertSupportMessage,
  validateBody,
  type ChatDb,
} from "@/lib/chat/chat.server";
import {
  logStaffAction,
  readJson,
  requireStaff,
  staffError,
  staffJson,
  UUID_RE,
} from "@/lib/staff.server";

type Ctx = { request: Request; params: { userId: string } };

// One user's support thread (GET) and a reply to it as Oakmonte Support (POST).
// The staff-session twin of api.support-messages.staff/.reply, which are gated
// by a shared secret instead and stay for any external tool using them.
export const Route = createFileRoute("/api/staff/support/$userId")({
  server: {
    handlers: {
      GET: async ({ request, params }: Ctx) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;
        if (!UUID_RE.test(params.userId)) return staffError("Not found", 404);

        try {
          const rows = await fetchSupportThread(supabaseAdmin as unknown as ChatDb, params.userId);
          // Photos sit in the private chat-media bucket: an hour-long link each.
          const messages = await Promise.all(
            rows.map(async (m) => {
              if (!m.media_path) return { ...m, media_url: null };
              const { data } = await supabaseAdmin.storage
                .from("chat-media")
                .createSignedUrl(m.media_path, 3600);
              return { ...m, media_url: data?.signedUrl ?? null };
            }),
          );
          return staffJson({ messages });
        } catch (err) {
          console.error("staff support: load failed", err);
          return staffError("Could not load the thread", 500);
        }
      },

      POST: async ({ request, params }: Ctx) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;
        if (!UUID_RE.test(params.userId)) return staffError("Not found", 404);

        const payload = await readJson(request);
        const check = validateBody(payload?.body, true);
        if (!check.ok) return staffError(check.error, 400);

        // Only reply into a thread the user started: staff can't open a
        // support conversation on an arbitrary account.
        const { count } = await supabaseAdmin
          .from("support_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", params.userId)
          .eq("sender", "user");
        if (!count) return staffError("Not found", 404);

        try {
          const message = await insertSupportMessage(supabaseAdmin as unknown as ChatDb, {
            userId: params.userId,
            body: check.body as string,
            sender: "support",
          });
          await logStaffAction(auth.staff, "support_reply", {
            userId: params.userId,
            detail: { message_id: message.id },
          });
          return staffJson({ message: { ...message, media_url: null } }, { status: 201 });
        } catch (err) {
          console.error("staff support: reply failed", err);
          return staffError("Could not send the reply", 500);
        }
      },
    },
  },
});
