/**
 * Every messaging read and write the browser makes. Anything that carries a
 * message body goes through our own api.chat.* / api.support-messages.*
 * routes, because bodies are encrypted at rest and only the server holds the
 * key (see chat.server.ts). Everything else goes straight through the
 * publishable-key client. Either way, what a caller can see or change is
 * decided by the RLS policies and column grants in the messaging migrations —
 * the routes query as the caller — not by anything here.
 */
import { authedFetch } from "@/lib/authed-fetch";
import {
  CHAT_MEDIA_BUCKET,
  chatDb,
  getChatClient,
  isMissingSchema,
  type InboxRow,
  type MemberRow,
  type MessageKind,
  type MessageRow,
  type SupportMessageRow,
} from "./db";
import { fromInboxRow, fromMessageRow, type Chat, type ChatMessage, type MediaMeta } from "./model";

export const PAGE_SIZE = 50;

export class ChatError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

function fail(error: { message: string; code?: string } | null, fallback: string): never {
  throw new ChatError(error?.message || fallback, error?.code);
}

/** Calls one of the encrypted-body routes. Errors come back as ChatError
 *  carrying the Postgres code, so callers can tell a block (42501) or an
 *  unapplied migration (PGRST202/205) apart exactly as before. */
async function chatRequest<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await authedFetch(
      path,
      { ...init, headers: { "Content-Type": "application/json", ...init?.headers } },
      getChatClient(),
    );
  } catch {
    throw new ChatError(fallback);
  }
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string })
    | null;
  if (!response.ok || !payload) {
    if (payload?.code === "42501") throw new ChatError("You can't message this account", "blocked");
    throw new ChatError(payload?.error || fallback, payload?.code);
  }
  return payload;
}

/* ---------- inbox ---------- */

export async function listInbox(me: string): Promise<Chat[]> {
  const { rows } = await chatRequest<{ rows: InboxRow[] }>(
    "/api/chat/inbox",
    "Could not load your chats",
  );
  return rows.map((row) => fromInboxRow(row, me));
}

export async function touchPresence(): Promise<void> {
  await chatDb.rpc("touch_messaging_presence");
}

export async function startDirectConversation(otherUser: string): Promise<string> {
  const { data, error } = await chatDb.rpc("start_direct_conversation", { other_user: otherUser });
  if (error || !data) fail(error, "Could not start that chat");
  return data;
}

export async function startSelfConversation(): Promise<string> {
  const { data, error } = await chatDb.rpc("start_self_conversation");
  if (error || !data) fail(error, "Could not open your notes");
  return data;
}

type MemberPatch = Partial<
  Pick<
    MemberRow,
    "last_read_at" | "pinned_at" | "muted" | "archived_at" | "marked_unread" | "cleared_at"
  >
>;

export async function updateMembership(
  conversationId: string,
  me: string,
  patch: MemberPatch,
): Promise<void> {
  const { error } = await chatDb
    .from("conversation_members")
    .update(patch)
    .eq("conversation_id", conversationId)
    .eq("user_id", me);
  if (error) fail(error, "Could not update this chat");
}

export function markRead(conversationId: string, me: string) {
  return updateMembership(conversationId, me, {
    last_read_at: new Date().toISOString(),
    marked_unread: false,
  });
}

/* ---------- settings ---------- */

/** No row means the default: on. null means the setting doesn't exist on
 *  this database yet (20260929120000_read_receipts_setting not applied). */
export async function fetchReadReceipts(me: string): Promise<boolean | null> {
  const { data, error } = await chatDb
    .from("messaging_settings")
    .select("read_receipts")
    .eq("user_id", me)
    .maybeSingle();
  if (isMissingSchema(error)) return null;
  return data?.read_receipts ?? true;
}

export async function setReadReceipts(me: string, on: boolean): Promise<void> {
  const { error } = await chatDb
    .from("messaging_settings")
    .upsert({ user_id: me, read_receipts: on, updated_at: new Date().toISOString() });
  if (error) fail(error, "Could not save that setting");
}

/* ---------- people ---------- */

