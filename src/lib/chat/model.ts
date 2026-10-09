/**
 * The shapes the messaging UI works in, and the pure rules on top of them
 * (ticks, presence, previews). Kept free of Supabase so they can be unit
 * tested -- see model.test.ts.
 */
import type { Json } from "@/lib/integrations/my-supabase/types";
import type { InboxRow, MessageKind, MessageRow, ReactionRow } from "./db";

export const SUPPORT_CHAT_ID = "support";

export type ChatKind = "direct" | "self" | "support";

export type ChatPeer = {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type ChatLastMessage = {
  id: string;
  mine: boolean;
  kind: MessageKind;
  body: string | null;
  meta: MediaMeta;
  deleted: boolean;
  createdAt: string;
};

export type Chat = {
  id: string;
  kind: ChatKind;
  title: string;
  handle: string | null;
  peer: ChatPeer | null;
  verified: boolean;
  lastMessageAt: string;
  lastMessage: ChatLastMessage | null;
  unreadCount: number;
  markedUnread: boolean;
  pinnedAt: string | null;
  muted: boolean;
  archivedAt: string | null;
  lastReadAt: string | null;
  clearedAt: string | null;
  peerLastReadAt: string | null;
  peerLastDeliveredAt: string | null;
  peerLastActiveAt: string | null;
  blockedByMe: boolean;
};

export type MediaMeta = {
  width?: number;
  height?: number;
  /** Seconds. */
  duration?: number;
  /** 0..1 amplitudes, ~40 bars, for the voice-note waveform. */
  waveform?: number[];
  /** A product enquiry from a storefront: the piece the buyer is asking about,
   *  shown as a card above their caption. */
  product?: EnquiryProduct;
};

export type EnquiryProduct = {
  id: string;
  title: string;
  /** Naira, as the buyer saw it. */
  price: number | null;
  images: string[];
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  body: string | null;
  mediaPath: string | null;
  meta: MediaMeta;
  replyToId: string | null;
  forwarded: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  /** Local only: optimistic sends. */
  status?: "sending" | "failed";
  /** Local only: a blob: URL shown while the upload is in flight. */
  localUrl?: string;
};

export type Tick = "sending" | "failed" | "sent" | "delivered" | "read";

export function parseMeta(value: Json | null | undefined): MediaMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, Json | undefined>;
  const meta: MediaMeta = {};
  if (typeof record.width === "number") meta.width = record.width;
  if (typeof record.height === "number") meta.height = record.height;
  if (typeof record.duration === "number") meta.duration = record.duration;
  if (Array.isArray(record.waveform)) {
    meta.waveform = record.waveform.filter((n): n is number => typeof n === "number");
  }
  const p = record.product as Record<string, unknown> | undefined;
  if (p && typeof p === "object" && typeof p.id === "string" && typeof p.title === "string") {
    meta.product = {
      id: p.id,
      title: p.title,
      price: typeof p.price === "number" ? p.price : null,
      images: Array.isArray(p.images)
        ? p.images.filter((u): u is string => typeof u === "string").slice(0, 8)
        : [],
    };
  }
  return meta;
}

export function fromMessageRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    kind: row.kind,
    body: row.body,
    mediaPath: row.media_path,
    meta: parseMeta(row.media_meta),
    replyToId: row.reply_to_id,
    forwarded: row.forwarded,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

/** How a buyer without an account shows up to a seller: stable per buyer,
 *  short enough to read, and obviously not a chosen name. */
export function customerName(userId: string): string {
  return `customer-${userId.replace(/-/g, "").slice(0, 6)}`;
}

export function fromInboxRow(row: InboxRow, me: string): Chat {
  const self = row.kind === "self";
  const name = self
    ? "Me"
    : row.other_display_name?.trim() ||
      // An anonymous buyer's profile is named customer-<12 hex> (unique);
      // sellers see the short form.
      (row.other_username?.startsWith("customer-") && row.other_user_id
        ? customerName(row.other_user_id)
        : row.other_username) ||
      // No profile at all: an anonymous buyer from a storefront.
      (row.other_user_id ? customerName(row.other_user_id) : "Oakmonte user");
  return {
    id: row.conversation_id,
    kind: row.kind,
    title: name,
    handle: self ? null : row.other_username,
    peer: row.other_user_id
      ? {
          id: row.other_user_id,
          username: row.other_username,
          displayName: row.other_display_name,
          avatarUrl: row.other_avatar_url,
        }
      : null,
    verified: false,
    lastMessageAt: row.last_message_created_at ?? row.last_message_at,
    lastMessage: row.last_message_id
      ? {
          id: row.last_message_id,
          mine: row.last_message_sender_id === me,
          kind: row.last_message_kind ?? "text",
          body: row.last_message_body,
          meta: parseMeta(row.last_message_meta),
          deleted: row.last_message_deleted,
          createdAt: row.last_message_created_at ?? row.last_message_at,
        }
      : null,
    unreadCount: row.unread_count,
    markedUnread: row.marked_unread,
    pinnedAt: row.pinned_at,
    muted: row.muted,
    archivedAt: row.archived_at,
    lastReadAt: row.last_read_at,
    clearedAt: row.cleared_at,
    peerLastReadAt: row.other_last_read_at,
    peerLastDeliveredAt: row.other_last_delivered_at,
    peerLastActiveAt: row.other_last_active_at,
    blockedByMe: row.blocked_by_me,
  };
}

