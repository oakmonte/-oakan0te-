import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/lib/integrations/my-supabase/client.server";
import { requireOwnStore } from "@/lib/server-auth";
import { bankCodeFor, paystackConfigured, resolveAccountName } from "@/lib/paystack.server";

// Responses carry a bank account number. Keep them out of the browser's disk
// cache and out of any shared cache that might key on URL alone.
const PRIVATE = {
  "Cache-Control": "no-store, private",
  Vary: "Authorization",
} as const;

function privateJson(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...PRIVATE, ...init?.headers } });
}

// store_payout_accounts has RLS enabled with zero policies, so the browser
// client can't touch it at all — every read/write goes through here with the
// service-role key. On save, Paystack looks the account up: a match writes the
// holder's name and "verified" (payouts only go to a verified account); no
// such account is refused; and when Paystack can't answer (no key, an
// unknown bank, an outage) it's saved as "pending" rather than blocking the
// seller.
//
// SECURITY: this handler is the only authorization boundary, because the
// service-role key bypasses RLS. It used to take `storeId` straight off the
// query string with no session check at all, which meant anyone who could
// guess or enumerate a store id could read that seller's bank account number
// over GET, and overwrite it over POST — i.e. redirect their payouts. The
// store is now derived from the caller's own session and any client-supplied
// id is ignored, so there is no id left to tamper with.
export const Route = createFileRoute("/api/store/payout")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        // A signed-in user with no store yet is a normal state for the
        // dashboard, not an error — return an empty account rather than a 403.
        if (!auth.ok) {
          if (auth.response.status === 403) return privateJson({ account: null });
          return auth.response;
        }

        const { data, error } = await supabase
          .from("store_payout_accounts")
          .select("bank_name, account_number, account_name, status")
          .eq("store_id", auth.value.storeId)
          .maybeSingle();

        if (error) {
          console.error("payout GET failed", error);
          return Response.json({ error: "Could not load payout account" }, { status: 500 });
        }

        return privateJson({ account: data });
      },
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) return auth.response;

        let body: {
          bankName?: string;
          accountNumber?: string;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const bankName = body.bankName?.trim();
        const accountNumber = body.accountNumber?.trim();

        if (!bankName || !accountNumber) {
          return Response.json(
            { error: "bankName and accountNumber are required" },
            { status: 400 },
          );
        }

        if (!/^[0-9]{6,20}$/.test(accountNumber)) {
          return Response.json(
            { error: "That account number doesn't look valid" },
            { status: 400 },
          );
        }
        if (bankName.length > 120) {
          return Response.json({ error: "Bank name is too long" }, { status: 400 });
        }

        let accountName: string | null = null;
        if (paystackConfigured()) {
          const bankCode = await bankCodeFor(bankName);
          if (bankCode) {
            accountName = await resolveAccountName(accountNumber, bankCode);
            if (!accountName) {
              return Response.json(
                { error: `We couldn't find that account number at ${bankName}. Check both.` },
                { status: 400 },
              );
            }
          }
        }

        const { data, error } = await supabase
          .from("store_payout_accounts")
          .upsert(
            {
              // From the session, never from the request body.
              store_id: auth.value.storeId,
              bank_name: bankName,
              account_number: accountNumber,
              account_name: accountName,
              status: accountName ? "verified" : "pending",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_id" },
          )
          .select("bank_name, account_number, account_name, status")
          .single();

        if (error) {
          // The raw Postgres error was returned to the caller before, leaking
          // column and constraint names.
          console.error("payout POST failed", error);
          return Response.json({ error: "Could not save payout account" }, { status: 500 });
        }

        return privateJson({ account: data });
      },
    },
  },
});
