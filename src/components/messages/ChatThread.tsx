import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Copy, Forward, Loader2, Trash2, X } from "lucide-react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useVisibleViewport } from "@/hooks/use-visible-viewport";
import { dayDividerLabel, groupsWith, haptic, sameDay } from "@/lib/messages-format";
import * as api from "@/lib/chat/api";
import {
  canEdit,
  describeMessage,
  isUnread,
  tickFor,
  type Chat,
  type ChatMessage,
} from "@/lib/chat/model";
import type { ThreadController } from "@/lib/chat/use-thread";
import type { InboxActions } from "@/lib/chat/use-inbox";
import { ChatHeader, type HeaderMenuAction } from "./ChatHeader";
import { Composer, type ComposerContext } from "./Composer";
import { MessageBubble, type GroupPosition } from "./MessageBubble";
import { MessageMenu, type MenuAnchor, type MessageAction } from "./MessageMenu";
import { ImageViewer, PhotoSendPreview } from "./MediaOverlays";
import { ContactInfoSheet, ForwardSheet, ReportSheet } from "./ChatSheets";
import { ConfirmDialog } from "./Sheet";
import { QuickReplies } from "./QuickReplies";
import { ThreadSkeleton } from "./Skeletons";
import { TypingDots } from "./TypingDots";
import { Avatar } from "./Avatar";
import { afterOverlayClose } from "./after-overlay-close";

type Props = {
  chat: Chat;
  me: string;
  thread: ThreadController;
  typing: boolean;
  otherUnread: number;
  chats: Chat[];
  inbox: InboxActions;
  onPatchChat: (changes: Partial<Chat>) => void;
  /** Pops back to the inbox, taking every sheet open above the thread with it. */
  onBack: () => void;
  onToast: (message: string) => void;
};

// Drafts survive leaving and re-opening a chat for the session, like every
// messenger. Not persisted: a half-typed message isn't worth a storage write.
const drafts = new Map<string, string>();

const SUPPORT_REPLIES = ["I need help with an order", "Report a seller", "Payout question"];

type Confirm =
  | { kind: "delete-messages"; messages: ChatMessage[] }
  | { kind: "clear" }
  | { kind: "delete-chat" }
  | { kind: "block" }
  | null;