/** Pinned first (most recently pinned on top, like Telegram), then by the
 *  latest message. */
export function sortChats(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    if (a.pinnedAt && b.pinnedAt) return b.pinnedAt.localeCompare(a.pinnedAt);
    if (a.pinnedAt) return -1;
    if (b.pinnedAt) return 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

export function isUnread(chat: Chat): boolean {
  return chat.unreadCount > 0 || chat.markedUnread;
}

/** One tick per message of mine: the peer's read/delivered watermarks decide
 *  it, not per-message receipts. "Me" notes are always read. */
export function tickFor(
  message: Pick<ChatMessage, "createdAt" | "status">,
  chat: Pick<Chat, "kind" | "peerLastReadAt" | "peerLastDeliveredAt">,
): Tick {
  if (message.status) return message.status;
  if (chat.kind === "self") return "read";
  const at = new Date(message.createdAt).getTime();
  if (chat.peerLastReadAt && new Date(chat.peerLastReadAt).getTime() >= at) return "read";
  if (chat.peerLastDeliveredAt && new Date(chat.peerLastDeliveredAt).getTime() >= at) {
    return "delivered";
  }
  return "sent";
}

export const ONLINE_WINDOW_MS = 90_000;

export function isOnline(lastActiveAt: string | null, now = Date.now()): boolean {
  return !!lastActiveAt && now - new Date(lastActiveAt).getTime() < ONLINE_WINDOW_MS;
}

/** "online" · "last seen 12m ago" · "last seen yesterday" · null */
export function presenceLabel(lastActiveAt: string | null, now = Date.now()): string | null {
  if (!lastActiveAt) return null;
  const diff = now - new Date(lastActiveAt).getTime();
  if (diff < ONLINE_WINDOW_MS) return "online";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `last seen ${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "last seen yesterday";
  if (days < 7) return `last seen ${days}d ago`;
  return "last seen a while ago";
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** What the inbox row and reply quotes say about a message. */
export function describeMessage(
  message: Pick<ChatMessage, "kind" | "body" | "meta"> & { deleted?: boolean },
): string {
  if (message.deleted) return "This message was deleted";
  if (message.kind === "image") return message.body?.trim() ? `Photo · ${message.body}` : "Photo";
  if (message.kind === "audio") {
    return message.meta.duration
      ? `Voice message · ${formatDuration(message.meta.duration)}`
      : "Voice message";
  }
  return message.body ?? "";
}

export type ReactionSummary = { emoji: string; count: number; mine: boolean };

export function summariseReactions(rows: ReactionRow[], me: string): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>();
  for (const row of rows) {
    const entry = byEmoji.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    entry.count += 1;
    if (row.user_id === me) entry.mine = true;
    byEmoji.set(row.emoji, entry);
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count);
}

export const EDIT_WINDOW_MS = 15 * 60_000;

export function canEdit(message: ChatMessage, me: string, now = Date.now()): boolean {
  return (
    message.senderId === me &&
    message.kind === "text" &&
    !message.deletedAt &&
    !message.status &&
    now - new Date(message.createdAt).getTime() < EDIT_WINDOW_MS
  );
}

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/g;

/** Splits text into plain and link runs, for tappable links in bubbles. */
export function linkify(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index) });
    parts.push({ text: match[0], href: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** A message made only of 1-3 emoji renders big and bubble-less, like
 *  WhatsApp and Telegram. */
export function isJumboEmoji(text: string | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 24) return false;
  // Joiners, variation selectors and skin tones only ever modify an emoji;
  // what's left must be pictographs (or flag letters) and nothing else.
  const bare = trimmed.replace(/\s|\u200d|\ufe0f/gu, "").replace(/\p{Emoji_Modifier}/gu, "");
  if (!/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})+$/u.test(bare)) return false;
  const segmenter =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
      : null;
  const count = segmenter
    ? [...segmenter.segment(trimmed.replace(/\s/g, ""))].length
    : [...trimmed.replace(/\s/g, "")].length;
  return count >= 1 && count <= 3;
}
