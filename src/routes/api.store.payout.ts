import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/lib/integrations/my-supabase/client.server";

// store_payout_accounts has RLS enabled with zero policies, so the browser
// client can't touch it at all — every read/write goes through here with the
// service-role key. Paystack isn't connected, so nothing is verified; status
// is always written as "pending".
export const Route = createFileRoute("/api/store/payout")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const storeId = new URL(request.url).searchParams.get("storeId");
        if (!storeId) {
          return Response.json({ error: "storeId required" }, { status: 400 });
        }

        const { data, error } = await supabase
          .from("store_payout_accounts")
          .select("bank_name, account_number, account_name, status")
          .eq("store_id", storeId)
          .maybeSingle();

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ account: data });
      },
      POST: async ({ request }: { request: Request }) => {
        const { storeId, bankName, accountNumber, accountName } = await request.json();

        if (!storeId || !bankName?.trim() || !accountNumber?.trim() || !accountName?.trim()) {
          return Response.json(
            { error: "storeId, bankName, accountNumber and accountName are required" },
            { status: 400 },
          );
        }

        const { data, error } = await supabase
          .from("store_payout_accounts")
          .upsert(
            {
              store_id: storeId,
              bank_name: bankName.trim(),
              account_number: accountNumber.trim(),
              account_name: accountName.trim(),
              status: "pending",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_id" },
          )
          .select("bank_name, account_number, account_name, status")
          .single();

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ account: data });
      },
    },
  },
});
