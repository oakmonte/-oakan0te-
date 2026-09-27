import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { chatDb, type MessageRow, type ReactionRow, type SupportMessageRow } from "./db";
import * as api from "./api";
import { prepareImage, type VoiceRecording } from "./media";
import {
  fromMessageRow,
  summariseReactions,
  type Chat,
  type ChatMessage,
  type ReactionSummary,
} from "./model";

export type ThreadCapabilities = {
  media: boolean;
  voice: boolean;
  react: boolean;
  reply: boolean;
  edit: boolean;
  delete: boolean;
  forward: boolean;
  report: boolean;
  typing: boolean;
};

/** What ChatThread needs from any conversation, real or support. */
export type ThreadController = {
  messages: ChatMessage[];
  reactions: Record<string, ReactionSummary[]>;
  /** Replied-to messages, by id, including ones older than the loaded pages. */
  quotes: Record<string, ChatMessage>;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingOlder: boolean;
  capabilities: ThreadCapabilities;
  loadOlder: () => Promise<void>;
  /** Pages back until everything is loaded (or a cap), for in-chat search. */
  loadAll: () => Promise<void>;
  sendText: (text: string, replyToId: string | null) => Promise<void>;
  sendImages: (files: File[], caption: string, replyToId: string | null) => Promise<void>;
  sendVoice: (recording: VoiceRecording, replyToId: string | null) => Promise<void>;
  retry: (id: string) => Promise<void>;
  discard: (id: string) => void;
  edit: (id: string, body: string) => Promise<void>;
  deleteForEveryone: (message: ChatMessage) => Promise<void>;
  deleteForMe: (ids: string[]) => Promise<void>;
  react: (id: string, emoji: string | null) => Promise<void>;
  notifyTyping: (active: boolean) => void;
};

const LOAD_ALL_CAP = 20;

type Pending = {
  retry: () => Promise<void>;
};

