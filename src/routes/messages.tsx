import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ChevronLeft, MessageCircleOff, Search, SquarePen, X } from "lucide-react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useSession } from "@/hooks/use-session";
import { useOwnUsername } from "@/hooks/use-own-username";
import { readIndex } from "@/lib/nav-stack";
import { BottomNav } from "@/components/BottomNav";
import { ConversationRow } from "@/components/messages/ConversationRow";
import { ConversationSkeleton } from "@/components/messages/Skeletons";
import { TabPreview } from "@/components/messages/TabPreview";
import { ChatThread } from "@/components/messages/ChatThread";
import { ChatActionsSheet, NewChatSheet } from "@/components/messages/ChatSheets";
import { ConfirmDialog } from "@/components/messages/Sheet";
import { Avatar } from "@/components/messages/Avatar";
import { afterOverlayClose } from "@/components/messages/after-overlay-close";
import * as api from "@/lib/chat/api";
import { useInbox } from "@/lib/chat/use-inbox";
import { useSupportThread, useThread } from "@/lib/chat/use-thread";
import { isOnline, isUnread, type Chat } from "@/lib/chat/model";

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>): { to?: string } => ({
    to: typeof search.to === "string" && search.to ? search.to : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — Oakmonte" },
      {
        name: "description",
        content:
          "Chat with Oakmonte sellers and buyers: send photos and voice notes, and keep every conversation in one inbox.",
      },
      { property: "og:title", content: "Messages — Oakmonte" },
      {
        property: "og:description",
        content: "Conversations with Oakmonte sellers and buyers, all in one inbox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

type Folder = "all" | "unread" | "offers" | "orders";

const FOLDERS: { key: Folder; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "offers", label: "Offers" },
  { key: "orders", label: "Orders" },
];

function MessagesPage() {
  const { user, loading: sessionLoading } = useSession();
  const me = user?.id ?? null;
  const ownUsername = useOwnUsername();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const inbox = useInbox(me, sessionLoading);
  const [folder, setFolder] = useState<Folder>("all");
  const [folderDirection, setFolderDirection] = useState<1 | -1>(1);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<Chat | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const threadIndex = useRef(0);
  const inboxScroll = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  /* ---------- toast ---------- */
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  const report = useCallback((message: string) => setToast(message), []);

  /* ---------- all chats: support pinned on top ---------- */
  const allChats = useMemo(() => [inbox.support, ...inbox.chats], [inbox.support, inbox.chats]);
  const active = allChats.filter((chat) => !chat.archivedAt);
  const archived = allChats.filter((chat) => chat.archivedAt);

  // Keep rendering the open chat even if it drops out of the list (deleted
  // from inside the thread) until the thread has actually closed.
  const openSnapshot = useRef<Chat | null>(null);
  const openChat = openId
    ? (allChats.find((chat) => chat.id === openId) ?? openSnapshot.current)
    : null;
  openSnapshot.current = openChat;

  /* ---------- threads ---------- */
  const directThread = useThread(openChat?.kind !== "support" ? openChat : null, me, {
    onError: report,
  });
  const supportThread = useSupportThread(openChat?.kind === "support", me, { onError: report });
  const thread = openChat?.kind === "support" ? supportThread : directThread;

  const closeThread = useCallback(() => {
    setOpenId(null);
    void inbox.reloadSupport();
    requestAnimationFrame(() => window.scrollTo(0, inboxScroll.current));
  }, [inbox]);

  useOverlayHistory(openId !== null, closeThread);

  const openThread = useCallback((chat: Chat) => {
    inboxScroll.current = window.scrollY;
    // The entry useOverlayHistory is about to push for the thread.
    threadIndex.current = readIndex(window.history.state) + 1;
    setOpenId(chat.id);
  }, []);

  /** Back to the inbox in ONE history step, however many sheets are stacked
   *  on the thread: every overlay above the pop point closes on its own. */
  const backToInbox = useCallback(() => {
    const steps = readIndex(window.history.state) - (threadIndex.current - 1);
    if (steps > 0) window.history.go(-steps);
    else closeThread();
  }, [closeThread]);

  const startWith = useCallback(
    async (person: api.PersonResult) => {
      try {
        const self = person.id === me;
        // The RPC already routes "message myself" to the self conversation;
        // the local snapshot has to agree, or it renders as a 1:1 with me.
        const conversationId = await api.startDirectConversation(person.id);
        const existing = inbox.chats.find((chat) => chat.id === conversationId);
        const chat: Chat = existing ?? {
          id: conversationId,
          kind: self ? "self" : "direct",
          title: self ? "Me" : person.displayName?.trim() || person.username,
          handle: self ? null : person.username,
          peer: self
            ? null
            : {
                id: person.id,
                username: person.username,
                displayName: person.displayName,
                avatarUrl: person.avatarUrl,
              },
          verified: false,
          lastMessageAt: new Date().toISOString(),
          lastMessage: null,
          unreadCount: 0,
          markedUnread: false,
          pinnedAt: null,
          muted: false,
          archivedAt: null,
          lastReadAt: new Date().toISOString(),
          clearedAt: null,
          peerLastReadAt: null,
          peerLastDeliveredAt: null,
          peerLastActiveAt: null,
          blockedByMe: false,
        };
        openSnapshot.current = chat;
        return chat;
      } catch (reason) {
        report((reason as Error).message);
        return null;
      }
    },
    [inbox.chats, me, report],
  );

  /* ---------- deep link: /messages?to=<username> (the profile "Message" button) ---------- */
  const handledDeepLink = useRef<string | null>(null);
  useEffect(() => {
    if (!search.to || !me || inbox.status !== "ready") return;
    if (handledDeepLink.current === search.to) return;
    handledDeepLink.current = search.to;
    const username = search.to;
    void navigate({ to: "/messages", search: {}, replace: true });
    void (async () => {
      try {
        const person = await api.findPersonByUsername(username);
        if (!person) {
          report(`@${username} isn't on Oakmonte`);
          return;
        }
        const chat = await startWith(person);
        if (chat) {
          openSnapshot.current = chat;
          openThread(chat);
        }
      } catch (reason) {
        report((reason as Error).message);
      }
    })();
  }, [search.to, me, inbox.status, navigate, openThread, report, startWith]);

  /* ---------- filtering ---------- */
  const needle = query.trim().toLowerCase();
  const matchesQuery = (chat: Chat) =>
    !needle ||
    chat.title.toLowerCase().includes(needle) ||
    (chat.handle ?? "").toLowerCase().includes(needle) ||
    (chat.lastMessage?.body ?? "").toLowerCase().includes(needle);

  const source = showArchived ? archived : active;
  const visible = source.filter(
    (chat) => matchesQuery(chat) && (folder !== "unread" || isUnread(chat) || showArchived),
  );
  const unreadCount = active.filter(isUnread).length;
  const archivedUnread = archived.filter(isUnread).length;
  const otherUnread = allChats
    .filter((chat) => chat.id !== openId && isUnread(chat) && !chat.muted)
    .reduce((sum, chat) => sum + Math.max(1, chat.unreadCount), 0);

  const rail = useMemo(
    () =>
      inbox.chats
        .filter((chat) => chat.kind === "direct" && !chat.archivedAt && chat.peer)
        .sort((a, b) => Number(isOnline(b.peerLastActiveAt)) - Number(isOnline(a.peerLastActiveAt)))
        .slice(0, 14),
    [inbox.chats],
  );

  /* ---------- archived view ---------- */
  useOverlayHistory(showArchived, () => setShowArchived(false));

  /* ---------- folder swipe ---------- */
  const switchFolder = (next: Folder) => {
    const from = FOLDERS.findIndex(({ key }) => key === folder);
    const to = FOLDERS.findIndex(({ key }) => key === next);
    if (from === to) return;
    setFolderDirection(to > from ? 1 : -1);
    setFolder(next);
  };

  // Anything with a horizontal gesture of its own (rows, the rail, the chips)
  // opts out with data-swipe-owner, and the swipe has to be clearly sideways.
  const onTouchStart = (event: React.TouchEvent) => {
    touchStart.current = null;
    if (openId || showArchived) return;
    if ((event.target as Element | null)?.closest?.("[data-swipe-owner]")) return;
    const touch = event.touches[0];
    if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const index = FOLDERS.findIndex(({ key }) => key === folder);
    const next = FOLDERS[dx < 0 ? index + 1 : index - 1];
    if (next) switchFolder(next.key);
  };

  /* ---------- row actions ---------- */
  const guarded = (promise: Promise<unknown> | undefined, success?: string) =>
    void Promise.resolve(promise)
      .then(() => success && report(success))
      .catch((reason: Error) => report(reason.message || "Something went wrong"));

  const toggleRead = (chat: Chat) =>
    guarded(isUnread(chat) ? inbox.actions.markRead(chat) : inbox.actions.markUnread(chat));
  const toggleMute = (chat: Chat) =>
    guarded(
      inbox.actions.toggleMute(chat),
      chat.muted ? `${chat.title} unmuted` : `${chat.title} muted`,
    );
  const togglePin = (chat: Chat) => {
    const pinned = active.filter((item) => item.pinnedAt && item.kind !== "support").length;
    if (!chat.pinnedAt && pinned >= 5) {
      report("You can pin up to 5 chats");
      return;
    }
    guarded(inbox.actions.togglePin(chat));
  };
  const toggleArchive = (chat: Chat) =>
    guarded(
      inbox.actions.toggleArchive(chat),
      chat.archivedAt ? `${chat.title} unarchived` : `${chat.title} archived`,
    );

  const fromSheet = (fn: (chat: Chat) => void) => () => {
    const chat = actionsFor;
    setActionsFor(null);
    if (chat) fn(chat);
  };

  /* ---------- render ---------- */
  const signedOut = inbox.status === "signed-out";
  const dmUnavailable = inbox.status === "unavailable";
  const loading = inbox.status === "loading" || sessionLoading;

  const list = (
    <div className="pb-4">
      {!showArchived && archived.length > 0 && !needle && folder === "all" && (
        <button
          type="button"
          onClick={() => setShowArchived(true)}
          className="flex w-full items-center gap-3 px-4 py-[3px] text-left active:bg-chat-text/[0.06]"
        >
          <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center text-chat-muted">
            <Archive size={22} />
          </span>
          <span className="flex min-w-0 flex-1 items-center border-b border-chat-border py-[18px]">
            <span className="flex-1 text-[16px] font-semibold text-chat-text">Archived</span>
            <span
              className={`text-[13.5px] ${archivedUnread ? "font-semibold text-chat-accent" : "text-chat-muted"}`}
            >
              {archivedUnread || archived.length}
            </span>
          </span>
        </button>
      )}

      {visible.map((chat) => (
        <ConversationRow
          key={chat.id}
          chat={chat}
          query={needle}
          typing={inbox.typingIn(chat.id)}
          onOpen={() => openThread(chat)}
          onLongPress={() => setActionsFor(chat)}
          onToggleRead={() => toggleRead(chat)}
          onToggleMute={() => toggleMute(chat)}
          onTogglePin={() => togglePin(chat)}
          onToggleArchive={() => toggleArchive(chat)}
        />
      ))}

      {visible.length === 0 && (
        <div className="px-10 pt-16 text-center">
          <p className="text-[17px] font-semibold text-chat-text">
            {needle
              ? "No results"
              : showArchived
                ? "No archived chats"
                : folder === "unread"
                  ? "You're all caught up"
                  : "No chats yet"}
          </p>
          <p className="mt-1.5 text-[14px] text-chat-muted">
            {needle
              ? `Nothing matches “${query.trim()}”.`
              : folder === "unread"
                ? "Unread chats will show up here."
                : "Tap the pencil to message anyone on Oakmonte."}
          </p>
        </div>
      )}

      {!showArchived && dmUnavailable && (
        <div className="mx-4 mt-6 flex gap-3 rounded-[18px] bg-chat-elevated p-4 text-left">
          <MessageCircleOff size={20} className="mt-0.5 shrink-0 text-chat-muted" />
          <p className="text-[13.5px] leading-snug text-chat-muted">
            Messaging other members is switching on shortly. Oakmonte Support is open now.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="min-h-screen bg-chat-bg pb-28 text-chat-text"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => (touchStart.current = null)}
    >
      <div className="mx-auto w-full max-w-[560px] md:border-x md:border-chat-border">
        {/* ---------- header ---------- */}
        <header className="sticky top-0 z-20 bg-chat-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="flex h-[56px] items-center gap-2 px-4">
            {showArchived ? (
              <>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  aria-label="Back to chats"
                  className="-ml-2 flex h-12 w-12 items-center justify-center rounded-full active:bg-chat-text/10"
                >
                  <ChevronLeft size={30} />
                </button>
                <h1 className="flex-1 text-[20px] font-bold">Archived</h1>
              </>
            ) : (
              <>
                <h1 className="flex-1 text-[28px] font-bold tracking-[-0.02em]">Messages</h1>
                {!signedOut && !dmUnavailable && (
                  <button
                    type="button"
                    onClick={() => setNewChatOpen(true)}
                    aria-label="New message"
                    className="-mr-1 flex h-12 w-12 items-center justify-center rounded-full text-chat-text active:bg-chat-text/10"
                  >
                    <SquarePen size={25} />
                  </button>
                )}
              </>
            )}
          </div>
          {!signedOut && (
            <div className="px-4 pb-2">
              <div className="flex h-10 items-center gap-2 rounded-[12px] bg-chat-soft px-3 text-chat-muted">
                <Search size={18} strokeWidth={2.2} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  aria-label="Search chats"
                  className="min-w-0 flex-1 bg-transparent text-[16px] text-chat-text outline-none placeholder:text-chat-muted"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-chat-text/20 text-chat-bg"
                  >
                    <X size={13} strokeWidth={3} />
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        {signedOut ? (
          <div className="flex flex-col items-center px-10 pt-20 text-center">
            <Avatar kind="support" name="Oakmonte" size={72} />
            <p className="mt-5 text-[20px] font-bold">Your messages live here</p>
            <p className="mt-2 text-[14.5px] text-chat-muted">
              Sign in to chat with sellers and buyers, share photos and send voice notes.
            </p>
            <Link
              to="/sign-in"
              className="mt-6 flex h-12 items-center rounded-full bg-chat-text px-8 text-[16px] font-semibold text-chat-inverse active:scale-[0.98]"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <>
            {!showArchived && (
              <>
                {rail.length > 0 && !needle && folder === "all" && (
                  <div
                    data-swipe-owner
                    className="flex gap-3 overflow-x-auto px-4 pb-1 pt-2 no-scrollbar"
                  >
                    {rail.map((chat) => (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => openThread(chat)}
                        className="flex w-[66px] shrink-0 flex-col items-center gap-1.5 active:opacity-70"
                      >
                        <Avatar
                          kind="direct"
                          name={chat.title}
                          src={chat.peer?.avatarUrl}
                          seed={chat.peer?.id}
                          size={62}
                          online={isOnline(chat.peerLastActiveAt)}
                        />
                        <span className="w-full truncate text-center text-[12px] text-chat-muted">
                          {chat.title.split(" ")[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div
                  data-swipe-owner
                  className="flex gap-2 overflow-x-auto px-4 pb-2 pt-2 no-scrollbar"
                  role="tablist"
                >
                  {FOLDERS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={folder === key}
                      onClick={() => switchFolder(key)}
                      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-[18px] text-[15px] font-semibold transition-colors ${
                        folder === key
                          ? "bg-chat-text text-chat-inverse"
                          : "bg-chat-soft text-chat-text"
                      }`}
                    >
                      {label}
                      {key === "unread" && unreadCount > 0 && (
                        <span
                          className={`rounded-full px-1.5 text-[11.5px] ${
                            folder === key ? "bg-chat-inverse/20" : "bg-chat-accent text-white"
                          }`}
                        >
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            <motion.div
              key={showArchived ? "archived" : folder}
              initial={{ x: folderDirection * 28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
            >
              {!showArchived && (folder === "offers" || folder === "orders") ? (
                <TabPreview tab={folder} />
              ) : loading ? (
                <ConversationSkeleton />
              ) : inbox.status === "error" ? (
                <div className="px-10 pt-16 text-center">
                  <p className="text-[16px] font-semibold">Couldn't load your chats</p>
                  <button
                    type="button"
                    onClick={() => void inbox.reload()}
                    className="mt-4 h-10 rounded-full bg-chat-soft px-5 text-[14px] font-semibold active:scale-95"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                list
              )}
            </motion.div>
          </>
        )}
      </div>

      <NewChatSheet
        open={newChatOpen}
        me={me}
        chats={inbox.chats}
        onClose={() => setNewChatOpen(false)}
        onOpenChat={(chat) => {
          setNewChatOpen(false);
          afterOverlayClose(() => openThread(chat));
        }}
        onStartWith={async (person) => {
          const chat = await startWith(person);
          if (!chat) return;
          setNewChatOpen(false);
          afterOverlayClose(() => openThread(chat));
        }}
      />

      <ChatActionsSheet
        chat={actionsFor}
        onClose={() => setActionsFor(null)}
        onTogglePin={fromSheet(togglePin)}
        onToggleMute={fromSheet(toggleMute)}
        onToggleRead={fromSheet(toggleRead)}
        onToggleArchive={fromSheet(toggleArchive)}
        onDelete={() => {
          const chat = actionsFor;
          setActionsFor(null);
          if (chat) afterOverlayClose(() => setDeleteTarget(chat));
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={
          deleteTarget?.kind === "self"
            ? "Clear your notes?"
            : `Delete chat with ${deleteTarget?.title}?`
        }
        body={
          deleteTarget?.kind === "self"
            ? "Everything in Me is removed. This can't be undone."
            : "It's removed for you only, and comes back if they write again."
        }
        confirmLabel={deleteTarget?.kind === "self" ? "Clear" : "Delete"}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const chat = deleteTarget;
          setDeleteTarget(null);
          if (chat)
            guarded(
              inbox.actions.deleteChat(chat),
              chat.kind === "self" ? "Notes cleared" : "Chat deleted",
            );
        }}
      />

      <AnimatePresence>
        {openChat && me && (
          <ChatThread
            key={openChat.id}
            chat={openChat}
            me={me}
            thread={thread}
            typing={inbox.typingIn(openChat.id)}
            otherUnread={otherUnread}
            chats={inbox.chats}
            inbox={inbox.actions}
            onPatchChat={(changes) => inbox.patch(openChat.id, changes)}
            onBack={backToInbox}
            onToast={report}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-6 ${
              openId ? "top-[calc(env(safe-area-inset-top)+72px)]" : "bottom-28"
            }`}
          >
            <span className="rounded-full bg-chat-text px-4 py-2.5 text-[13.5px] font-medium text-chat-inverse shadow-xl">
              {toast}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {!openId && <BottomNav active="messages" ownUsername={ownUsername} />}
    </div>
  );
}
