import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  chatDb,
  isMissingSchema,
  type MemberRow,
  type PresenceRow,
  type ReadReceiptRow,
  type SupportMessageRow,
} from "./db";
import * as api from "./api";
import { SUPPORT_CHAT_ID, sortChats, type Chat } from "./model";

export type InboxStatus = "loading" | "ready" | "signed-out" | "unavailable" | "error";

const HEARTBEAT_MS = 45_000;
const TYPING_TTL_MS = 4_000;

/** The Oakmonte Support thread, dressed as a chat. It lives on
 *  support_messages, not the messaging tables, so it has no pin/mute/read
 *  state of its own on the server; those are kept for the session only. */
function supportChat(last: SupportMessageRow | null, me: string | null): Chat {
  return {
    id: SUPPORT_CHAT_ID,
    kind: "support",
    title: "Oakmonte Support",
    handle: null,
    peer: null,
    verified: true,
    lastMessageAt: last?.created_at ?? new Date(0).toISOString(),
    lastMessage: last
      ? {
          id: last.id,
          mine: last.sender === "user" && last.user_id === me,
          kind: "text",
          body: last.body,
          meta: {},
          deleted: false,
          createdAt: last.created_at,
        }
      : null,
    unreadCount: 0,
    markedUnread: false,
    pinnedAt: null,
    muted: false,
    archivedAt: null,
    lastReadAt: null,
    clearedAt: null,
    peerLastReadAt: null,
    peerLastDeliveredAt: null,
    peerLastActiveAt: null,
    blockedByMe: false,
  };
}

