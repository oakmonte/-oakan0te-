import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/lib/integrations/my-supabase/client.server";
import { requireOwnStore } from "@/lib/server-auth";
import { decryptField, encryptField, fieldContext } from "@/lib/field-encryption.server";

// Responses carry a bank account number. Keep them out of the browser's disk
// cache and out of any shared cache that might key on URL alone.
const PRIVATE = {
  "Cache-Control": "no-store, private",
  Vary: "Authorization",
} as const;

function privateJson(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...PRIVATE, ...init?.headers } });
}

type StoredAccount = { bank_name: string; account_number: string; status: string };

// account_number is stored encrypted (field-encryption.server.ts) and only
// ever decrypted here, on its way back to the store's own owner.
async function openAccount(storeId: string, row: StoredAccount | null) {
  if (!row) return null;
  return {
    ...row,
    account_number: await decryptField(
      row.account_number,
      fieldContext.payoutAccountNumber(storeId),
    ),
  };
}

// store_payout_accounts has RLS enabled with zero policies, so the browser
// client can't touch it at all — every read/write goes through here with the
// service-role key. Paystack isn't connected, so nothing is verified; status
// is always written as "pending".
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
          .select("bank_name, account_number, status")
          .eq("store_id", auth.value.storeId)
          .maybeSingle();

        if (error) {
          console.error("payout GET failed", error);
          return Response.json({ error: "Could not load payout account" }, { status: 500 });
        }

        try {
          return privateJson({ account: await openAccount(auth.value.storeId, data) });
        } catch (err) {
          console.error("payout GET: could not decrypt", err);
          return Response.json({ error: "Could not load payout account" }, { status: 500 });
        }
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

        let sealedNumber: string;
        try {
          sealedNumber = await encryptField(
            accountNumber,
            fieldContext.payoutAccountNumber(auth.value.storeId),
          );
        } catch (err) {
          // No key configured. Refuse rather than store a bank account number
          // in the clear.
          console.error("payout POST: could not encrypt", err);
          return Response.json({ error: "Could not save payout account" }, { status: 500 });
        }

        const { data, error } = await supabase
          .from("store_payout_accounts")
          .upsert(
            {
              // From the session, never from the request body.
              store_id: auth.value.storeId,
              bank_name: bankName,
              account_number: sealedNumber,
              status: "pending",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_id" },
          )
          .select("bank_name, account_number, status")
          .single();

        if (error) {
          // The raw Postgres error was returned to the caller before, leaking
          // column and constraint names.
          console.error("payout POST failed", error);
          return Response.json({ error: "Could not save payout account" }, { status: 500 });
        }

        // The number just saved, not a decrypt of what came back — same value,
        // one less thing to fail after the write already succeeded.
        return privateJson({ account: { ...data, account_number: accountNumber } });
      },
    },
  },
});
