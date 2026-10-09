/**
 * The browser client, typed for the messaging tables.
 *
 * The generated `types.ts` is a snapshot of the live schema and can only be
 * regenerated from it (see the supabase-data-access skill), so until
 * 20260927120000_add_direct_messages.sql is applied and the types are
 * regenerated, the new tables are described here instead -- the same stopgap
 * messages.tsx already used for support_messages. Once regenerated, delete the
 * hand-written rows below and keep only `chatDb`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Database, Json } from "@/lib/integrations/my-supabase/types";

export type ConversationKind = "direct" | "self";
export type MessageKind = "text" | "image" | "audio";

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  media_meta: Json | null;
  reply_to_id: string | null;
  forwarded: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

export type MemberRow = {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  last_delivered_at: string;
  last_active_at: string | null;
  pinned_at: string | null;
  muted: boolean;
  archived_at: string | null;
  marked_unread: boolean;
  cleared_at: string | null;
};

export type ReactionRow = {
  message_id: string;
  user_id: string;
  conversation_id: string;
  emoji: string;
  created_at: string;
};

/** What the other member of a chat may see of you. Private to its owner since
 *  20260929120000_read_receipts_setting; these two tables carry the rest.
 *  Both are written by the database only. read_at stops advancing while the
 *  reader has receipts off, and the row is invisible to a viewer whose own
 *  receipts are off. */
export type ReadReceiptRow = {
  conversation_id: string;
  user_id: string;
  read_at: string;
};

export type PresenceRow = {
  conversation_id: string;
  user_id: string;
  delivered_at: string;
  active_at: string | null;
};

export type MessagingSettingsRow = {
  user_id: string;
  read_receipts: boolean;
  updated_at: string;
};

export type SupportMessageRow = {
  id: string;
  user_id: string;
  body: string;
  sender: "user" | "support";
  created_at: string;
};

export type InboxRow = {
  conversation_id: string;
  kind: ConversationKind;
  last_message_at: string;
  pinned_at: string | null;
  muted: boolean;
  archived_at: string | null;
  marked_unread: boolean;
  last_read_at: string;
  cleared_at: string | null;
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
  other_last_read_at: string | null;
  other_last_delivered_at: string | null;
  other_last_active_at: string | null;
  blocked_by_me: boolean;
  last_message_id: string | null;
  last_message_sender_id: string | null;
  last_message_kind: MessageKind | null;
  last_message_body: string | null;
  last_message_meta: Json | null;
  last_message_deleted: boolean;
  last_message_created_at: string | null;
  unread_count: number;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type MessagingTables = {
  conversations: Table<
    {
      id: string;
      kind: ConversationKind;
      pair_key: string;
      created_at: string;
      last_message_at: string;
    },
    never,
    never
  >;
  conversation_members: Table<
    MemberRow,
    never,
    Partial<
      Pick<
        MemberRow,
        | "last_read_at"
        | "last_delivered_at"
        | "last_active_at"
        | "pinned_at"
        | "muted"
        | "archived_at"
        | "marked_unread"
        | "cleared_at"
      >
    >
  >;
  messages: Table<
    MessageRow,
    Pick<MessageRow, "conversation_id" | "sender_id"> &
      Partial<
        Pick<
          MessageRow,
          "id" | "kind" | "body" | "media_path" | "media_meta" | "reply_to_id" | "forwarded"
        >
      >,
    Partial<Pick<MessageRow, "body" | "edited_at" | "deleted_at">>
  >;
  message_reactions: Table<
    ReactionRow,
    Pick<ReactionRow, "message_id" | "user_id" | "emoji">,
    Pick<ReactionRow, "emoji">
  >;
  message_hides: Table<
    { message_id: string; user_id: string; created_at: string },
    { message_id: string; user_id: string },
    never
  >;
  user_blocks: Table<
    { blocker_id: string; blocked_id: string; created_at: string },
    { blocker_id: string; blocked_id: string },
    never
  >;
  message_reports: Table<
    {
      id: string;
      reporter_id: string;
      conversation_id: string;
      message_id: string | null;
      reason: string;
      details: string | null;
      created_at: string;
    },
    {
      conversation_id: string;
      message_id?: string | null;
      reason: string;
      details?: string | null;
    },
    never
  >;
  conversation_read_receipts: Table<ReadReceiptRow, never, never>;
  conversation_presence: Table<PresenceRow, never, never>;
  messaging_settings: Table<
    MessagingSettingsRow,
    Pick<MessagingSettingsRow, "user_id"> & Partial<MessagingSettingsRow>,
    Partial<Pick<MessagingSettingsRow, "read_receipts" | "updated_at">>
  >;
  support_messages: Table<
    SupportMessageRow,
    Pick<SupportMessageRow, "user_id" | "body" | "sender"> & { id?: string },
    Partial<Pick<SupportMessageRow, "body" | "sender">>
  >;
};

type MessagingFunctions = {
  start_direct_conversation: { Args: { other_user: string }; Returns: string };
  start_self_conversation: { Args: Record<string, never>; Returns: string };
  list_inbox: { Args: Record<string, never>; Returns: InboxRow[] };
  touch_messaging_presence: { Args: Record<string, never>; Returns: undefined };
};

export type MessagingDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & MessagingTables;
    Functions: Database["public"]["Functions"] & MessagingFunctions;
  };
};

/** The client chat runs on. Normally the app's own session; a storefront
 *  swaps in its buyer identity while it's on screen (buyer-session.ts), so a
 *  seller previewing their own website chats as an anonymous buyer without
 *  being signed out of their store. Only one chat surface is ever mounted at
 *  a time, which is what makes a single switch safe. */
let activeClient: SupabaseClient = supabase as unknown as SupabaseClient;

export function setChatClient(client: SupabaseClient | null) {
  activeClient = client ?? (supabase as unknown as SupabaseClient);
}

export function getChatClient(): SupabaseClient {
  return activeClient;
}

export const chatDb = new Proxy({} as SupabaseClient<MessagingDatabase>, {
  get(_, prop) {
    const value = Reflect.get(activeClient, prop, activeClient);
    return typeof value === "function" ? value.bind(activeClient) : value;
  },
});

export const CHAT_MEDIA_BUCKET = "chat-media";

/** PostgREST's answer when a table or function is not in its schema cache --
 *  i.e. the messaging migration has not been applied to this database yet. */
export function isMissingSchema(error: { code?: string } | null | undefined): boolean {
  return (
    !!error &&
    (error.code === "PGRST202" ||
      error.code === "PGRST205" ||
      error.code === "42P01" ||
      error.code === "42883")
  );
}
