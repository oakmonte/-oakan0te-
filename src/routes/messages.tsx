import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { motion } from "framer-motion";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Database } from "@/lib/integrations/my-supabase/types";
import { useSession } from "@/hooks/use-session";
import { BottomNav } from "@/components/BottomNav";
import { ConversationRow } from "@/components/messages/ConversationRow";
import { ConversationSkeleton } from "@/components/messages/Skeletons";
import { StoryRail } from "@/components/messages/StoryRail";
import { FilterSheet } from "@/components/messages/FilterSheet";
import { FILTERS } from "@/lib/messages-filters";
import { TabPreview } from "@/components/messages/TabPreview";
import { ChatThread } from "@/components/messages/ChatThread";
import {
  SEED_CONVERSATIONS,
  SEED_MESSAGES,
  type Conversation,
  type FilterKey,
  type SeedMessage,
} from "@/lib/messages-seed";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Oakmonte" },
      {
        name: "description",
        content:
          "Chat with Oakmonte sellers and buyers: negotiate offers, follow orders and keep every conversation in one inbox.",
      },
      { property: "og:title", content: "Messages — Oakmonte" },
      {
        property: "og:description",
        content: "Offers, orders and conversations with Oakmonte sellers, all in one inbox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

type Tab = "offers" | "messages" | "orders";

const TABS: { key: Tab; label: string }[] = [
  { key: "offers", label: "Offers" },
  { key: "messages", label: "Messages" },
  { key: "orders", label: "Orders" },
];

/* ---------- support_messages: the only real table on this page ---------- */

type SupportMessage = {
  id: string;
  user_id: string;
  body: string;
  sender: "user" | "support";
  created_at: string;
};

type MessagingDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      support_messages: {
        Row: SupportMessage;
        Insert: Pick<SupportMessage, "user_id" | "body" | "sender">;
        Update: Partial<Pick<SupportMessage, "body" | "sender">>;
        Relationships: [];
      };
    };
  };
};

const messagingClient = supabase as unknown as SupabaseClient<MessagingDatabase>;

const toSeed = (row: SupportMessage): SeedMessage => ({
  id: row.id,
  thread_id: "support",
  sender: row.sender === "user" ? "user" : "contact",
  created_at: row.created_at,
  kind: "text",
  body: row.body,
});

const QUICK_REPLIES: Record<string, string[]> = {
  support: ["I need help with an order", "Report a seller", "Payout question"],
  me: ["Save this look", "Remind me tomorrow"],
};

const DEFAULT_QUICK_REPLIES = ["Is this still available?", "Can you do a better price?", "Thanks!"];