export function useThread(
  chat: Chat | null,
  me: string | null,
  options: { onSent?: () => void; onError?: (message: string) => void } = {},
): ThreadController {
  const conversationId = chat && chat.kind !== "support" ? chat.id : null;
  const clearedAt = chat?.clearedAt ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactionRows, setReactionRows] = useState<ReactionRow[]>([]);
  const [extraQuotes, setExtraQuotes] = useState<Record<string, ChatMessage>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pending = useRef(new Map<string, Pending>());
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /* ---------- first page + realtime ---------- */
  useEffect(() => {
    setMessages([]);
    setReactionRows([]);
    setExtraQuotes({});
    setError(null);
    setHasMore(false);
    pending.current.clear();
    if (!conversationId || !me) return;

    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.fetchMessages(conversationId, me, { clearedAt }),
      api.fetchReactions(conversationId),
    ])
      .then(([page, reactions]) => {
        if (cancelled) return;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setReactionRows(reactions);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message || "Could not load messages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const channel: RealtimeChannel = chatDb
      .channel(`thread:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = fromMessageRow(payload.new as MessageRow);
          setMessages((current) => upsert(current, message));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = fromMessageRow(payload.new as MessageRow);
          setMessages((current) =>
            current.map((item) => (item.id === message.id ? { ...message } : item)),
          );
          setExtraQuotes((current) =>
            current[message.id] ? { ...current, [message.id]: message } : current,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<ReactionRow>;
            setReactionRows((current) =>
              current.filter(
                (row) => !(row.message_id === old.message_id && row.user_id === old.user_id),
              ),
            );
            return;
          }
          const row = payload.new as ReactionRow;
          setReactionRows((current) => [
            ...current.filter(
              (item) => !(item.message_id === row.message_id && item.user_id === row.user_id),
            ),
            row,
          ]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void chatDb.removeChannel(channel);
    };
  }, [conversationId, me, clearedAt]);

  /* ---------- quotes older than the loaded pages ---------- */
  useEffect(() => {
    const loaded = new Set(messages.map((message) => message.id));
    const missing = [
      ...new Set(
        messages
          .map((message) => message.replyToId)
          .filter((id): id is string => !!id && !loaded.has(id) && !extraQuotes[id]),
      ),
    ];
    if (missing.length === 0) return;
    let cancelled = false;
    void api.fetchMessagesById(missing).then((found) => {
      if (cancelled || found.length === 0) return;
      setExtraQuotes((current) => {
        const next = { ...current };
        for (const message of found) next[message.id] = message;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [messages, extraQuotes]);

  const quotes = useMemo(() => {
    const byId: Record<string, ChatMessage> = { ...extraQuotes };
    for (const message of messages) byId[message.id] = message;
    return byId;
  }, [messages, extraQuotes]);

  const reactions = useMemo(() => {
    if (!me) return {};
    const grouped: Record<string, ReactionRow[]> = {};
    for (const row of reactionRows) (grouped[row.message_id] ??= []).push(row);
    return Object.fromEntries(
      Object.entries(grouped).map(([id, rows]) => [id, summariseReactions(rows, me)]),
    );
  }, [reactionRows, me]);

  /* ---------- paging ---------- */
  const loadOlder = useCallback(async () => {
    if (!conversationId || !me || loadingOlder || !hasMore) return;
    const oldest = messagesRef.current.find((message) => !message.status);
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = await api.fetchMessages(conversationId, me, {
        before: oldest.createdAt,
        clearedAt,
      });
      setMessages((current) => [
        ...page.messages.filter((m) => !quotesHas(current, m.id)),
        ...current,
      ]);
      setHasMore(page.hasMore);
    } catch (reason) {
      optionsRef.current.onError?.((reason as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, me, loadingOlder, hasMore, clearedAt]);

  const loadAll = useCallback(async () => {
    if (!conversationId || !me) return;
    let more = hasMore;
    let rounds = 0;
    setLoadingOlder(true);
    try {
      while (more && rounds < LOAD_ALL_CAP) {
        rounds += 1;
        const oldest = messagesRef.current.find((message) => !message.status);
        if (!oldest) break;
        const page = await api.fetchMessages(conversationId, me, {
          before: oldest.createdAt,
          clearedAt,
        });
        messagesRef.current = [...page.messages, ...messagesRef.current];
        setMessages(messagesRef.current);
        more = page.hasMore;
      }
      setHasMore(more);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, me, hasMore, clearedAt]);

  /* ---------- sending ---------- */
  const replaceLocal = (id: string, changes: Partial<ChatMessage> | ChatMessage) =>
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...changes } : message)),
    );

  const run = useCallback(async (optimistic: ChatMessage, send: () => Promise<ChatMessage>) => {
    const attempt = async () => {
      replaceLocal(optimistic.id, { status: "sending" });
      try {
        const saved = await send();
        pending.current.delete(optimistic.id);
        // Keep the local blob URL: it is already decoded, and swapping to
        // the signed URL mid-view would flash.
        setMessages((current) => upsert(current, { ...saved, localUrl: optimistic.localUrl }));
        optionsRef.current.onSent?.();
      } catch (reason) {
        replaceLocal(optimistic.id, { status: "failed" });
        optionsRef.current.onError?.((reason as Error).message || "Message not sent");
      }
    };
    pending.current.set(optimistic.id, { retry: attempt });
    setMessages((current) => [...current, optimistic]);
    await attempt();
  }, []);

  const base = (kind: ChatMessage["kind"], replyToId: string | null): ChatMessage => ({
    id: crypto.randomUUID(),
    conversationId: conversationId ?? "",
    senderId: me ?? "",
    kind,
    body: null,
    mediaPath: null,
    meta: {},
    replyToId,
    forwarded: false,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    status: "sending",
  });

  const sendText = useCallback(
    async (text: string, replyToId: string | null) => {
      if (!conversationId || !me || !text.trim()) return;
      const optimistic = { ...base("text", replyToId), body: text.trim() };
      await run(optimistic, () =>
        api.insertMessage({
          id: optimistic.id,
          conversationId,
          senderId: me,
          kind: "text",
          body: optimistic.body,
          replyToId,
        }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, me, run],
  );

  const sendImages = useCallback(
    async (files: File[], caption: string, replyToId: string | null) => {
      if (!conversationId || !me) return;
      await Promise.all(
        files.map(async (file, index) => {
          const optimistic: ChatMessage = {
            ...base("image", index === 0 ? replyToId : null),
            body: index === 0 && caption.trim() ? caption.trim() : null,
            localUrl: URL.createObjectURL(file),
          };
          let uploaded: string | null = null;
          await run(optimistic, async () => {
            const prepared = await prepareImage(file);
            const meta = { width: prepared.width, height: prepared.height };
            replaceLocal(optimistic.id, { meta });
            uploaded ??= await api.uploadMedia(conversationId, prepared.blob, prepared.extension);
            return api.insertMessage({
              id: optimistic.id,
              conversationId,
              senderId: me,
              kind: "image",
              body: optimistic.body,
              mediaPath: uploaded,
              meta,
              replyToId: optimistic.replyToId,
            });
          });
        }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, me, run],
  );

  const sendVoice = useCallback(
    async (recording: VoiceRecording, replyToId: string | null) => {
      if (!conversationId || !me) return;
      const meta = { duration: recording.duration, waveform: recording.waveform };
      const optimistic: ChatMessage = {
        ...base("audio", replyToId),
        meta,
        localUrl: URL.createObjectURL(recording.blob),
      };
      let uploaded: string | null = null;
      await run(optimistic, async () => {
        uploaded ??= await api.uploadMedia(conversationId, recording.blob, recording.extension);
        return api.insertMessage({
          id: optimistic.id,
          conversationId,
          senderId: me,
          kind: "audio",
          mediaPath: uploaded,
          meta,
          replyToId,
        });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, me, run],
  );

  const retry = useCallback(async (id: string) => {
    await pending.current.get(id)?.retry();
  }, []);

  const discard = useCallback((id: string) => {
    pending.current.delete(id);
    setMessages((current) => {
      const gone = current.find((message) => message.id === id);
      if (gone?.localUrl) URL.revokeObjectURL(gone.localUrl);
      return current.filter((message) => message.id !== id);
    });
  }, []);

  /* ---------- changing messages ---------- */
  const edit = useCallback(async (id: string, body: string) => {
    const previous = messagesRef.current.find((message) => message.id === id);
    replaceLocal(id, { body: body.trim(), editedAt: new Date().toISOString() });
    try {
      await api.editMessage(id, body);
    } catch (reason) {
      if (previous) replaceLocal(id, previous);
      throw reason;
    }
  }, []);

  const deleteForEveryone = useCallback(async (message: ChatMessage) => {
    replaceLocal(message.id, {
      deletedAt: new Date().toISOString(),
      body: null,
      mediaPath: null,
    });
    try {
      await api.deleteForEveryone(message);
    } catch (reason) {
      replaceLocal(message.id, message);
      throw reason;
    }
  }, []);

  const deleteForMe = useCallback(
    async (ids: string[]) => {
      if (!me) return;
      const removed = messagesRef.current.filter((message) => ids.includes(message.id));
      setMessages((current) => current.filter((message) => !ids.includes(message.id)));
      try {
        await api.deleteForMe(ids, me);
      } catch (reason) {
        setMessages((current) =>
          [...current, ...removed].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        );
        throw reason;
      }
    },
    [me],
  );

  const react = useCallback(
    async (id: string, emoji: string | null) => {
      if (!me || !conversationId) return;
      const before = reactionRows;
      setReactionRows((current) => {
        const rest = current.filter((row) => !(row.message_id === id && row.user_id === me));
        return emoji
          ? [
              ...rest,
              {
                message_id: id,
                user_id: me,
                conversation_id: conversationId,
                emoji,
                created_at: new Date().toISOString(),
              },
            ]
          : rest;
      });
      try {
        await api.setReaction(id, me, emoji);
      } catch (reason) {
        setReactionRows(before);
        throw reason;
      }
    },
    [me, conversationId, reactionRows],
  );

  /* ---------- typing, sent to the peer's personal channel ---------- */
  const peerId = chat?.kind === "direct" ? (chat.peer?.id ?? null) : null;
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (!peerId || !conversationId) return;
    const channel = chatDb.channel(`chat-user:${peerId}`).subscribe();
    typingChannel.current = channel;
    return () => {
      typingChannel.current = null;
      void chatDb.removeChannel(channel);
    };
  }, [peerId, conversationId]);

  const notifyTyping = useCallback(
    (active: boolean) => {
      const channel = typingChannel.current;
      if (!channel || !conversationId) return;
      const now = Date.now();
      if (active && now - lastTypingSent.current < 2500) return;
      lastTypingSent.current = active ? now : 0;
      void channel.send({
        type: "broadcast",
        event: active ? "typing" : "stop-typing",
        payload: { conversation_id: conversationId },
      });
    },
    [conversationId],
  );

  return {
    messages,
    reactions,
    quotes,
    loading,
    error,
    hasMore,
    loadingOlder,
    capabilities: {
      media: true,
      voice: true,
      react: true,
      reply: true,
      edit: true,
      delete: true,
      forward: true,
      report: chat?.kind === "direct",
      typing: chat?.kind === "direct",
    },
    loadOlder,
    loadAll,
    sendText,
    sendImages,
    sendVoice,
    retry,
    discard,
    edit,
    deleteForEveryone,
    deleteForMe,
    react,
    notifyTyping,
  };
}

function quotesHas(list: ChatMessage[], id: string) {
  return list.some((message) => message.id === id);
}

/** Insert or replace by id, keeping chronological order. The realtime echo of
 *  our own insert lands here too and simply replaces the optimistic copy. */
function upsert(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  const index = list.findIndex((item) => item.id === message.id);
  if (index >= 0) {
    const next = [...list];
    next[index] = { ...message, localUrl: list[index].localUrl ?? message.localUrl };
    return next;
  }
  const next = [...list, message];
  next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return next;
}

/* ---------- Oakmonte Support ---------- */

const NOOP = async () => undefined;

function fromSupportRow(row: SupportMessageRow, me: string): ChatMessage {
  return {
    id: row.id,
    conversationId: "support",
    senderId: row.sender === "user" ? me : "support",
    kind: "text",
    body: row.body,
    mediaPath: null,
    meta: {},
    replyToId: null,
    forwarded: false,
    editedAt: null,
    deletedAt: null,
    createdAt: row.created_at,
  };
}

/** support_messages carries text only, and only staff can reply (through
 *  api.support-messages.reply), so everything but sending is switched off. */
export function useSupportThread(
  open: boolean,
  me: string | null,
  options: { onError?: (message: string) => void } = {},
): ThreadController {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const pending = useRef(new Map<string, string>());

  useEffect(() => {
    if (!open || !me) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void chatDb
      .from("support_messages")
      .select("id, user_id, body, sender, created_at")
      .eq("user_id", me)
      .order("created_at", { ascending: true })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) setError("Messages are temporarily unavailable.");
        else
          setMessages(((data ?? []) as SupportMessageRow[]).map((row) => fromSupportRow(row, me)));
        setLoading(false);
      });

    const channel = chatDb
      .channel(`support-messages-${me}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `user_id=eq.${me}`,
        },
        (payload) => {
          const message = fromSupportRow(payload.new as SupportMessageRow, me);
          setMessages((current) => {
            if (current.some((item) => item.id === message.id)) return current;
            // Our own insert echoing back: swap out the optimistic copy.
            const optimistic = current.find(
              (item) => item.status && item.senderId === me && item.body === message.body,
            );
            if (optimistic) {
              pending.current.delete(optimistic.id);
              return current.map((item) => (item.id === optimistic.id ? message : item));
            }
            return [...current, message];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void chatDb.removeChannel(channel);
    };
  }, [open, me]);

  const send = useCallback(
    async (id: string, text: string) => {
      if (!me) return;
      setMessages((current) =>
        current.map((item) => (item.id === id ? { ...item, status: "sending" } : item)),
      );
      const { data, error: sendError } = await chatDb
        .from("support_messages")
        .insert({ user_id: me, body: text, sender: "user" })
        .select("id, user_id, body, sender, created_at")
        .single();
      if (sendError || !data) {
        setMessages((current) =>
          current.map((item) => (item.id === id ? { ...item, status: "failed" } : item)),
        );
        optionsRef.current.onError?.("Your message could not be sent. Please try again.");
        return;
      }
      const saved = fromSupportRow(data as SupportMessageRow, me);
      setMessages((current) => {
        const withoutEcho = current.filter((item) => item.id !== saved.id);
        return withoutEcho.map((item) => (item.id === id ? saved : item));
      });
    },
    [me],
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!me || !text.trim()) return;
      const id = `local-${crypto.randomUUID()}`;
      pending.current.set(id, text.trim());
      setMessages((current) => [
        ...current,
        {
          ...fromSupportRow(
            {
              id,
              user_id: me,
              body: text.trim(),
              sender: "user",
              created_at: new Date().toISOString(),
            },
            me,
          ),
          status: "sending",
        },
      ]);
      await send(id, text.trim());
    },
    [me, send],
  );

  return {
    messages,
    reactions: {},
    quotes: {},
    loading,
    error,
    hasMore: false,
    loadingOlder: false,
    capabilities: {
      media: false,
      voice: false,
      react: false,
      reply: false,
      edit: false,
      delete: false,
      forward: false,
      report: false,
      typing: false,
    },
    loadOlder: NOOP,
    loadAll: NOOP,
    sendText,
    sendImages: NOOP,
    sendVoice: NOOP,
    retry: async (id) => {
      const text = pending.current.get(id);
      if (text) await send(id, text);
    },
    discard: (id) => {
      pending.current.delete(id);
      setMessages((current) => current.filter((item) => item.id !== id));
    },
    edit: NOOP,
    deleteForEveryone: NOOP,
    deleteForMe: NOOP,
    react: NOOP,
    notifyTyping: () => undefined,
  };
}
