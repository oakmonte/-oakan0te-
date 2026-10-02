/**
 * The server half of messaging: every read or write that carries a message
 * body. Bodies are stored encrypted (field-encryption.server.ts), so the
 * browser can't read or write them directly any more — it goes through
 * api.chat.* and api.support-messages.*, which call into here.
 *
 * Queries run on a client carrying the CALLER'S access token, not the
 * service-role key. That keeps every RLS policy and column grant in the
 * messaging migrations as the authorization boundary, exactly as when the
 * browser made these calls itself; this layer only adds the encryption. The
 * one exception is the staff support reader, which is gated by its own secret.
 *
 * Server-only: imports the encryption key.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  MY_SUPABASE_PUBLISHABLE_KEY,
  MY_SUPABASE_URL,
} from "@/lib/integrations/my-supabase/config";
import { bearer, getRequestUser } from "@/lib/server-auth";
import {
  decryptField,
  encryptField,
  FieldEncryptionError,
  fieldContext,
} from "@/lib/field-encryption.server";
import type { Json } from "@/lib/integrations/my-supabase/types";
import type {
  ConversationKind,
  InboxRow,
  MessageKind,
  MessageRow,
  MessagingDatabase,
  SupportMessageRow,
} from "./db";

export type ChatDb = SupabaseClient<MessagingDatabase>;

/** Same cap the database enforced on plaintext before bodies were encrypted —
 *  the column's own limit is now sized for ciphertext, so this is the real one. */
export const MAX_BODY_CHARS = 4000;
export const PAGE_SIZE = 50;

/** Shown in place of a body that fails to decrypt (a key that was removed, a
 *  row edited by hand), so one bad row degrades to one odd bubble instead of
 *  the whole chat failing to load. */
const UNREADABLE = "This message can't be displayed.";

export const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, kind, body, media_path, media_meta, reply_to_id, forwarded, edited_at, deleted_at, created_at";

const PRIVATE_HEADERS = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

/** Every response here carries message text: keep it out of shared caches. */
export function privateJson(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...PRIVATE_HEADERS, ...init?.headers } });
}

/** Error shape the browser's ChatError understands, including the Postgres
 *  code (42501 is how a block surfaces, PGRST202/205 an unapplied migration). */
export function chatError(message: string, status: number, code?: string) {
  return privateJson({ error: message, code }, { status });
}

export type Caller = { me: string; db: ChatDb };

/** Validates the session and returns a client that queries as the caller. */
export async function requireCaller(
  request: Request,
): Promise<{ ok: true; value: Caller } | { ok: false; response: Response }> {
  const token = bearer(request);
  const user = token ? await getRequestUser(request) : null;
  if (!token || !user) return { ok: false, response: chatError("Not signed in", 401) };
  const db = createClient<MessagingDatabase>(MY_SUPABASE_URL, MY_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { ok: true, value: { me: user.id, db } };
}

/** Code-point length — what Postgres' char_length measured before. */
function charLength(text: string) {
  return [...text].length;
}

export type BodyCheck = { ok: true; body: string | null } | { ok: false; error: string };

/** Trims and length-checks a message body. `required` rejects empty. */
export function validateBody(body: unknown, required: boolean): BodyCheck {
  if (body != null && typeof body !== "string")
    return { ok: false, error: "body must be a string" };
  const trimmed = (body ?? "").trim();
  if (!trimmed)
    return required ? { ok: false, error: "Message is empty" } : { ok: true, body: null };
  if (charLength(trimmed) > MAX_BODY_CHARS) {
    return { ok: false, error: `Messages can be at most ${MAX_BODY_CHARS} characters` };
  }
  return { ok: true, body: trimmed };
}

async function openBody(stored: string | null, context: string): Promise<string | null> {
  if (stored == null) return null;
  try {
    return await decryptField(stored, context);
  } catch (err) {
    console.error("chat: could not decrypt a message body", err);
    return UNREADABLE;
  }
}

export async function openMessage(row: MessageRow): Promise<MessageRow> {
  return {
    ...row,
    body: await openBody(
      row.body,
      fieldContext.messageBody({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
      }),
    ),
  };
}

export async function openSupportMessage(row: SupportMessageRow): Promise<SupportMessageRow> {
  return {
    ...row,
    body:
      (await openBody(
        row.body,
        fieldContext.supportMessageBody({ id: row.id, userId: row.user_id, sender: row.sender }),
      )) ?? "",
  };
}

/* ---------- direct messages ---------- */

export async function listInbox(db: ChatDb): Promise<InboxRow[]> {
  const { data, error } = await db.rpc("list_inbox");
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => ({
      ...row,
      kind: row.kind as ConversationKind,
      last_message_body:
        row.last_message_id && row.last_message_sender_id
          ? await openBody(
              row.last_message_body,
              fieldContext.messageBody({
                id: row.last_message_id,
                conversationId: row.conversation_id,
                senderId: row.last_message_sender_id,
              }),
            )
          : row.last_message_body,
    })),
  );
}

/** One page, newest first from the database, returned oldest-first. Hidden
 *  ("deleted for me") messages and anything before a clear are dropped. */