function MessagesPage() {
  const { user, loading: sessionLoading } = useSession();
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);

  const [tab, setTab] = useState<Tab>("messages");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterKey[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([]);
  const [storyNotice, setStoryNotice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [inboxLoading, setInboxLoading] = useState(true);

  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVERSATIONS);
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [localThreads, setLocalThreads] = useState<Record<string, SeedMessage[]>>(SEED_MESSAGES);
  const [supportMessages, setSupportMessages] = useState<SeedMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const touchStartX = useRef<number | null>(null);
  const inboxScroll = useRef(0);

  /* ---------- own username for the bottom nav ---------- */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("personal_username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setOwnUsername(data.personal_username);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /* ---------- inbox skeleton, one short beat ---------- */
  useEffect(() => {
    const timer = setTimeout(() => setInboxLoading(false), 420);
    return () => clearTimeout(timer);
  }, []);

  /* ---------- debounced search ---------- */
  useEffect(() => {
    if (query !== debouncedQuery) setSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setSearching(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [query, debouncedQuery]);

  /* ---------- auto-dismissing notices ---------- */
  useEffect(() => {
    if (!storyNotice) return;
    const timer = setTimeout(() => setStoryNotice(false), 2600);
    return () => clearTimeout(timer);
  }, [storyNotice]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const openConversation = conversations.find((item) => item.id === openId) ?? null;

  /* ---------- support thread: real read + realtime ---------- */
  useEffect(() => {
    if (openId !== "support" || !user) return;
    let cancelled = false;
    setThreadLoading(true);
    setThreadError(null);
    setSupportMessages([]);

    messagingClient
      .from("support_messages")
      .select("id, user_id, body, sender, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setThreadError("Messages are temporarily unavailable.");
        } else {
          setSupportMessages((data ?? []).map(toSeed));
        }
        setThreadLoading(false);
      });

    const channel = messagingClient
      .channel(`support-messages-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const message = toSeed(payload.new as SupportMessage);
          setSupportMessages((messages) =>
            messages.some((existing) => existing.id === message.id)
              ? messages
              : [...messages, message],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void messagingClient.removeChannel(channel);
    };
  }, [openId, user]);

  /* ---------- thread open / close, with phone-back support ---------- */
  const closeThread = useCallback(() => {
    setOpenId(null);
    setDraft("");
    setThreadError(null);
    requestAnimationFrame(() => window.scrollTo(0, inboxScroll.current));
  }, []);

  useEffect(() => {
    if (!openId) return;
    inboxScroll.current = window.scrollY;
    window.history.pushState({ oakThread: openId }, "");
    const onPop = () => closeThread();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [openId, closeThread]);

  const backFromThread = () => {
    // Unwinds the entry pushed above; the popstate handler closes the thread.
    window.history.back();
  };

  const openThread = (id: string) => {
    setOpenId(id);
    setDraft("");
    setThreadError(null);
    setConversations((current) =>
      current.map((item) => (item.id === id ? { ...item, unread: 0 } : item)),
    );
    if (id !== "support") {
      setThreadLoading(true);
      setTimeout(() => setThreadLoading(false), 260);
    }
  };

  /* ---------- sending ---------- */
  const sendMessage = async (replyTo: string | null) => {
    const text = draft.trim();
    if (!text || sending || !openId) return;

    if (openId !== "support") {
      setDraft("");
      setThreadError(null);
      setLocalThreads((threads) => ({
        ...threads,
        [openId]: [
          ...(threads[openId] ?? []),
          {
            id: `local-${Date.now()}`,
            thread_id: openId,
            sender: "user",
            created_at: new Date().toISOString(),
            kind: "text",
            body: text,
            reply_to_body: replyTo ?? undefined,
          },
        ],
      }));
      return;
    }

    if (sessionLoading) {
      setThreadError("Still checking your account. Your message is ready to send.");
      return;
    }

    if (!user) {
      setThreadError("Sign in to send a message to Oakmonte Support.");
      return;
    }

    setDraft("");
    setThreadError(null);
    setSending(true);

    try {
      const { error } = await messagingClient.from("support_messages").insert({
        user_id: user.id,
        body: text,
        sender: "user",
      });

      if (error) {
        setDraft(text);
        setThreadError("Your message could not be sent. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  /* ---------- filtering + search ---------- */
  const visible = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return conversations
      .filter((item) => {
        if (activeFilters.length > 0) {
          if (activeFilters.includes("unread") && item.unread > 0) return true;
          if (!activeFilters.some((key) => item.tags.includes(key))) return false;
        }
        if (!needle) return true;
        return (
          item.name.toLowerCase().includes(needle) ||
          item.preview.toLowerCase().includes(needle) ||
          (item.handle ?? "").toLowerCase().includes(needle)
        );
      })
      .sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      );
  }, [conversations, debouncedQuery, activeFilters]);

  /* ---------- tab swipe ---------- */
  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!openId && !filterOpen) touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (openId || filterOpen || touchStartX.current === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 50) return;
    const currentIndex = TABS.findIndex(({ key }) => key === tab);
    const nextTab = TABS[distance < 0 ? currentIndex + 1 : currentIndex - 1];
    if (nextTab) setTab(nextTab.key);
  };

  const threadMessages =
    openId === "support" ? supportMessages : openId ? (localThreads[openId] ?? []) : [];

  const tabIndex = TABS.findIndex(({ key }) => key === tab);

  return (
    <div
      className="min-h-screen bg-chat-bg pb-28 text-chat-text"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ---------- search + filter ---------- */}
      <div className="flex items-center gap-3 px-4 pt-5">
        <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[14px] bg-chat-soft px-3.5 text-chat-muted">
          <Search size={20} strokeWidth={2.2} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-[16px] text-chat-text outline-none placeholder:text-chat-muted"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-chat-muted active:bg-white/10"
            >
              <X size={17} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setDraftFilters(activeFilters);
            setFilterOpen(true);
          }}
          aria-label="Filter conversations"
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-chat-soft text-chat-text active:scale-95"
        >
          <SlidersHorizontal size={20} />
          {activeFilters.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-chat-accent px-1 text-[11px] font-bold text-black">
              {activeFilters.length}
            </span>
          )}
        </button>
      </div>

      {/* ---------- active filter chips ---------- */}
      {activeFilters.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto px-4 no-scrollbar">
          {activeFilters.map((key) => {
            const filter = FILTERS.find((item) => item.key === key);
            if (!filter) return null;
            return (
              <button
                key={key}
                type="button"
                aria-label={`Remove ${filter.label} filter`}
                onClick={() => setActiveFilters((current) => current.filter((k) => k !== key))}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-chat-border bg-white/[0.07] px-3 text-[13px] font-medium text-chat-text active:scale-95"
              >
                <filter.icon size={14} />
                {filter.label}
                <X size={14} className="text-chat-muted" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveFilters([])}
            className="h-9 shrink-0 px-2 text-[13px] font-semibold text-chat-accent active:opacity-60"
          >
            Clear all
          </button>
        </div>
      )}

      <StoryRail onAdd={() => setStoryNotice(true)} />

      {storyNotice && (
        <div
          className="mx-4 mt-3 rounded-[16px] border border-chat-border bg-chat-elevated px-4 py-3 text-center text-[14px] text-chat-muted"
          style={{ animation: "messages-banner-drop 280ms ease-out both" }}
        >
          Stories arrive at full launch
        </div>
      )}

      {/* ---------- tabs ---------- */}
      <div className="mt-6">
        <div className="relative border-b border-chat-border">
          <div className="flex items-center px-2 text-[16px] font-bold">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key}
                className={`flex-1 pb-3 pt-1 transition-colors ${
                  tab === key ? "text-chat-text" : "text-chat-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <motion.span
            className="absolute bottom-0 h-[2px] rounded-full bg-chat-text"
            style={{ width: `${100 / TABS.length}%` }}
            animate={{ left: `${(tabIndex * 100) / TABS.length}%` }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          />
        </div>

        {tab === "messages" ? (
          inboxLoading ? (
            <ConversationSkeleton />
          ) : visible.length === 0 ? (
            <div className="px-8 pt-14 text-center">
              <p className="text-[16px] font-semibold text-chat-text">No conversations found</p>
              <p className="mt-1.5 text-[13px] text-chat-muted">
                {debouncedQuery
                  ? `Nothing matches “${debouncedQuery}”.`
                  : "Try clearing your filters."}
              </p>
            </div>
          ) : (
            <div className="pt-1.5">
              {searching && (
                <p className="px-5 pb-1 pt-2 text-[12px] text-chat-faint">Searching…</p>
              )}
              {visible.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  query={debouncedQuery}
                  muted={Boolean(muted[conversation.id])}
                  onOpen={() => openThread(conversation.id)}
                  onToggleRead={() =>
                    setConversations((current) =>
                      current.map((item) =>
                        item.id === conversation.id
                          ? { ...item, unread: item.unread > 0 ? 0 : 1 }
                          : item,
                      ),
                    )
                  }
                  onToggleMute={() => {
                    setMuted((current) => ({
                      ...current,
                      [conversation.id]: !current[conversation.id],
                    }));
                    setToast(
                      muted[conversation.id]
                        ? `${conversation.name} unmuted`
                        : `${conversation.name} muted`,
                    );
                  }}
                  onArchive={() => {
                    setConversations((current) =>
                      current.filter((item) => item.id !== conversation.id),
                    );
                    setToast(`${conversation.name} archived`);
                  }}
                />
              ))}
            </div>
          )
        ) : (
          <TabPreview tab={tab} />
        )}
      </div>

      {filterOpen && (
        <FilterSheet
          selected={draftFilters}
          onToggle={(key) =>
            setDraftFilters((current) =>
              current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
            )
          }
          onClear={() => setDraftFilters([])}
          onApply={() => {
            setActiveFilters(draftFilters);
            setFilterOpen(false);
          }}
          onDismiss={() => setFilterOpen(false)}
        />
      )}

      {openConversation && (
        <ChatThread
          conversation={openConversation}
          messages={threadMessages}
          loading={threadLoading || (openId === "support" && sessionLoading)}
          error={threadError}
          emptyHint={
            openId === "support"
              ? user
                ? "Tell us what happened and we'll pick it up from here."
                : "Sign in to start a conversation with Oakmonte Support."
              : openId === "me"
                ? "Your own quiet corner. Notes, links, saved looks."
                : `Say hello to ${openConversation.name}.`
          }
          quickReplies={QUICK_REPLIES[openConversation.id] ?? DEFAULT_QUICK_REPLIES}
          typing={openConversation.typing}
          draft={draft}
          sending={sending}
          composerDisabled={openId === "support" && !user && !sessionLoading}
          muted={Boolean(muted[openConversation.id])}
          onDraftChange={setDraft}
          onSend={(replyTo) => void sendMessage(replyTo)}
          onBack={backFromThread}
          onToggleMute={() => {
            setMuted((current) => ({
              ...current,
              [openConversation.id]: !current[openConversation.id],
            }));
            setToast(muted[openConversation.id] ? "Unmuted" : "Muted");
          }}
          onMarkUnread={() => {
            setConversations((current) =>
              current.map((item) =>
                item.id === openConversation.id ? { ...item, unread: 1 } : item,
              ),
            );
            backFromThread();
          }}
          onToast={setToast}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-28 z-[80] flex justify-center px-6"
          style={{ animation: "messages-banner-drop 220ms ease-out both" }}
        >
          <span className="rounded-full bg-chat-elevated px-4 py-2.5 text-[13px] font-medium text-chat-text shadow-xl">
            {toast}
          </span>
        </div>
      )}

      {!openId && <BottomNav active="messages" ownUsername={ownUsername} />}
    </div>
  );
}
