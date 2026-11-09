import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import {
  isStaffUser,
  logStaffAction,
  readJson,
  requireStaff,
  staffError,
  staffJson,
  UUID_RE,
} from "@/lib/staff.server";

// "Open as client": a one-time sign-in token for a seller's account, so staff
// can fill in products and the theme with the real editors instead of a
// second, drifting copy of them.
//
// The client is PKCE (my-supabase/client.ts), so the action_link Supabase
// builds -- which lands tokens in the URL fragment, implicit-style -- would be
// rejected. Instead this returns the link's hashed token and /staff-open
// exchanges it with verifyOtp, which works with either flow. Nothing is
// emailed. The token is single-use and expires with Supabase's OTP expiry.
//
// Deliberately narrow: only accounts that own a store, never staff accounts,
// never anonymous ones. Every token minted is in staff_actions.
export const Route = createFileRoute("/api/staff/open-as")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;

        const body = await readJson(request);
        const userId = typeof body?.user_id === "string" ? body.user_id : "";
        if (!UUID_RE.test(userId)) return staffError("Not found", 404);

        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
        const user = authData?.user;
        if (!user || user.is_anonymous || !user.email) return staffError("Not found", 404);
        if (await isStaffUser(userId)) {
          return staffError("Staff accounts can't be opened this way", 403);
        }

        const { count } = await supabaseAdmin
          .from("stores")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId);
        if (!count) return staffError("Only seller accounts with a store can be opened", 403);

        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: user.email,
        });
        const tokenHash = data?.properties?.hashed_token;
        if (error || !tokenHash) {
          console.error("staff open-as: generateLink failed", error);
          return staffError("Could not create a sign-in link", 500);
        }

        await logStaffAction(auth.staff, "open_as_client", { userId });
        return staffJson({ token_hash: tokenHash, email: user.email });
      },
    },
  },
});