export async function fetchPage(
  { db, me }: Caller,
  conversationId: string,
  options: { before?: string | null; clearedAt?: string | null },
): Promise<{ messages: MessageRow[]; hasMore: boolean }> {
  let query = db
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (options.before) query = query.lt("created_at", options.before);
  if (options.clearedAt) query = query.gt("created_at", options.clearedAt);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];

  let hidden = new Set<string>();
  if (rows.length > 0) {
    const { data: hides } = await db
      .from("message_hides")
      .select("message_id")
      .eq("user_id", me)
      .in(
        "message_id",
        rows.map((row) => row.id),
      );
    hidden = new Set((hides ?? []).map((row) => row.message_id));
  }

  const visible = rows.filter((row) => !hidden.has(row.id)).reverse();
  return {
    messages: await Promise.all(visible.map(openMessage)),
    hasMore: rows.length === PAGE_SIZE,
  };
}

export async function fetchByIds(db: ChatDb, ids: string[]): Promise<MessageRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db.from("messages").select(MESSAGE_COLUMNS).in("id", ids);
  if (error) throw error;
  return Promise.all(((data ?? []) as MessageRow[]).map(openMessage));
}

export type NewMessage = {
  id: string;
  conversationId: string;
  kind: MessageKind;
  body: string | null;
  mediaPath: string | null;
  meta: Json | null;
  replyToId: string | null;
  forwarded: boolean;
};

export async function insertMessage({ db, me }: Caller, input: NewMessage): Promise<MessageRow> {
  const { data, error } = await db
    .from("messages")
    .insert({
      id: input.id,
      conversation_id: input.conversationId,
      // From the session. RLS would refuse anyone else's id anyway.
      sender_id: me,
      kind: input.kind,
      body: input.body
        ? await encryptField(
            input.body,
            fieldContext.messageBody({
              id: input.id,
              conversationId: input.conversationId,
              senderId: me,
            }),
          )
        : null,
      media_path: input.mediaPath,
      media_meta: input.meta,
      reply_to_id: input.replyToId,
      forwarded: input.forwarded,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) throw error ?? new Error("Message not sent");
  // The text just sent, not a decrypt of the echo.
  return { ...(data as MessageRow), body: input.body };
}

export async function editMessage(db: ChatDb, id: string, body: string): Promise<void> {
  // The ciphertext is bound to the conversation and sender, so read those
  // first — as the caller, so a message they can't see can't be edited.
  const { data: row, error: readError } = await db
    .from("messages")
    .select("conversation_id, sender_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) throw { message: "Message not found", code: "42501" };
  const { error } = await db
    .from("messages")
    .update({
      body: await encryptField(
        body,
        fieldContext.messageBody({
          id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
        }),
      ),
    })
    .eq("id", id);
  if (error) throw error;
}

/* ---------- support ---------- */

async function hasMatchingSecret(provided: string, expected: string): Promise<boolean> {
  const [providedDigest, expectedDigest] = await Promise.all(
    [provided, expected].map((value) =>
      globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
  const providedBytes = new Uint8Array(providedDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

/** The trusted support tool's shared secret (SUPPORT_REPLY_SECRET), compared
 *  in constant time. Authenticates the tool, not an individual staff member —
 *  there is no admin-role system yet; that is an accepted gap. */
export async function isSupportTool(request: Request): Promise<boolean> {
  const configured = process.env.SUPPORT_REPLY_SECRET;
  const provided = request.headers.get("X-Oakmonte-Internal-Key");
  return !!configured && !!provided && (await hasMatchingSecret(provided, configured));
}

const SUPPORT_COLUMNS = "id, user_id, body, sender, created_at";

export async function fetchSupportThread(
  db: ChatDb,
  userId: string,
  options: { latest?: boolean; id?: string | null } = {},
): Promise<SupportMessageRow[]> {
  let query = db.from("support_messages").select(SUPPORT_COLUMNS).eq("user_id", userId);
  if (options.id) query = query.eq("id", options.id);
  query = options.latest
    ? query.order("created_at", { ascending: false }).limit(1)
    : query.order("created_at", { ascending: true });
  const { data, error } = await query;
  if (error) throw error;
  return Promise.all(((data ?? []) as SupportMessageRow[]).map(openSupportMessage));
}

/** Writes one support message. The id is generated here rather than by the
 *  database because the ciphertext is bound to it. */
export async function insertSupportMessage(
  db: ChatDb,
  input: { userId: string; body: string; sender: "user" | "support" },
): Promise<SupportMessageRow> {
  const id = crypto.randomUUID();
  const { data, error } = await db
    .from("support_messages")
    .insert({
      id,
      user_id: input.userId,
      body: await encryptField(
        input.body,
        fieldContext.supportMessageBody({ id, userId: input.userId, sender: input.sender }),
      ),
      sender: input.sender,
    })
    .select(SUPPORT_COLUMNS)
    .single();
  if (error || !data) throw error ?? new Error("Message not sent");
  return { ...(data as SupportMessageRow), body: input.body };
}

/** Maps a thrown Supabase/encryption error to a response. */
export function failure(err: unknown, fallback: string): Response {
  if (err instanceof FieldEncryptionError) {
    // Misconfiguration (no key), not the caller's fault — and never a reason
    // to fall back to storing plaintext.
    console.error("chat: encryption unavailable", err);
    return chatError(fallback, 500);
  }
  const pg = err as { message?: string; code?: string } | null;
  console.error("chat:", fallback, pg);
  const status = pg?.code === "42501" ? 403 : 500;
  return chatError(fallback, status, pg?.code);
}
