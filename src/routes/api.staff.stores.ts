import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import {
  logStaffAction,
  readJson,
  requireStaff,
  staffError,
  staffJson,
  UUID_RE,
} from "@/lib/staff.server";
import { normalizeUsername, validateUsername } from "@/lib/username-rules";

// Staff set up a store for a client who won't do it themselves.
//
// GET  -> the active themes, for the form's picker.
// POST -> finds the client's account by email, or creates it (confirmed, no
//         email sent -- they sign in later with the usual email code and are
//         asked to set a password then), gives it a seller profile if it has
//         none, and creates the store owned by THEM, not by staff.
//
// Safe to retry: a second attempt finds the account the first one created.
// Products and the theme's fine detail are done afterwards through "Open as
// client", in the real editors.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The labels /seller-type stores verbatim.
const STORE_TYPES = new Set(["Brand", "Vendor", "Tailor", "Artist"]);

/** Same rules as name-your-store's slugify, so a staff-made handle looks like
 *  one a seller would have got. */
function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function usernameFor(email: string, brand: string): Promise<string> {
  const bases = [normalizeUsername(email.split("@")[0] ?? ""), normalizeUsername(brand)];
  for (const base of bases) {
    const trimmed = base.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "").slice(0, 16);
    if (validateUsername(trimmed)) continue;
    for (let i = 0; i < 6; i++) {
      const candidate = i === 0 ? trimmed : `${trimmed}${Math.floor(Math.random() * 9000) + 1000}`;
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("personal_username", candidate);
      if (!count) return candidate;
    }
  }
  return `seller${Date.now().toString(36)}`;
}

export const Route = createFileRoute("/api/staff/stores")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;
        const { data, error } = await supabaseAdmin
          .from("store_themes")
          .select("id, name, slug, preview_url")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (error) return staffError("Could not load themes", 500);
        return staffJson({ themes: data ?? [] });
      },

      POST: async ({ request }: { request: Request }) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;

        const body = await readJson(request);
        const email = str(body?.email, 254).toLowerCase();
        const clientName = str(body?.client_name, 80);
        const brand = str(body?.brand_name, 80);
        const phone = str(body?.business_phone, 30);
        const storeType = str(body?.store_type, 20);
        const themeId = str(body?.theme_id, 36);
        const handle = slugify(str(body?.handle, 60) || brand);

        if (!EMAIL_RE.test(email)) return staffError("Enter the client's email", 400);
        if (!brand) return staffError("Enter the store name", 400);
        if (handle.length < 2) return staffError("The store link needs letters or numbers", 400);
        if (storeType && !STORE_TYPES.has(storeType)) return staffError("Unknown store type", 400);
        if (themeId && !UUID_RE.test(themeId)) return staffError("Unknown theme", 400);

        if (themeId) {
          const { data: theme } = await supabaseAdmin
            .from("store_themes")
            .select("id")
            .eq("id", themeId)
            .eq("is_active", true)
            .maybeSingle();
          if (!theme) return staffError("Unknown theme", 400);
        }

        const { count: handleTaken } = await supabaseAdmin
          .from("stores")
          .select("id", { count: "exact", head: true })
          .eq("store_username", handle);
        if (handleTaken) return staffError(`The store link "${handle}" is taken`, 409);

        // 1. The client's account: existing (by profile email) or new.
        let userId: string | null = null;
        let createdAccount = false;
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .ilike("personal_email", email)
          .limit(1);
        userId = existing?.[0]?.id ?? null;

        if (!userId) {
          const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: clientName || brand, created_by_staff: true },
          });
          if (createError || !created?.user) {
            // An account with this email but no profile (they signed up and
            // stopped at the first step). Staff can find it in Lookup.
            const exists = /already|registered|exists/i.test(createError?.message ?? "");
            console.error("staff stores: createUser failed", createError);
            return staffError(
              exists
                ? "An account with this email exists but hasn't finished sign-up. Ask the client to sign in once, then try again."
                : "Could not create the client's account",
              exists ? 409 : 500,
            );
          }
          userId = created.user.id;
          createdAccount = true;
        }

        const { count: ownsStore } = await supabaseAdmin
          .from("stores")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId);
        if (ownsStore) {
          return staffJson(
            { error: "This client already has a store", user_id: userId },
            { status: 409 },
          );
        }

        // 2. A seller profile, if there isn't one. referral_source set means
        //    resolvePostAuthRedirect won't walk the client back through
        //    onboarding questions staff already answered.
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", userId)
          .maybeSingle();
        if (!profile) {
          const username = await usernameFor(email, brand);
          const { error: profileError } = await supabaseAdmin.from("profiles").insert({
            id: userId,
            personal_username: username,
            personal_email: email,
            display_name: clientName || brand,
            account_type: "seller",
            referral_source: "oakmonte_staff",
          });
          if (profileError) {
            console.error("staff stores: profile insert failed", profileError);
            return staffError("Could not create the client's profile. Try again.", 500);
          }
        }

        // 3. The store, owned by the client.
        const { data: store, error: storeError } = await supabaseAdmin
          .from("stores")
          .insert({
            owner_id: userId,
            brand_name: brand,
            store_username: handle,
            business_email: email,
            business_phone: phone || null,
            store_type: storeType || null,
            theme_id: themeId || null,
          })
          .select("id, store_username")
          .single();
        if (storeError || !store) {
          console.error("staff stores: store insert failed", storeError);
          return staffError(
            storeError?.code === "23505"
              ? `The store link "${handle}" is taken`
              : "Could not create the store. Try again.",
            storeError?.code === "23505" ? 409 : 500,
          );
        }

        await logStaffAction(auth.staff, "create_store_for_client", {
          userId,
          storeId: store.id,
          detail: { email, handle: store.store_username, created_account: createdAccount },
        });

        return staffJson(
          {
            user_id: userId,
            store_id: store.id,
            handle: store.store_username,
            created_account: createdAccount,
          },
          { status: 201 },
        );
      },
    },
  },
});