export type PersonResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/** Includes the caller: picking yourself opens your "Me" notes chat. */
export async function searchPeople(query: string, me: string | null): Promise<PersonResult[]> {
  const needle = query
    .trim()
    .replace(/^@/, "")
    .replace(/[%_,()]/g, "");
  if (!needle) return [];
  const { data, error } = await chatDb
    .from("public_profiles")
    .select("id, personal_username, display_name, avatar_url")
    .or(`personal_username.ilike.%${needle}%,display_name.ilike.%${needle}%`)
    .limit(25);
  if (error) fail(error, "Search is unavailable");
  return (data ?? [])
    .filter((row) => row.id && row.personal_username)
    .sort((a, b) => Number(b.id === me) - Number(a.id === me))
    .map((row) => ({
      id: row.id as string,
      username: row.personal_username as string,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    }));
}

export async function findPersonByUsername(username: string): Promise<PersonResult | null> {
  const { data, error } = await chatDb
    .from("public_profiles")
    .select("id, personal_username, display_name, avatar_url")
    .ilike("personal_username", username.replace(/^@/, ""))
    .maybeSingle();
  if (error) fail(error, "Could not find that account");
  if (!data?.id || !data.personal_username) return null;
  return {
    id: data.id,
    username: data.personal_username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
  };
}

export async function setBlocked(me: string, other: string, blocked: boolean): Promise<void> {
  const { error } = blocked
    ? await chatDb.from("user_blocks").insert({ blocker_id: me, blocked_id: other })
    : await chatDb.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", other);
  // 23505: already blocked -- the state the user asked for.
  if (error && error.code !== "23505") fail(error, "Could not update the block");
}

export async function report(input: {
  conversationId: string;
  messageId?: string | null;
  reason: string;
  details?: string | null;
}): Promise<void> {
  const { error } = await chatDb.from("message_reports").insert({
    conversation_id: input.conversationId,
    message_id: input.messageId ?? null,
    reason: input.reason,
    details: input.details ?? null,
  });
  if (error) fail(error, "Could not send the report");
}

/* ---------- messages ---------- */

/** One page, oldest-first. Hidden ("deleted for me") messages and anything
 *  before a clear are dropped server-side. */
export async function fetchMessages(
  conversationId: string,
  _me: string,
  options: { before?: string; clearedAt?: string | null },
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const params = new URLSearchParams({ conversationId });
  if (options.before) params.set("before", options.before);
  if (options.clearedAt) params.set("clearedAt", options.clearedAt);
  const page = await chatRequest<{ messages: MessageRow[]; hasMore: boolean }>(
    `/api/chat/messages?${params}`,
    "Could not load messages",
  );
  return { messages: page.messages.map(fromMessageRow), hasMore: page.hasMore };
}

/** Specific messages by id: quotes older than the loaded pages, and a
 *  realtime change, whose payload only carries the ciphertext. */
export async function fetchMessagesById(ids: string[]): Promise<ChatMessage[]> {
  if (ids.length === 0) return [];
  try {
    const { messages } = await chatRequest<{ messages: MessageRow[] }>(
      `/api/chat/messages?ids=${ids.map(encodeURIComponent).join(",")}`,
      "Could not load messages",
    );
    return messages.map(fromMessageRow);
  } catch {
    return [];
  }
}

export async function fetchReactions(conversationId: string) {
  const { data } = await chatDb
    .from("message_reactions")
    .select("message_id, user_id, conversation_id, emoji, created_at")
    .eq("conversation_id", conversationId);
  return data ?? [];
}

export async function isBlockedBy(me: string, other: string): Promise<boolean> {
  const { data } = await chatDb
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", me)
    .eq("blocked_id", other)
    .maybeSingle();
  return !!data;
}

export async function insertMessage(input: {
  id: string;
  conversationId: string;
  /** Unused: the server takes the sender from the session. Kept so callers
   *  read the same as before. */
  senderId: string;
  kind: MessageKind;
  body?: string | null;
  mediaPath?: string | null;
  meta?: MediaMeta;
  replyToId?: string | null;
  forwarded?: boolean;
}): Promise<ChatMessage> {
  const { message } = await chatRequest<{ message: MessageRow }>(
    "/api/chat/messages",
    "Message not sent",
    {
      method: "POST",
      body: JSON.stringify({
        id: input.id,
        conversationId: input.conversationId,
        kind: input.kind,
        body: input.body?.trim() ? input.body.trim() : null,
        mediaPath: input.mediaPath ?? null,
        meta: input.meta ?? null,
        replyToId: input.replyToId ?? null,
        forwarded: input.forwarded ?? false,
      }),
    },
  );
  return fromMessageRow(message);
}

