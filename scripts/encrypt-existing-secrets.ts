/**
 * One-off backfill: encrypts every secret written before field encryption
 * existed. Safe to re-run — values already encrypted are skipped.
 *
 *   bun scripts/encrypt-existing-secrets.ts            # dry run: counts only
 *   bun scripts/encrypt-existing-secrets.ts --write    # encrypt in place
 *
 * Needs MY_SUPABASE_SERVICE_ROLE_KEY and DATA_ENCRYPTION_KEY in the
 * environment — the SAME key production uses, or production can't read what
 * this writes. Run after the encrypting code is deployed; then apply
 * 20260930130000_require_encrypted_columns.sql (POSTPONED.md §1.5).
 *
 * No secret ever goes into a request URL. The guard against a concurrent
 * write is "only update while the column is still plaintext", which puts
 * nothing but the `enc:v1:` prefix in the query string; the plaintext itself
 * only exists here and, encrypted, in the request body. (Filtering on the old
 * value, the usual compare-and-swap, would copy every token and bank number
 * into Supabase's API logs.)
 */
import { createClient } from "@supabase/supabase-js";
import { MY_SUPABASE_URL } from "../src/lib/integrations/my-supabase/config";
import { encryptField, fieldContext, isEncrypted } from "../src/lib/field-encryption.server";

const write = process.argv.includes("--write");
const serviceKey = process.env.MY_SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("MY_SUPABASE_SERVICE_ROLE_KEY is not set");
if (!process.env.DATA_ENCRYPTION_KEY) throw new Error("DATA_ENCRYPTION_KEY is not set");

// Untyped on purpose: support_messages and the messaging tables aren't in the
// generated types yet, and this script touches nothing else.
const db = createClient(MY_SUPABASE_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH = 200;
const PLAINTEXT = "enc:v1:%";

type Row = Record<string, string | null>;

type Target = {
  table: string;
  key: string;
  /** Extra columns a context needs besides the key. */
  extra?: string[];
  /** Every secret column in the table, converted together in one UPDATE —
   *  one column at a time would leave a row with a second plaintext secret
   *  half-done, and the step-2 constraints check the whole row. */
  columns: Record<string, (row: Row) => string>;
};

const TARGETS: Target[] = [
  {
    table: "store_payout_accounts",
    key: "store_id",
    columns: {
      account_number: (row) => fieldContext.payoutAccountNumber(row.store_id!),
    },
  },
  {
    table: "store_credentials",
    key: "store_id",
    columns: {
      shopify_access_token: (row) => fieldContext.shopifyAccessToken(row.store_id!),
      bumpa_api_key: (row) => fieldContext.bumpaApiKey(row.store_id!),
      instagram_access_token: (row) => fieldContext.instagramAccessToken(row.store_id!),
    },
  },
  {
    table: "support_messages",
    key: "id",
    extra: ["user_id", "sender"],
    columns: {
      body: (row) =>
        fieldContext.supportMessageBody({ id: row.id!, userId: row.user_id!, sender: row.sender! }),
    },
  },
];

/** PostgREST `or` filter: any secret column still holding plaintext. */
function anyPlaintext(columns: string[]) {
  return columns.map((c) => `and(${c}.not.is.null,${c}.not.like.${PLAINTEXT})`).join(",");
}

async function backfill({ table, key, extra = [], columns }: Target): Promise<number> {
  const names = Object.keys(columns);
  let converted = 0;
  let failed = 0;
  const skipped = new Set<string>();

  for (let offset = 0; ; ) {
    const { data, error } = await db
      .from(table)
      .select([key, ...extra, ...names].join(", "))
      .or(anyPlaintext(names))
      .order(key)
      .range(offset, offset + BATCH - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) break;

    if (!write) {
      converted += rows.length;
      offset += BATCH;
      if (rows.length < BATCH) break;
      continue;
    }

    for (const row of rows) {
      const id = row[key]!;
      const todo = names.filter((c) => row[c] != null && !isEncrypted(row[c]));
      const patch: Record<string, string> = {};
      for (const c of todo) patch[c] = await encryptField(row[c]!, columns[c](row));

      let query = db.from(table).update(patch, { count: "exact" }).eq(key, id);
      // Still plaintext, or leave it: a row the app re-wrote since the read
      // already holds fresh ciphertext, which must not be replaced with an
      // encryption of the stale value.
      for (const c of todo) query = query.not(c, "like", PLAINTEXT);
      const { error: updateError, count } = await query;
      if (updateError || count === 0) {
        failed += 1;
        skipped.add(id);
        console.error(`  ${table} ${id}: ${updateError?.message ?? "changed since read, skipped"}`);
      } else {
        converted += 1;
      }
    }
    // Converted rows drop out of the next select; ones that failed stay in it,
    // so step past them rather than re-reading them forever.
    offset = skipped.size;
    if (rows.length < BATCH) break;
  }

  console.log(
    `${table}: ${converted} rows ${write ? "encrypted" : "to encrypt"}${failed ? `, ${failed} failed` : ""}`,
  );
  return failed;
}

async function countPlaintext(table: string, column: string): Promise<number | null> {
  const { count, error } = await db
    .from(table)
    .select(column, { count: "exact", head: true })
    .not(column, "is", null)
    .not(column, "like", PLAINTEXT);
  return error ? null : (count ?? 0);
}

let failures = 0;
for (const target of TARGETS) failures += await backfill(target);

// Direct messages can't be backfilled from here: messages_before_update
// rejects a body change on anything but a recent text message and would stamp
// every row "edited". The table is empty until POSTPONED §1.4 is applied, so
// this should report 0 (or "not applied").
const dmPlaintext = await countPlaintext("messages", "body");
console.log(
  dmPlaintext === null
    ? "messages.body: table not present (direct messages not applied) — nothing to do"
    : `messages.body: ${dmPlaintext} plaintext rows${dmPlaintext ? " — needs a SQL backfill with the trigger disabled, not this script" : ""}`,
);

// Legacy column nothing writes any more (tokens moved to store_credentials).
const legacy = await countPlaintext("stores", "shopify_access_token");
if (legacy) {
  console.log(
    `stores.shopify_access_token: ${legacy} rows still hold a token in the old column — null it out or drop the column; it is readable wherever stores is.`,
  );
}

if (write && failures === 0) {
  console.log("\nAll done. Apply 20260930130000_require_encrypted_columns.sql next.");
}
if (failures) process.exit(1);
