import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requireStaff, staffError, staffJson } from "@/lib/staff.server";

// The support inbox: one row per user who has a support thread, newest
// activity first, with whether the last word was theirs (needs a reply).
//
// Grouped here from the most recent messages rather than with a DISTINCT ON
// view, so this needs no extra migration. WINDOW messages comfortably covers
// every live thread at today's volume; raise it, or move to a view, when the
// inbox starts missing old threads.
const WINDOW = 2000;

type Row = {
  user_id: string;
  body: string | null;
  sender: string;
  created_at: string;
  media_path: string | null;
};

export const Route = createFileRoute("/api/staff/inbox")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;

        const { data, error } = await supabaseAdmin
          .from("support_messages")
          .select("user_id, body, sender, created_at, media_path")
          .order("created_at", { ascending: false })
          .limit(WINDOW);
        if (error) {
          console.error("staff inbox: load failed", error);
          return staffError("Could not load the inbox", 500);
        }

        const threads = new Map<
          string,
          { user_id: string; last: Row; count: number; awaiting: number }
        >();
        for (const row of (data ?? []) as Row[]) {
          const t = threads.get(row.user_id);
          if (!t) {
            threads.set(row.user_id, {
              user_id: row.user_id,
              last: row,
              count: 1,
              awaiting: row.sender === "user" ? 1 : 0,
            });
            continue;
          }
          t.count += 1;
          // Rows arrive newest first: user messages count as awaiting until
          // the first (i.e. most recent) support reply is seen.
          if (row.sender === "user" && t.awaiting === t.count - 1) t.awaiting += 1;
        }

        const ids = [...threads.keys()];
        const names = new Map<string, { username: string; name: string | null; email: string }>();
        if (ids.length) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("id, personal_username, display_name, personal_email")
            .in("id", ids);
          for (const p of profiles ?? []) {
            names.set(p.id, {
              username: p.personal_username,
              name: p.display_name,
              email: p.personal_email,
            });
          }
        }

        const list = [...threads.values()].map((t) => ({
          user_id: t.user_id,
          username: names.get(t.user_id)?.username ?? null,
          name: names.get(t.user_id)?.name ?? null,
          email: names.get(t.user_id)?.email || null,
          last_body: t.last.body ? t.last.body.slice(0, 160) : t.last.media_path ? "Photo" : "",
          last_sender: t.last.sender,
          last_at: t.last.created_at,
          awaiting: t.awaiting,
        }));
        return staffJson({ threads: list });
      },
    },
  },
});