export function useInbox(me: string | null, sessionLoading: boolean) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [support, setSupport] = useState<Chat>(() => supportChat(null, null));
  const [status, setStatus] = useState<InboxStatus>("loading");
  const [typing, setTyping] = useState<Record<string, number>>({});
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ensuredSelf = useRef(false);

  const load = useCallback(async () => {
    if (!me) return;
    try {
      let next = await api.listInbox(me);
      if (!next.some((chat) => chat.kind === "self") && !ensuredSelf.current) {
        ensuredSelf.current = true;
        await api.startSelfConversation();
        next = await api.listInbox(me);
      }
      setChats(next);
      setStatus("ready");
    } catch (error) {
      setStatus(isMissingSchema(error as { code?: string }) ? "unavailable" : "error");
    }
  }, [me]);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void load(), 250);
  }, [load]);

  const loadSupport = useCallback(async () => {
    if (!me) return;
    const { data } = await chatDb
      .from("support_messages")
      .select("id, user_id, body, sender, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSupport((current) => ({
      ...supportChat((data as SupportMessageRow | null) ?? null, me),
      pinnedAt: current.pinnedAt,
      muted: current.muted,
      archivedAt: current.archivedAt,
      markedUnread: current.markedUnread,
    }));
  }, [me]);

  /* ---------- initial load ---------- */
  useEffect(() => {
    if (sessionLoading) return;
    if (!me) {
      setChats([]);
      setStatus("signed-out");
      return;
    }
    setStatus("loading");
    void load();
    void loadSupport();
    void api.touchPresence().catch(() => undefined);
  }, [me, sessionLoading, load, loadSupport]);

  /* ---------- realtime: new messages, read receipts, typing ---------- */
  useEffect(() => {
    if (!me || status === "unavailable" || status === "signed-out") return;

    const changes: RealtimeChannel = chatDb
      .channel(`inbox:${me}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        scheduleReload();
        // Receiving a message while the app is open is delivery.
        const row = payload.new as { sender_id?: string } | undefined;
        if (payload.eventType === "INSERT" && row?.sender_id !== me) {
          void api.touchPresence().catch(() => undefined);
        }
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_members" },
        (payload) => {
          const row = payload.new as MemberRow;
          if (row.user_id === me) {
            // Another device changed pin/mute/archive/read state.
            scheduleReload();
            return;
          }
          // Only reachable on a database without the read-receipts
          // migration: after it, the other member's row is private and the
          // two subscriptions below carry what we may see of them.
          setChats((current) =>
            current.map((chat) =>
              chat.id === row.conversation_id
                ? {
                    ...chat,
                    peerLastReadAt: row.last_read_at,
                    peerLastDeliveredAt: row.last_delivered_at,
                    peerLastActiveAt: row.last_active_at,
                  }
                : chat,
            ),
          );
        },
      )
      // RLS decides what arrives: a peer's read receipt only while my own
      // receipts are on, which is what makes them reciprocal.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_read_receipts" },
        (payload) => {
          const row = payload.new as ReadReceiptRow;
          if (row.user_id === me) return;
          setChats((current) =>
            current.map((chat) =>
              chat.id === row.conversation_id ? { ...chat, peerLastReadAt: row.read_at } : chat,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_presence" },
        (payload) => {
          const row = payload.new as PresenceRow;
          if (row.user_id === me) return;
          setChats((current) =>
            current.map((chat) =>
              chat.id === row.conversation_id
                ? {
                    ...chat,
                    peerLastDeliveredAt: row.delivered_at,
                    peerLastActiveAt: row.active_at,
                  }
                : chat,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `user_id=eq.${me}`,
        },
        () => void loadSupport(),
      )
      .subscribe();

    // Typing is ephemeral, so it rides broadcast rather than the database:
    // whoever is typing to us sends on our personal channel.
    const personal = chatDb
      .channel(`chat-user:${me}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const conversationId = (payload as { conversation_id?: string }).conversation_id;
        if (!conversationId) return;
        setTyping((current) => ({ ...current, [conversationId]: Date.now() + TYPING_TTL_MS }));
      })
      .on("broadcast", { event: "stop-typing" }, ({ payload }) => {
        const conversationId = (payload as { conversation_id?: string }).conversation_id;
        if (!conversationId) return;
        setTyping((current) => {
          const next = { ...current };
          delete next[conversationId];
          return next;
        });
      })
      .subscribe();

    return () => {
      void chatDb.removeChannel(changes);
      void chatDb.removeChannel(personal);
    };
  }, [me, status, scheduleReload, loadSupport]);

  /* ---------- expire typing flags ---------- */
  useEffect(() => {
    const ids = Object.keys(typing);
    if (ids.length === 0) return;
    const soonest = Math.min(...Object.values(typing));
    const timer = setTimeout(
      () => {
        const now = Date.now();
        setTyping((current) =>
          Object.fromEntries(Object.entries(current).filter(([, until]) => until > now)),
        );
      },
      Math.max(50, soonest - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [typing]);

  /* ---------- presence heartbeat while visible ---------- */
  useEffect(() => {
    if (!me || status !== "ready") return;
    const beat = () => {
      if (document.visibilityState === "visible") void api.touchPresence().catch(() => undefined);
    };
    const interval = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        beat();
        scheduleReload();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [me, status, scheduleReload]);

  useEffect(
    () => () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    },
    [],
  );

  /* ---------- actions ---------- */
  const patch = useCallback((id: string, changes: Partial<Chat>) => {
    if (id === SUPPORT_CHAT_ID) {
      setSupport((current) => ({ ...current, ...changes }));
      return;
    }
    setChats((current) => current.map((chat) => (chat.id === id ? { ...chat, ...changes } : chat)));
  }, []);

  /** Optimistic local change + server write; reloads to the truth on failure. */
  const mutate = useCallback(
    async (
      id: string,
      changes: Partial<Chat>,
      write: Parameters<typeof api.updateMembership>[2],
    ) => {
      patch(id, changes);
      if (id === SUPPORT_CHAT_ID || !me) return;
      try {
        await api.updateMembership(id, me, write);
      } catch (error) {
        scheduleReload();
        throw error;
      }
    },
    [me, patch, scheduleReload],
  );

  const actions = {
    togglePin: (chat: Chat) => {
      const pinnedAt = chat.pinnedAt ? null : new Date().toISOString();
      return mutate(chat.id, { pinnedAt }, { pinned_at: pinnedAt });
    },
    toggleMute: (chat: Chat) => mutate(chat.id, { muted: !chat.muted }, { muted: !chat.muted }),
    toggleArchive: (chat: Chat) => {
      const archivedAt = chat.archivedAt ? null : new Date().toISOString();
      // Archiving unpins, as in WhatsApp -- a pinned chat you can't see is noise.
      return mutate(
        chat.id,
        { archivedAt, pinnedAt: archivedAt ? null : chat.pinnedAt },
        archivedAt ? { archived_at: archivedAt, pinned_at: null } : { archived_at: null },
      );
    },
    markRead: (chat: Chat) =>
      mutate(
        chat.id,
        { unreadCount: 0, markedUnread: false, lastReadAt: new Date().toISOString() },
        { last_read_at: new Date().toISOString(), marked_unread: false },
      ),
    markUnread: (chat: Chat) => mutate(chat.id, { markedUnread: true }, { marked_unread: true }),
    /** WhatsApp's "Delete chat": clears it for me and drops it from the list
     *  until someone writes again. */
    deleteChat: async (chat: Chat) => {
      const now = new Date().toISOString();
      if (chat.kind === "self") {
        await mutate(chat.id, { lastMessage: null, unreadCount: 0 }, { cleared_at: now });
        return;
      }
      setChats((current) => current.filter((item) => item.id !== chat.id));
      if (!me) return;
      try {
        await api.updateMembership(chat.id, me, { cleared_at: now, pinned_at: null });
      } finally {
        scheduleReload();
      }
    },
    clearChat: (chat: Chat) => {
      const now = new Date().toISOString();
      return mutate(
        chat.id,
        { lastMessage: null, unreadCount: 0, markedUnread: false, clearedAt: now },
        { cleared_at: now, marked_unread: false },
      );
    },
  };

  const typingIn = useCallback((id: string) => (typing[id] ?? 0) > Date.now(), [typing]);

  return {
    chats: sortChats(chats),
    support,
    status,
    reload: load,
    reloadSupport: loadSupport,
    patch,
    actions,
    typingIn,
  };
}

export type InboxActions = ReturnType<typeof useInbox>["actions"];
