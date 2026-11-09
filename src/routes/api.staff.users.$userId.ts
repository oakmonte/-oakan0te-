import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { isStaffUser, requireStaff, staffError, staffJson, UUID_RE } from "@/lib/staff.server";

// Everything staff need about one account: sign-in facts, profile, the stores
// it owns (private columns included -- this runs server-side, staff-only),
// orders it placed, and the latest orders its stores received.
//
// Payout bank details are summarised (bank, holder, last four digits): enough
// to answer "is my payout account set up" without putting a full account
// number on a lookup screen.
const ORDER_COLUMNS =
  "id, store_id, buyer_id, guest_email, status, total_kobo, delivery_method, courier_name, tracking_url, created_at";

type PayoutRow = {
  store_id: string;
  bank_name: string;
  account_name: string | null;
  account_number: string;
  status: string;
};

export const Route = createFileRoute("/api/staff/users/$userId")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { userId: string } }) => {
        const auth = await requireStaff(request);
        if (!auth.ok) return auth.response;
        if (!UUID_RE.test(params.userId)) return staffError("Not found", 404);
        const userId = params.userId;

        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.getUserById(userId);
        if (authError || !authData?.user) return staffError("Not found", 404);
        const u = authData.user;

        const [profile, stores, bought, support, staff] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select(
              "personal_username, display_name, personal_email, personal_phone, account_type, referral_source, created_at",
            )
            .eq("id", userId)
            .maybeSingle(),
          supabaseAdmin
            .from("stores")
            .select(
              "id, brand_name, store_username, business_email, business_phone, store_type, theme_id, onboarded_at, created_at, pickup_address_line, pickup_city, pickup_state, pickup_country, shopify_shop_domain, bumpa_store_id",
            )
            .eq("owner_id", userId)
            .order("created_at", { ascending: true }),
          supabaseAdmin
            .from("orders")
            .select(ORDER_COLUMNS)
            .eq("buyer_id", userId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabaseAdmin
            .from("support_messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId),
          isStaffUser(userId),
        ]);

        const storeIds = (stores.data ?? []).map((s) => s.id);
        let received: unknown[] = [];
        const productCount = new Map<string, number>();
        const payoutFor = new Map<string, unknown>();
        if (storeIds.length) {
          const [sold, payouts, products] = await Promise.all([
            supabaseAdmin
              .from("orders")
              .select(ORDER_COLUMNS)
              .in("store_id", storeIds)
              .order("created_at", { ascending: false })
              .limit(50),
            supabaseAdmin
              .from("store_payout_accounts")
              .select("store_id, bank_name, account_name, account_number, status")
              .in("store_id", storeIds),
            supabaseAdmin.from("products").select("store_id").in("store_id", storeIds),
          ]);
          received = sold.data ?? [];
          for (const p of products.data ?? []) {
            productCount.set(p.store_id, (productCount.get(p.store_id) ?? 0) + 1);
          }
          for (const p of (payouts.data ?? []) as PayoutRow[]) {
            payoutFor.set(p.store_id, {
              bank: p.bank_name,
              holder: p.account_name,
              last4: p.account_number.slice(-4),
              status: p.status,
            });
          }
        }

        return staffJson({
          account: {
            id: u.id,
            email: u.email ?? null,
            phone: u.phone || null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            email_confirmed_at: u.email_confirmed_at ?? null,
            is_anonymous: !!u.is_anonymous,
            is_staff: staff,
            providers: (u.app_metadata?.providers as string[] | undefined) ?? [],
          },
          profile: profile.data ?? null,
          stores: (stores.data ?? []).map((s) => ({
            ...s,
            products: productCount.get(s.id) ?? 0,
            payout: payoutFor.get(s.id) ?? null,
          })),
          orders_placed: bought.data ?? [],
          orders_received: received,
          support_messages: support.count ?? 0,
        });
      },
    },
  },
});
