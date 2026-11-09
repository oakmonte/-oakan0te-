import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { requireStaff, staffError, staffJson, UUID_RE } from "@/lib/staff.server";

// Lookup: ?q= matches a user id, an email, a username or display name, or a
// store's handle or brand name. Returns accounts, with the stores they own.
const LIMIT = 25;

/** PostgREST's or() filter splits on commas and parentheses, and ilike treats
 *  % and _ as wildcards: keep only characters a real email, username or store
 *  name contains, so the query can't be reshaped from the search box. */
function clean(q: string) {
  return q
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@.+\- ]/g, "")
    .slice(0, 80);
}

export const Route = createFileRoute("/api/staff/users")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;

        const raw = (new URL(request.url).searchParams.get("q") ?? "").trim();
        const ids = new Set<string>();

        if (UUID_RE.test(raw)) {
          ids.add(raw.toLowerCase());
        } else {
          const q = clean(raw);
          if (q.length < 2) return staffJson({ users: [] });
          const like = `%${q}%`;
          const [profiles, stores] = await Promise.all([
            supabaseAdmin
              .from("profiles")
              .select("id")
              .or(
                `personal_email.ilike.${like},personal_username.ilike.${like},display_name.ilike.${like}`,
              )
              .limit(LIMIT),
            supabaseAdmin
              .from("stores")
              .select("owner_id")
              .or(`store_username.ilike.${like},brand_name.ilike.${like}`)
              .limit(LIMIT),
          ]);
          if (profiles.error || stores.error) {
            console.error("staff users: search failed", profiles.error ?? stores.error);
            return staffError("Search failed", 500);
          }
          for (const s of stores.data ?? []) ids.add(s.owner_id);
          for (const p of profiles.data ?? []) ids.add(p.id);
        }

        const list = [...ids].slice(0, LIMIT);
        if (!list.length) return staffJson({ users: [] });

        const [profiles, stores] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("id, personal_username, display_name, personal_email, created_at")
            .in("id", list),
          supabaseAdmin
            .from("stores")
            .select("id, owner_id, brand_name, store_username")
            .in("owner_id", list),
        ]);

        const users = list.map((id) => {
          const p = profiles.data?.find((row) => row.id === id);
          return {
            id,
            username: p?.personal_username ?? null,
            name: p?.display_name ?? null,
            email: p?.personal_email || null,
            created_at: p?.created_at ?? null,
            stores: (stores.data ?? [])
              .filter((s) => s.owner_id === id)
              .map((s) => ({ id: s.id, name: s.brand_name, handle: s.store_username })),
          };
        });
        return staffJson({ users });
      },
    },
  },
});
