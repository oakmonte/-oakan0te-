import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { decryptField, fieldContext } from "@/lib/field-encryption.server";
import {
  bankCodeFor,
  createTransferRecipient,
  initiateTransfer,
  paystackConfigured,
} from "@/lib/paystack.server";
import { COMMISSION_RATE, PAYSTACK_RATE } from "@/lib/pricing-fees";

// Oakmonte holds every payment until delivery is confirmed. Then, and only
// then, the seller's share is written to payout_ledger and sent by Paystack
// transfer. The ledger row's id is the transfer reference, so a retry can
// never pay twice; the outcome arrives on the Paystack webhook
// (transfer.success / failed / reversed -> settleTransfer).

const REF_PREFIX = "payout-";

/** The seller's share of an order: the items, less the 4.5% (commission +
 *  Paystack). Delivery is the courier's money, not the seller's. Rounded down
 *  to the kobo -- never pay out more than was taken. */
export function sellerShareKobo(itemsTotalKobo: number): number {
  return Math.floor(itemsTotalKobo * (1 - COMMISSION_RATE - PAYSTACK_RATE));
}

/** Call once per order, from whoever confirmed the delivery -- and only after
 *  winning the status change to "delivered", so two confirmations can't both
 *  get here. Never throws: a payout that can't go out stays owed, with a note
 *  saying why, for someone to settle by hand. */
export async function payOutOrder(orderId: string): Promise<void> {
  try {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, store_id, items_total_kobo, status")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.status !== "delivered") return;

    const { data: existing } = await supabaseAdmin
      .from("payout_ledger")
      .select("id")
      .eq("order_id", orderId)
      .eq("kind", "seller")
      .maybeSingle();
    if (existing) return;

    const { data: row, error } = await supabaseAdmin
      .from("payout_ledger")
      .insert({
        order_id: orderId,
        kind: "seller",
        store_id: order.store_id,
        amount_kobo: sellerShareKobo(order.items_total_kobo),
        status: "owed",
      })
      .select("id, amount_kobo")
      .single();
    if (error || !row) {
      console.error("payout: ledger insert failed", orderId, error);
      return;
    }

    const note = async (text: string) => {
      await supabaseAdmin.from("payout_ledger").update({ note: text }).eq("id", row.id);
    };

    if (row.amount_kobo === 0) return await note("Nothing to pay");
    if (!paystackConfigured()) return await note("Paystack not configured");

    const { data: account } = await supabaseAdmin
      .from("store_payout_accounts")
      .select("bank_name, account_number, account_name, status")
      .eq("store_id", order.store_id)
      .maybeSingle();
    if (!account) return await note("Seller has no bank account");
    if (account.status !== "verified" || !account.account_name) {
      return await note("Seller's bank account isn't verified");
    }
    const bankCode = await bankCodeFor(account.bank_name);
    if (!bankCode) return await note(`Unknown bank: ${account.bank_name}`);

    const accountNumber = await decryptField(
      account.account_number,
      fieldContext.payoutAccountNumber(order.store_id),
    );
    const recipient = await createTransferRecipient({
      name: account.account_name,
      accountNumber,
      bankCode,
    });
    const transfer = await initiateTransfer({
      amountKobo: row.amount_kobo,
      recipient,
      reference: REF_PREFIX + row.id,
      reason: `Oakmonte order ${orderId.slice(0, 8)}`,
    });
    await note(`Transfer ${transfer.status} (${transfer.transferCode})`);
  } catch (err) {
    console.error("payout failed", orderId, err);
    await supabaseAdmin
      .from("payout_ledger")
      .update({ note: `Transfer didn't start: ${err instanceof Error ? err.message : err}` })
      .eq("order_id", orderId)
      .eq("kind", "seller")
      .eq("status", "owed");
  }
}

/** From the Paystack webhook. Ignores transfers that aren't payouts. */
export async function settleTransfer(event: string, reference: string): Promise<void> {
  if (!reference.startsWith(REF_PREFIX)) return;
  const id = reference.slice(REF_PREFIX.length);
  if (event === "transfer.success") {
    await supabaseAdmin
      .from("payout_ledger")
      .update({ status: "paid", paid_at: new Date().toISOString(), note: "Paid" })
      .eq("id", id)
      .eq("status", "owed");
  } else {
    // Failed or reversed: still owed. A retry needs a new reference (this one
    // is spent), so it's left for a person to look at.
    await supabaseAdmin
      .from("payout_ledger")
      .update({ note: `Transfer ${event.replace("transfer.", "")}; needs a manual retry` })
      .eq("id", id)
      .eq("status", "owed");
  }
}
