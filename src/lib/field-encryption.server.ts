/**
 * Application-level encryption for secrets we store: third-party tokens and
 * API keys, payout bank details, and message bodies.
 *
 * Not end-to-end. The server holds the key and decrypts whenever it serves a
 * value back, so this protects the data wherever it sits OUTSIDE the running
 * app — the Supabase dashboard and SQL editor, database backups, logs of
 * Realtime payloads, a leaked service-role key used straight against
 * PostgREST, anyone with read access to the project. Supabase's own disk
 * encryption only covers a stolen disk; everyone who can query the database
 * still read plaintext before this.
 *
 * AES-256-GCM through WebCrypto (not node:crypto), because the same code runs
 * on Vercel's Node runtime and in the Cloudflare build a local `bun run build`
 * produces.
 *
 * Stored format: `enc:v1:<key id>:<iv>:<ciphertext+tag>`, both base64url. The
 * key id is what makes rotation possible: set a new DATA_ENCRYPTION_KEY, move
 * the old one to DATA_ENCRYPTION_KEYS_OLD, and existing values keep decrypting
 * while everything written from then on uses the new key.
 *
 * Every value is bound to where it lives (`context`, used as GCM additional
 * data — e.g. "store_payout_accounts.account_number:<store id>"). Copying a
 * ciphertext into another row, or another column, makes it fail to decrypt
 * instead of quietly handing one seller's bank details to another's payouts.
 */

const PREFIX = "enc:v1:";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type FieldKey = { id: string; key: CryptoKey };

export class FieldEncryptionError extends Error {}

/** True for anything this module wrote. A value without the prefix is a
 *  legacy plaintext row written before encryption existed. */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalised + "=".repeat((4 - (normalised.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Builds a key from 32 random bytes, base64 — generate one with
 *  `openssl rand -base64 32`. */
export async function importFieldKey(base64: string): Promise<FieldKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64(base64.trim());
  } catch {
    throw new FieldEncryptionError("Encryption key is not valid base64");
  }
  if (raw.length !== 32) {
    throw new FieldEncryptionError("Encryption key must be 32 bytes (openssl rand -base64 32)");
  }
  // The id is derived, not configured, so it can't be set wrong: a short hash
  // of the key, which says which key wrote a value without revealing it.
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  const id = toBase64Url(digest.slice(0, 6));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { id, key };
}

export async function encryptWith(
  keys: FieldKey[],
  plaintext: string,
  context: string,
): Promise<string> {
  const current = keys[0];
  if (!current) throw new FieldEncryptionError("No encryption key configured");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    current.key,
    encoder.encode(plaintext),
  );
  return `${PREFIX}${current.id}:${toBase64Url(iv)}:${toBase64Url(new Uint8Array(sealed))}`;
}

/** Returns legacy plaintext unchanged, so reads keep working through the
 *  window between deploying this and running the backfill. */
export async function decryptWith(keys: FieldKey[], stored: string, context: string) {
  if (!isEncrypted(stored)) return stored;
  const [keyId, iv, sealed] = stored.slice(PREFIX.length).split(":");
  const match = keys.find((candidate) => candidate.id === keyId);
  if (!match || !iv || !sealed) {
    throw new FieldEncryptionError(`No key available for a value written with key ${keyId}`);
  }
  try {
    const opened = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(iv), additionalData: encoder.encode(context) },
      match.key,
      fromBase64(sealed),
    );
    return decoder.decode(opened);
  } catch {
    // Wrong context (a value moved between rows), or tampered bytes. Either
    // way there is no plaintext worth returning.
    throw new FieldEncryptionError(`Could not decrypt ${context}`);
  }
}

let configured: Promise<FieldKey[]> | undefined;

function loadKeys(): Promise<FieldKey[]> {
  configured ??= (async () => {
    const current = process.env.DATA_ENCRYPTION_KEY;
    if (!current) {
      throw new FieldEncryptionError(
        "Missing DATA_ENCRYPTION_KEY. Generate one with `openssl rand -base64 32` and add it to the environment.",
      );
    }
    const old = (process.env.DATA_ENCRYPTION_KEYS_OLD ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return Promise.all([current, ...old].map(importFieldKey));
  })();
  // A failed load must not be cached forever: the next request should see a
  // key added to the environment without a cold start.
  configured.catch(() => {
    configured = undefined;
  });
  return configured;
}

/** Encrypts with the environment's current key. Throws when no key is
 *  configured — a write never silently falls back to plaintext. */
export async function encryptField(plaintext: string, context: string): Promise<string> {
  return encryptWith(await loadKeys(), plaintext, context);
}

export async function decryptField(stored: string, context: string): Promise<string> {
  // Plaintext needs no key, so a legacy row still reads on a deployment that
  // hasn't been given one yet.
  if (!isEncrypted(stored)) return stored;
  return decryptWith(await loadKeys(), stored, context);
}

export async function decryptNullable(
  stored: string | null | undefined,
  context: string,
): Promise<string | null> {
  return stored == null ? null : decryptField(stored, context);
}

/** The `context` strings, in one place so a writer and its reader (and the
 *  import worker, when it exists) can't drift apart. */
export const fieldContext = {
  payoutAccountNumber: (storeId: string) => `store_payout_accounts.account_number:${storeId}`,
  shopifyAccessToken: (storeId: string) => `store_credentials.shopify_access_token:${storeId}`,
  bumpaApiKey: (storeId: string) => `store_credentials.bumpa_api_key:${storeId}`,
  instagramAccessToken: (storeId: string) => `store_credentials.instagram_access_token:${storeId}`,
  // A message is bound to its conversation and sender as well as its id: the
  // columns that decide who may read it. Moving a row into another chat (say,
  // with a leaked service-role key) then leaves it undecryptable instead of
  // readable by that chat's members.
  messageBody: (m: { id: string; conversationId: string; senderId: string }) =>
    `messages.body:${m.id}:${m.conversationId}:${m.senderId}`,
  supportMessageBody: (m: { id: string; userId: string; sender: string }) =>
    `support_messages.body:${m.id}:${m.userId}:${m.sender}`,
} as const;