export function ChatThread({
  chat,
  me,
  thread,
  typing,
  otherUnread,
  chats,
  inbox,
  onPatchChat,
  onBack,
  onToast,
}: Props) {
  const viewport = useVisibleViewport(true);
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [draft, setDraftState] = useState(() => drafts.get(chat.id) ?? "");
  const [context, setContext] = useState<ComposerContext>(null);
  const [contextTarget, setContextTarget] = useState<ChatMessage | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [viewer, setViewer] = useState<ChatMessage | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [forwarding, setForwarding] = useState<ChatMessage[] | null>(null);
  // Multi-select: non-empty means the thread is in selection mode. It gets a
  // history entry like any overlay, so back leaves selection, not the chat.
  const [selected, setSelected] = useState<string[]>([]);
  const selecting = selected.length > 0;
  useOverlayHistory(selecting, () => setSelected([]));
  const [reportTarget, setReportTarget] = useState<{
    chat: Chat;
    message: ChatMessage | null;
  } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [search, setSearch] = useState({ active: false, query: "", index: 0 });
  const [flashId, setFlashId] = useState<string | null>(null);
  const [newBelow, setNewBelow] = useState(0);
  const [showJump, setShowJump] = useState(false);
  const nearBottom = useRef(true);
  const initialScrollDone = useRef(false);
  const olderAnchor = useRef<{ height: number; top: number } | null>(null);
  // The read watermark as it was when the chat opened -- the "unread
  // messages" divider stays put while you read, rather than vanishing the
  // moment the chat marks itself read.
  const [openedReadAt] = useState(() => chat.lastReadAt);

  const setDraft = (value: string) => {
    setDraftState(value);
    if (value) drafts.set(chat.id, value);
    else drafts.delete(chat.id);
  };

  const author = useCallback(
    (message: ChatMessage) => (message.senderId === me ? "You" : chat.title),
    [me, chat.title],
  );

  /* ---------- rows ---------- */
  const { messages } = thread;
  const firstUnreadId = useMemo(() => {
    if (!openedReadAt || chat.kind === "self" || chat.kind === "support") return null;
    const at = new Date(openedReadAt).getTime();
    return (
      messages.find(
        (message) => message.senderId !== me && new Date(message.createdAt).getTime() > at,
      )?.id ?? null
    );
  }, [messages, openedReadAt, me, chat.kind]);

  const rows = useMemo(
    () =>
      messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const joinsPrevious =
          !!previous &&
          previous.senderId === message.senderId &&
          groupsWith(previous.createdAt, message.createdAt) &&
          message.id !== firstUnreadId;
        const joinsNext =
          !!next &&
          next.senderId === message.senderId &&
          groupsWith(message.createdAt, next.createdAt) &&
          next.id !== firstUnreadId;
        const position: GroupPosition = joinsPrevious
          ? joinsNext
            ? "middle"
            : "last"
          : joinsNext
            ? "first"
            : "single";
        return {
          message,
          position,
          showDay: !previous || !sameDay(previous.createdAt, message.createdAt),
          showUnread: message.id === firstUnreadId,
        };
      }),
    [messages, firstUnreadId],
  );

  const menuRow = menuFor ? rows.find((row) => row.message.id === menuFor.id) : undefined;

  const unreadAfterDivider = useMemo(() => {
    if (!firstUnreadId) return 0;
    const start = messages.findIndex((message) => message.id === firstUnreadId);
    return messages.slice(start).filter((message) => message.senderId !== me).length;
  }, [messages, firstUnreadId, me]);

  /* ---------- search ---------- */
  const matches = useMemo(() => {
    const needle = search.query.trim().toLowerCase();
    if (!search.active || !needle) return [];
    return messages
      .filter((message) => !message.deletedAt && message.body?.toLowerCase().includes(needle))
      .map((message) => message.id);
  }, [messages, search.active, search.query]);

  const scrollToMessage = useCallback((id: string, flash = true) => {
    const node = document.getElementById(`message-${id}`);
    if (!node) return false;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    if (flash) {
      setFlashId(id);
      setTimeout(() => setFlashId((current) => (current === id ? null : current)), 1400);
    }
    return true;
  }, []);

  useEffect(() => {
    if (matches.length === 0) return;
    const index = Math.min(search.index, matches.length - 1);
    scrollToMessage(matches[index], false);
  }, [matches, search.index, scrollToMessage]);

  const openSearch = () => {
    setSearch({ active: true, query: "", index: 0 });
    void thread.loadAll();
  };

  /* ---------- scrolling ---------- */
  const scrollToBottom = useCallback((smooth = false) => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(0);
  }, []);

  // First paint of a loaded chat: land on the unread divider if there is one,
  // otherwise at the bottom.
  useLayoutEffect(() => {
    if (initialScrollDone.current || thread.loading) return;
    if (messages.length === 0 && !thread.error) return;
    initialScrollDone.current = true;
    const divider = document.getElementById("unread-divider");
    if (divider && scroller.current) {
      scroller.current.scrollTop = Math.max(0, divider.offsetTop - 80);
      nearBottom.current = false;
    } else {
      scrollToBottom();
    }
  }, [thread.loading, messages.length, thread.error, scrollToBottom]);

  // Older pages prepend above; keep what the reader was looking at in place.
  useLayoutEffect(() => {
    const anchor = olderAnchor.current;
    const node = scroller.current;
    if (!anchor || !node || thread.loadingOlder) return;
    node.scrollTop = node.scrollHeight - anchor.height + anchor.top;
    olderAnchor.current = null;
  }, [messages, thread.loadingOlder]);

  // New messages at the bottom: follow them if we're already there (or they
  // are ours), otherwise count them on the jump button.
  const lastId = messages[messages.length - 1]?.id;
  const previousLast = useRef<string | undefined>(lastId);
  useEffect(() => {
    if (!initialScrollDone.current) {
      previousLast.current = lastId;
      return;
    }
    if (!lastId || lastId === previousLast.current) return;
    previousLast.current = lastId;
    const last = messages[messages.length - 1];
    if (nearBottom.current || last.senderId === me) {
      requestAnimationFrame(() => scrollToBottom(true));
    } else {
      setNewBelow((count) => count + 1);
    }
  }, [lastId, messages, me, scrollToBottom]);

  useEffect(() => {
    if (typing && nearBottom.current) requestAnimationFrame(() => scrollToBottom(true));
  }, [typing, scrollToBottom]);

  // The keyboard, the emoji panel or a reply bar shrinks the message list;
  // keep the latest message in view when we were already at the bottom.
  useEffect(() => {
    const node = scroller.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) node.scrollTop = node.scrollHeight;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const fromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setScrolled(node.scrollTop > 4);
    nearBottom.current = fromBottom < 120;
    setShowJump(fromBottom > 400);
    if (fromBottom < 60) setNewBelow(0);
    if (
      node.scrollTop < 240 &&
      thread.hasMore &&
      !thread.loadingOlder &&
      initialScrollDone.current
    ) {
      olderAnchor.current = { height: node.scrollHeight, top: node.scrollTop };
      void thread.loadOlder();
    }
  };

  /* ---------- read receipts ---------- */
  const lastIncoming = [...messages].reverse().find((message) => message.senderId !== me);
  useEffect(() => {
    if (chat.kind === "support" || thread.loading) return;
    const behind =
      isUnread(chat) ||
      (!!lastIncoming &&
        (!chat.lastReadAt ||
          new Date(lastIncoming.createdAt).getTime() > new Date(chat.lastReadAt).getTime()));
    if (!behind || document.visibilityState !== "visible") return;
    void inbox.markRead(chat).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastIncoming?.id, thread.loading, chat.id]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && chat.kind !== "support" && isUnread(chat)) {
        void inbox.markRead(chat).catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [chat, inbox]);

  /* ---------- sending ---------- */
  const replyToId = context?.mode === "reply" ? (contextTarget?.id ?? null) : null;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    if (context?.mode === "edit" && contextTarget) {
      const target = contextTarget;
      setDraft("");
      setContext(null);
      setContextTarget(null);
      if (text === target.body) return;
      void thread.edit(target.id, text).catch((reason: Error) => onToast(reason.message));
      return;
    }
    setDraft("");
    setContext(null);
    setContextTarget(null);
    nearBottom.current = true;
    void thread.sendText(text, replyToId);
  };

  const startReply = (message: ChatMessage) => {
    if (!thread.capabilities.reply || message.deletedAt || message.status) return;
    setContextTarget(message);
    setContext({
      mode: "reply",
      author: author(message),
      text: describeMessage({ ...message, deleted: false }),
    });
    setFocusKey((key) => key + 1);
  };

  /* ---------- selection ---------- */
  const selectedMessages = useMemo(
    () => messages.filter((message) => selected.includes(message.id)),
    [messages, selected],
  );

  const toggleSelect = (message: ChatMessage) => {
    if (message.status) return;
    haptic(8);
    setSelected((current) =>
      current.includes(message.id)
        ? current.filter((id) => id !== message.id)
        : [...current, message.id],
    );
  };

  // After a sheet or dialog opened from the selection bar closes -- its own
  // history entry has to come off first (see afterOverlayClose).
  const endSelectionAfterOverlay = () => {
    if (selecting) afterOverlayClose(() => setSelected([]));
  };

  const canCopySelection =
    selectedMessages.length > 0 &&
    selectedMessages.every(
      (message) => message.kind === "text" && !message.deletedAt && message.body,
    );
  const canForwardSelection =
    thread.capabilities.forward &&
    selectedMessages.length > 0 &&
    selectedMessages.every((message) => !message.deletedAt);

  const copySelection = () => {
    const text = selectedMessages.map((message) => message.body).join("\n");
    void navigator.clipboard
      ?.writeText(text)
      .then(() =>
        onToast(
          selectedMessages.length === 1 ? "Copied" : `Copied ${selectedMessages.length} messages`,
        ),
      )
      .catch(() => onToast("Couldn't copy"));
    setSelected([]);
  };

  /* ---------- message menu ---------- */
  // Measured here, at the moment of the long-press, so the menu can lift the
  // message exactly where it already is instead of re-centering it.
  const openMenu = (message: ChatMessage) => {
    const row = document.getElementById(`message-${message.id}`);
    const bubble = row?.querySelector("[data-bubble]");
    setMenuAnchor(
      row && bubble
        ? { row: row.getBoundingClientRect(), bubble: bubble.getBoundingClientRect() }
        : null,
    );
    setMenuFor(message);
  };

  const actionsFor = (message: ChatMessage): MessageAction[] => {
    if (message.status === "failed") return ["retry", "delete"];
    if (message.status === "sending") return [];
    const mine = message.senderId === me;
    const caps = thread.capabilities;
    const deleted = !!message.deletedAt;
    const list: MessageAction[] = [];
    if (caps.reply && !deleted) list.push("reply");
    if (message.body && !deleted) list.push("copy");
    if (caps.edit && canEdit(message, me)) list.push("edit");
    if (caps.forward && !deleted) list.push("forward");
    if (message.kind === "image" && !deleted) list.push("save");
    list.push("select");
    if (caps.report && !mine && !deleted) list.push("report");
    if (caps.delete) list.push("delete");
    return list;
  };

  const myReaction = (message: ChatMessage) =>
    thread.reactions[message.id]?.find((reaction) => reaction.mine)?.emoji ?? null;

  const react = (message: ChatMessage, emoji: string | null) => {
    haptic();
    void thread.react(message.id, emoji).catch((reason: Error) => onToast(reason.message));
  };

  const runAction = (message: ChatMessage, action: MessageAction) => {
    setMenuFor(null);
    const later = (fn: () => void) => afterOverlayClose(fn);
    switch (action) {
      case "retry":
        void thread.retry(message.id);
        break;
      case "reply":
        later(() => startReply(message));
        break;
      case "copy":
        void navigator.clipboard
          ?.writeText(message.body ?? "")
          .then(() => onToast("Copied"))
          .catch(() => onToast("Couldn't copy"));
        break;
      case "edit":
        later(() => {
          setContextTarget(message);
          setContext({ mode: "edit", text: message.body ?? "" });
          setDraft(message.body ?? "");
          setFocusKey((key) => key + 1);
        });
        break;
      case "forward":
        later(() => setForwarding([message]));
        break;
      case "select":
        (document.activeElement as HTMLElement | null)?.blur?.();
        later(() => setSelected([message.id]));
        break;
      case "save":
        later(() => setViewer(message));
        break;
      case "report":
        later(() => setReportTarget({ chat, message }));
        break;
      case "delete":
        if (message.status === "failed") {
          thread.discard(message.id);
          break;
        }
        later(() => setConfirm({ kind: "delete-messages", messages: [message] }));
        break;
    }
  };

  /* ---------- header menu ---------- */
  const onHeaderMenu = (action: HeaderMenuAction) => {
    switch (action) {
      case "info":
        setInfoOpen(true);
        break;
      case "search":
        openSearch();
        break;
      case "mute":
        void inbox
          .toggleMute(chat)
          .then(() => onToast(chat.muted ? "Notifications on" : "Muted"))
          .catch((reason: Error) => onToast(reason.message));
        break;
      case "clear":
        setConfirm({ kind: "clear" });
        break;
      case "block":
        if (chat.blockedByMe) void toggleBlock();
        else setConfirm({ kind: "block" });
        break;
      case "report":
        setReportTarget({ chat, message: null });
        break;
    }
  };

  const toggleBlock = async () => {
    if (!chat.peer) return;
    const next = !chat.blockedByMe;
    onPatchChat({ blockedByMe: next });
    try {
      await api.setBlocked(me, chat.peer.id, next);
      onToast(next ? `${chat.title} blocked` : `${chat.title} unblocked`);
    } catch (reason) {
      onPatchChat({ blockedByMe: !next });
      onToast((reason as Error).message);
    }
  };

  const forward = async (targets: Chat[]) => {
    const list = forwarding;
    if (!list?.length) return;
    try {
      await Promise.all(
        targets.map(async (target) => {
          // One at a time per chat, so they arrive in the order they were sent.
          for (const message of list) {
            const mediaPath = message.mediaPath
              ? await api.copyMedia(message.mediaPath, target.id)
              : null;
            await api.insertMessage({
              id: crypto.randomUUID(),
              conversationId: target.id,
              senderId: me,
              kind: message.kind,
              body: message.body,
              mediaPath,
              meta: message.meta,
              forwarded: true,
            });
          }
        }),
      );
      setForwarding(null);
      endSelectionAfterOverlay();
      onToast(targets.length === 1 ? `Forwarded to ${targets[0].title}` : "Forwarded");
    } catch (reason) {
      onToast((reason as Error).message || "Couldn't forward");
    }
  };

  const submitReport = async (reason: string, alsoBlock: boolean) => {
    const target = reportTarget;
    if (!target) return;
    try {
      await api.report({
        conversationId: target.chat.id,
        messageId: target.message?.id ?? null,
        reason,
      });
      if (alsoBlock && target.chat.peer && !target.chat.blockedByMe) {
        await api.setBlocked(me, target.chat.peer.id, true);
        onPatchChat({ blockedByMe: true });
      }
      setReportTarget(null);
      onToast("Thanks — Oakmonte will review this");
    } catch (reason) {
      onToast((reason as Error).message);
    }
  };

  /* ---------- confirm ---------- */
  const confirmCopy = (() => {
    if (!confirm) return null;
    switch (confirm.kind) {
      case "delete-messages": {
        const list = confirm.messages;
        const one = list.length === 1;
        const everyone =
          chat.kind !== "support" &&
          list.every((message) => message.senderId === me && !message.deletedAt);
        return {
          title: one ? "Delete message?" : `Delete ${list.length} messages?`,
          body: everyone
            ? `Delete for everyone removes ${one ? "it" : "them"} for both of you.`
            : `${one ? "It" : "They"} will be removed from this device.`,
          confirmLabel: "Delete for me",
          onConfirm: () => {
            void thread
              .deleteForMe(list.map((message) => message.id))
              .catch((r: Error) => onToast(r.message));
            setConfirm(null);
            endSelectionAfterOverlay();
          },
          extra: everyone
            ? {
                label: "Delete for everyone",
                onSelect: () => {
                  void Promise.all(list.map((message) => thread.deleteForEveryone(message))).catch(
                    (r: Error) => onToast(r.message),
                  );
                  setConfirm(null);
                  endSelectionAfterOverlay();
                },
              }
            : undefined,
        };
      }
      case "clear":
        return {
          title: "Clear this chat?",
          body: "Messages are removed for you only.",
          confirmLabel: "Clear chat",
          onConfirm: () => {
            void inbox.clearChat(chat).catch((r: Error) => onToast(r.message));
            setConfirm(null);
          },
        };
      case "delete-chat":
        return {
          title: `Delete chat with ${chat.title}?`,
          body: "It disappears from your inbox until someone writes again.",
          confirmLabel: "Delete chat",
          onConfirm: () => {
            void inbox.deleteChat(chat).catch((r: Error) => onToast(r.message));
            // One pop to below the thread closes the confirm, the info sheet
            // and the thread together.
            onBack();
          },
        };
      case "block":
        return {
          title: `Block ${chat.title}?`,
          body: "Blocked people can't message you. They won't be told.",
          confirmLabel: "Block",
          onConfirm: () => {
            setConfirm(null);
            void toggleBlock();
          },
        };
    }
  })();

  // Keeps the dialog's words on screen while it fades out after closing.
  const shownCopy = useRef(confirmCopy);
  if (confirmCopy) shownCopy.current = confirmCopy;
  const dialog = confirmCopy ?? shownCopy.current;

  /* ---------- layout ---------- */
  const media = useMemo(
    () => messages.filter((message) => message.kind === "image" && !message.deletedAt),
    [messages],
  );
  const showEmpty = !thread.loading && messages.length === 0 && !thread.error;
  const composerDisabled = chat.kind === "direct" && chat.blockedByMe;

  return (
    <motion.div
      className="fixed inset-x-0 z-40 flex justify-center bg-chat-bg"
      style={{ top: viewport.top, height: viewport.height || "100dvh" }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
    >
      <div className="flex h-full w-full max-w-[560px] flex-col pt-[env(safe-area-inset-top)] md:border-x md:border-chat-border">
        {selecting ? (
          <header className="relative z-30 flex h-[60px] shrink-0 items-center gap-1 border-b border-chat-border px-1.5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-chat-bg/90 backdrop-blur-xl"
            />
            <button
              type="button"
              onClick={() => setSelected([])}
              aria-label="Cancel selection"
              className="flex h-11 w-11 items-center justify-center rounded-full text-chat-text active:bg-chat-text/10"
            >
              <X size={24} />
            </button>
            <p className="flex-1 text-[17px] font-semibold text-chat-text" aria-live="polite">
              {selected.length} selected
            </p>
          </header>
        ) : (
          <ChatHeader
            chat={chat}
            typing={typing}
            scrolled={scrolled}
            otherUnread={otherUnread}
            onBack={onBack}
            onOpenInfo={() => setInfoOpen(true)}
            onMenu={onHeaderMenu}
            search={{
              active: search.active,
              query: search.query,
              count: matches.length,
              index: Math.min(search.index, Math.max(0, matches.length - 1)),
              onQuery: (query) =>
                setSearch((current) => ({ ...current, query, index: Number.MAX_SAFE_INTEGER })),
              onStep: (direction) =>
                setSearch((current) => {
                  const at = Math.min(current.index, matches.length - 1);
                  return {
                    ...current,
                    index: Math.min(matches.length - 1, Math.max(0, at + direction)),
                  };
                }),
              onClose: () => setSearch({ active: false, query: "", index: 0 }),
            }}
          />
        )}

        <div className="relative min-h-0 flex-1">
          <div
            ref={scroller}
            onScroll={onScroll}
            className="h-full overflow-y-auto overscroll-contain px-3 pb-3"
            style={{
              background: "var(--chat-wallpaper, #0b0c0e)",
              backgroundImage:
                "radial-gradient(color-mix(in srgb, var(--color-chat-text) 7%, transparent) 1px, transparent 1.2px)",
              backgroundSize: "22px 22px",
            }}
          >
            {thread.loadingOlder && (
              <div className="flex justify-center py-3 text-chat-muted">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {!thread.hasMore && messages.length > 0 && chat.kind === "direct" && (
              <p className="mx-auto mt-4 max-w-[300px] rounded-[12px] bg-chat-bg/80 px-3 py-2 text-center text-[12px] leading-snug text-chat-muted">
                Messages are private to the two of you. Report anything that feels off from the ⋮
                menu.
              </p>
            )}

            {thread.loading && <ThreadSkeleton />}

            {showEmpty && (
              <div className="flex flex-col items-center gap-2 px-8 pb-6 pt-14 text-center">
                <Avatar
                  kind={chat.kind}
                  name={chat.title}
                  src={chat.peer?.avatarUrl}
                  seed={chat.peer?.id ?? chat.id}
                  size={84}
                />
                <p className="mt-1 text-[19px] font-bold text-chat-text">{chat.title}</p>
                {chat.handle && <p className="text-[14px] text-chat-muted">@{chat.handle}</p>}
                <p className="mt-1 max-w-[260px] text-[14px] text-chat-muted">
                  {chat.kind === "support"
                    ? "Tell us what happened and a real person on the Oakmonte team will pick it up."
                    : chat.kind === "self"
                      ? "Your own space. Save notes, links, photos and voice memos — only you can see them."
                      : "No messages yet. Say hello!"}
                </p>
                {chat.kind === "direct" && !chat.blockedByMe && (
                  <button
                    type="button"
                    onClick={() => void thread.sendText("👋", null)}
                    className="mt-3 flex h-11 items-center gap-2 rounded-full bg-chat-elevated px-5 text-[15px] font-semibold text-chat-text active:scale-95"
                  >
                    <span className="text-[20px]">👋</span> Wave
                  </button>
                )}
              </div>
            )}

            {thread.error && (
              <p role="alert" className="py-6 text-center text-[13.5px] text-chat-danger">
                {thread.error}
              </p>
            )}

            <div className="pt-1">
              {rows.map(({ message, position, showDay, showUnread }) => {
                const mine = message.senderId === me;
                const quoted = message.replyToId ? thread.quotes[message.replyToId] : undefined;
                return (
                  <div key={message.id}>
                    {showDay && (
                      <div className="sticky top-2 z-10 flex justify-center py-3" role="separator">
                        <span className="rounded-full bg-chat-bg/85 px-3 py-1 text-[12px] font-semibold text-chat-muted shadow-sm backdrop-blur">
                          {dayDividerLabel(message.createdAt)
                            .toLowerCase()
                            .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
                            .replace(" At ", " at ")}
                        </span>
                      </div>
                    )}
                    {showUnread && (
                      <div
                        id="unread-divider"
                        className="-mx-3 my-3 bg-chat-bg/70 py-1.5 text-center text-[12.5px] font-semibold text-chat-accent"
                      >
                        {unreadAfterDivider} unread message{unreadAfterDivider === 1 ? "" : "s"}
                      </div>
                    )}
                    <MessageBubble
                      message={message}
                      mine={mine}
                      position={position}
                      tick={
                        mine && chat.kind === "direct"
                          ? tickFor(message, chat)
                          : (message.status ?? null)
                      }
                      reactions={thread.reactions[message.id]}
                      quote={
                        message.replyToId
                          ? { author: quoted ? author(quoted) : "Message", message: quoted ?? null }
                          : null
                      }
                      highlight={search.active ? search.query : undefined}
                      flash={flashId === message.id || matches[search.index] === message.id}
                      canReply={thread.capabilities.reply}
                      onMenu={(target) => {
                        if (actionsFor(target).length || thread.capabilities.react)
                          openMenu(target);
                      }}
                      onReply={startReply}
                      onDoubleTap={(target) => {
                        if (!thread.capabilities.react) return;
                        react(target, myReaction(target) === "❤️" ? null : "❤️");
                      }}
                      onQuoteTap={(id) => {
                        if (!scrollToMessage(id)) onToast("That message is further back");
                      }}
                      onImageTap={setViewer}
                      onRetry={openMenu}
                      onReactionsTap={openMenu}
                      selecting={selecting}
                      selected={selecting && selected.includes(message.id)}
                      onToggleSelect={toggleSelect}
                    />
                  </div>
                );
              })}
            </div>

            <AnimatePresence>
              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="mt-2 flex"
                >
                  <span
                    className="rounded-[20px] rounded-bl-[4px] px-4 py-3.5 text-chat-muted"
                    style={{ background: "var(--chat-incoming, #1f2126)" }}
                  >
                    <TypingDots />
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {(showJump || newBelow > 0) && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => scrollToBottom(true)}
                aria-label="Scroll to latest"
                className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-chat-bg text-chat-text shadow-lg ring-1 ring-chat-border active:scale-95"
              >
                <ChevronDown size={24} />
                {newBelow > 0 && (
                  <span className="absolute -top-2 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-chat-accent px-1 text-[11.5px] font-bold text-white">
                    {newBelow}
                  </span>
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {chat.kind === "support" && !thread.loading && messages.length === 0 && !draft && (
          <div className="bg-chat-bg pt-2">
            <QuickReplies replies={SUPPORT_REPLIES} onPick={setDraft} />
          </div>
        )}

        {selecting && (
          <div className="flex shrink-0 items-center justify-around border-t border-chat-border bg-chat-bg px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5">
            <SelectionAction
              icon={Copy}
              label="Copy"
              disabled={!canCopySelection}
              onClick={copySelection}
            />
            {thread.capabilities.forward && (
              <SelectionAction
                icon={Forward}
                label="Forward"
                disabled={!canForwardSelection}
                onClick={() => setForwarding(selectedMessages)}
              />
            )}
            {thread.capabilities.delete && (
              <SelectionAction
                icon={Trash2}
                label="Delete"
                danger
                disabled={selectedMessages.length === 0}
                onClick={() => setConfirm({ kind: "delete-messages", messages: selectedMessages })}
              />
            )}
          </div>
        )}

        {/* Hidden rather than unmounted while selecting: it holds its own
            state (emoji panel, a focus bump it would replay on remount). */}
        <div className={selecting ? "hidden" : "contents"}>
          {composerDisabled ? (
            <button
              type="button"
              onClick={() => void toggleBlock()}
              className="shrink-0 border-t border-chat-border bg-chat-bg px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3.5 text-center text-[14px] text-chat-muted active:bg-chat-text/5"
            >
              You blocked {chat.title}.{" "}
              <span className="font-semibold text-chat-accent">Tap to unblock</span>
            </button>
          ) : (
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={send}
              onPickImages={
                thread.capabilities.media ? (files) => setPendingFiles(files) : undefined
              }
              onVoice={
                thread.capabilities.voice
                  ? (recording) => {
                      nearBottom.current = true;
                      void thread.sendVoice(recording, replyToId);
                      setContext(null);
                      setContextTarget(null);
                    }
                  : undefined
              }
              onTyping={thread.capabilities.typing ? thread.notifyTyping : undefined}
              onError={onToast}
              context={context}
              onCancelContext={() => {
                if (context?.mode === "edit") setDraft("");
                setContext(null);
                setContextTarget(null);
              }}
              placeholder={chat.kind === "self" ? "Note to self" : "Message"}
              focusKey={focusKey}
            />
          )}
        </div>
      </div>

      <MessageMenu
        message={menuFor}
        mine={menuFor?.senderId === me}
        myReaction={menuFor ? myReaction(menuFor) : null}
        actions={menuFor ? actionsFor(menuFor) : []}
        canReact={!!menuFor && thread.capabilities.react && !menuFor.deletedAt && !menuFor.status}
        onReact={(emoji) => {
          if (menuFor) react(menuFor, emoji);
          setMenuFor(null);
        }}
        onAction={(action) => menuFor && runAction(menuFor, action)}
        onClose={() => setMenuFor(null)}
        anchor={menuAnchor}
        preview={
          menuFor && (
            <MessageBubble
              lifted
              message={menuFor}
              mine={menuFor.senderId === me}
              position={menuRow?.position ?? "single"}
              tick={
                menuFor.senderId === me && chat.kind === "direct"
                  ? tickFor(menuFor, chat)
                  : (menuFor.status ?? null)
              }
              reactions={thread.reactions[menuFor.id]}
              quote={
                menuFor.replyToId
                  ? {
                      author: thread.quotes[menuFor.replyToId]
                        ? author(thread.quotes[menuFor.replyToId])
                        : "Message",
                      message: thread.quotes[menuFor.replyToId] ?? null,
                    }
                  : null
              }
              canReply={false}
              onMenu={() => undefined}
              onReply={() => undefined}
              onDoubleTap={() => undefined}
              onQuoteTap={() => undefined}
              onImageTap={(target) => runAction(target, "save")}
              onRetry={() => undefined}
              onReactionsTap={() => undefined}
            />
          )
        }
      />

      <ImageViewer
        message={viewer}
        author={viewer ? author(viewer) : ""}
        onClose={() => setViewer(null)}
      />

      <PhotoSendPreview
        files={pendingFiles}
        recipient={chat.title}
        onCancel={() => setPendingFiles([])}
        onAddMore={(files) => setPendingFiles((current) => [...current, ...files].slice(0, 10))}
        onRemove={(index) => setPendingFiles((current) => current.filter((_, i) => i !== index))}
        onSend={(caption) => {
          const files = pendingFiles;
          setPendingFiles([]);
          nearBottom.current = true;
          void thread.sendImages(files, caption, replyToId);
          setContext(null);
          setContextTarget(null);
        }}
      />

      <ForwardSheet
        open={!!forwarding}
        chats={chats}
        onClose={() => setForwarding(null)}
        onForward={forward}
      />

      <ReportSheet
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onSubmit={submitReport}
      />

      <ContactInfoSheet
        chat={chat}
        open={infoOpen}
        media={media}
        onClose={() => setInfoOpen(false)}
        onSearch={() => {
          setInfoOpen(false);
          afterOverlayClose(openSearch);
        }}
        onToggleMute={() =>
          void inbox.toggleMute(chat).catch((reason: Error) => onToast(reason.message))
        }
        onOpenMedia={setViewer}
        onClear={() => setConfirm({ kind: "clear" })}
        onToggleBlock={() => {
          if (chat.blockedByMe) void toggleBlock();
          else setConfirm({ kind: "block" });
        }}
        onReport={() => setReportTarget({ chat, message: null })}
        onDelete={() => setConfirm({ kind: "delete-chat" })}
      />

      {/* Always mounted, driven by `open`: an overlay that mounts already
          open runs its history effect twice under StrictMode, and the second
          push is popped by the first cleanup's back(). */}
      <ConfirmDialog
        open={!!confirmCopy}
        title={dialog?.title ?? ""}
        body={dialog?.body}
        confirmLabel={dialog?.confirmLabel ?? ""}
        onConfirm={() => confirmCopy?.onConfirm()}
        onCancel={() => setConfirm(null)}
        extra={dialog?.extra}
      />
    </motion.div>
  );
}

function SelectionAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 min-w-[76px] flex-col items-center justify-center gap-1 rounded-[14px] text-[12px] font-medium active:bg-chat-text/10 disabled:opacity-35 ${
        danger ? "text-chat-danger" : "text-chat-text"
      }`}
    >
      <Icon size={22} />
      {label}
    </button>
  );
}
