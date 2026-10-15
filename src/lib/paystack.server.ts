import { createHmac, timingSafeEqual } from "node:crypto";

// Server-only Paystack helpers. Nothing here runs without PAYSTACK_SECRET_KEY;
// until it is set, order creation still works and reports payments as
// unavailable instead of failing.

const BASE = "https://api.paystack.co";

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

async function paystack(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  } | null;
  if (!res.ok || !payload?.status || !payload.data) {
    console.error("Paystack", path, res.status, payload?.message);
    throw new Error(payload?.message ?? `Paystack ${res.status}`);
  }
  return payload.data;
}

export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const data = await paystack("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  return { authorizationUrl: String(data.authorization_url), reference: String(data.reference) };
}

export async function verifyTransaction(reference: string) {
  const data = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  return {
    status: String(data.status),
    amountKobo: Number(data.amount),
    currency: String(data.currency),
    reference: String(data.reference),
  };
}

/** Paystack signs the raw request body with HMAC-SHA512 keyed by the secret key
 *  and sends it in x-paystack-signature. Compared in constant time. */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Shipbubble signs webhooks the same way: HMAC-SHA512 of the body keyed by the
 *  API key, in x-ship-signature. */
export function verifyShipbubbleSignature(rawBody: string, signature: string | null, key: string) {
  return verifyPaystackSignature(rawBody, signature, key);
}

// ---- Seller payouts -------------------------------------------------------
// Oakmonte holds every payment until delivery is confirmed, then pays the
// seller by transfer from its Paystack balance (lib/payouts.server.ts). These
// need transfers enabled on the Paystack account, with OTP for API transfers
// turned off, or every transfer waits on a code nobody enters.

// The bank list barely changes; one fetch per server instance is plenty.
let bankCodes: Promise<Map<string, string>> | null = null;
const normBank = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

async function paystackList(path: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const payload = (await res.json().catch(() => null)) as {
    status?: boolean;
    data?: Record<string, unknown>[];
  } | null;
  if (!res.ok || !payload?.status || !Array.isArray(payload.data)) {
    throw new Error(`Paystack ${path} ${res.status}`);
  }
  return payload.data;
}

/** Paystack's bank code for a bank name as the payout sheet stores it (the
 *  sheet's list was taken from this same endpoint). Null when unknown. */
export async function bankCodeFor(bankName: string): Promise<string | null> {
  bankCodes ??= paystackList("/bank?country=nigeria&perPage=500").then(
    (banks) =>
      new Map(banks.map((b) => [normBank(String(b.name ?? "")), String(b.code ?? "")] as const)),
  );
  try {
    return (await bankCodes).get(normBank(bankName)) || null;
  } catch {
    bankCodes = null;
    return null;
  }
}

/** The account holder's name, or null when the bank has no such account. */
export async function resolveAccountName(
  accountNumber: string,
  bankCode: string,
): Promise<string | null> {
  try {
    const data = await paystack(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    return data.account_name ? String(data.account_name) : null;
  } catch {
    return null;
  }
}

/** Paystack returns the existing recipient for the same account details, so
 *  creating one per payout doesn't pile up duplicates. */
export async function createTransferRecipient(input: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<string> {
  const data = await paystack("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    }),
  });
  return String(data.recipient_code);
}

/** `reference` makes a retry safe: Paystack refuses a second transfer with
 *  the same one. */
export async function initiateTransfer(input: {
  amountKobo: number;
  recipient: string;
  reference: string;
  reason: string;
}): Promise<{ status: string; transferCode: string }> {
  const data = await paystack("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: input.amountKobo,
      recipient: input.recipient,
      reference: input.reference,
      reason: input.reason,
    }),
  });
  return { status: String(data.status), transferCode: String(data.transfer_code ?? "") };
}
