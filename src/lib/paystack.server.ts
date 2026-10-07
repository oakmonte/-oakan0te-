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