export async function editMessage(id: string, body: string): Promise<void> {
  await chatRequest("/api/chat/messages", "Could not edit the message", {
    method: "PATCH",
    body: JSON.stringify({ id, body: body.trim() }),
  });
}

/* ---------- support ---------- */

export async function fetchSupportMessages(
  options: { latest?: boolean; id?: string } = {},
): Promise<SupportMessageRow[]> {
  const params = new URLSearchParams();
  if (options.latest) params.set("latest", "1");
  if (options.id) params.set("id", options.id);
  const { messages } = await chatRequest<{ messages: SupportMessageRow[] }>(
    `/api/support-messages/mine?${params}`,
    "Messages are temporarily unavailable.",
  );
  return messages;
}

export async function sendSupportMessage(body: string): Promise<SupportMessageRow> {
  const { message } = await chatRequest<{ message: SupportMessageRow }>(
    "/api/support-messages/mine",
    "Your message could not be sent. Please try again.",
    { method: "POST", body: JSON.stringify({ body }) },
  );
  return message;
}

export async function deleteForEveryone(message: ChatMessage): Promise<void> {
  const { error } = await chatDb
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", message.id);
  if (error) fail(error, "Could not delete the message");
  if (message.mediaPath) {
    void chatDb.storage.from(CHAT_MEDIA_BUCKET).remove([message.mediaPath]);
  }
}

export async function deleteForMe(messageIds: string[], me: string): Promise<void> {
  const { error } = await chatDb.from("message_hides").upsert(
    messageIds.map((message_id) => ({ message_id, user_id: me })),
    { onConflict: "message_id,user_id", ignoreDuplicates: true },
  );
  if (error) fail(error, "Could not delete the message");
}

export async function setReaction(messageId: string, me: string, emoji: string | null) {
  if (!emoji) {
    const { error } = await chatDb
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", me);
    if (error) fail(error, "Could not remove the reaction");
    return;
  }
  const { error } = await chatDb
    .from("message_reactions")
    // conversation_id is filled by the message_reactions_set_conversation trigger;
    // the generated Insert type cannot know that, so it is cast in.
    .upsert({ message_id: messageId, user_id: me, emoji } as ReactionInsert, {
      onConflict: "message_id,user_id",
    });
  if (error) fail(error, "Could not react");
}

type ReactionInsert = {
  message_id: string;
  user_id: string;
  emoji: string;
  conversation_id: string;
};

/* ---------- media ---------- */

export async function uploadMedia(
  conversationId: string,
  blob: Blob,
  extension: string,
): Promise<string> {
  const path = `${conversationId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await chatDb.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new ChatError(error.message || "Upload failed");
  return path;
}

// Signed URLs last an hour; re-sign a little before that so an open chat never
// renders a URL that expires mid-scroll.
const SIGNED_TTL_S = 3600;
const signed = new Map<string, { url: string; expires: number }>();
const pending = new Map<string, Promise<string | null>>();

export function cachedMediaUrl(path: string): string | null {
  const hit = signed.get(path);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

export function mediaUrl(path: string): Promise<string | null> {
  const hit = cachedMediaUrl(path);
  if (hit) return Promise.resolve(hit);
  const inFlight = pending.get(path);
  if (inFlight) return inFlight;
  const request = chatDb.storage
    .from(CHAT_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_S)
    .then(({ data }) => {
      pending.delete(path);
      if (!data?.signedUrl) return null;
      signed.set(path, { url: data.signedUrl, expires: Date.now() + (SIGNED_TTL_S - 300) * 1000 });
      return data.signedUrl;
    });
  pending.set(path, request);
  return request;
}

/** Copies a media object into another conversation's folder, for forwarding
 *  -- the target's members could not read it at the source path. */
export async function copyMedia(path: string, targetConversationId: string): Promise<string> {
  const extension = path.split(".").pop() ?? "bin";
  const target = `${targetConversationId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await chatDb.storage.from(CHAT_MEDIA_BUCKET).copy(path, target);
  if (error) throw new ChatError(error.message || "Could not forward that attachment");
  return target;
}
