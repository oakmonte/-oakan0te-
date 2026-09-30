import { createFileRoute } from "@tanstack/react-router";
import { failure, listInbox, privateJson, requireCaller } from "@/lib/chat/chat.server";

// The inbox, with each chat's last message decrypted for its preview line.
// list_inbox runs as the caller (see chat.server.ts), so it returns exactly
// what it returned when the browser called it directly.
export const Route = createFileRoute("/api/chat/inbox")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const caller = await requireCaller(request);
        if (!caller.ok) return caller.response;
        try {
          return privateJson({ rows: await listInbox(caller.value.db) });
        } catch (err) {
          return failure(err, "Could not load your chats");
        }
      },
    },
  },
});
