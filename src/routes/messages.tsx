import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CircleHelp,
  CircleDollarSign,
  Flag,
  Inbox,
  Plus,
  Search,
  Send,
  ShoppingCart,
  Tag,
  UserRound,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import logoAsset from "@/assets/oakmonte-o-mark.png.asset.json";
import { supabase } from "@/lib/integrations/my-supabase/client";
import type { Database } from "@/lib/integrations/my-supabase/types";
import { useSession } from "@/hooks/use-session";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — Oakmonte" }] }),
  component: MessagesPage,
});

type Tab = "offers" | "messages" | "orders";

const TABS: { key: Tab; label: string }[] = [
  { key: "offers", label: "Offers" },
  { key: "messages", label: "Messages" },
  { key: "orders", label: "Orders" },
];

const MESSAGE_FILTERS = [
  { label: "Unread", icon: Inbox },
  { label: "Unanswered", icon: CircleHelp },
  { label: "Flagged", icon: Flag },
  { label: "Booked", icon: CalendarDays },
  { label: "Ordered", icon: ShoppingCart },
  { label: "Paid", icon: CircleDollarSign },
  { label: "Dispatched", icon: Inbox },
  { label: "Lead", icon: Tag },
] as const;

// Keep this as an array so real stories can be appended without changing the UI shape.
const STORIES = [{ id: "your-story", name: "Your story" }];

type SupportMessage = {
  id: string;
  user_id: string;
  body: string;
  sender: "user" | "support";
  created_at: string;
};

type ContactId = "support" | "me" | "preview";

type Contact = {
  id: ContactId;
  name: string;
  subtitle: string;
  preview: string;
  initials: string;
  accent: string;
  icon: "support" | "me" | "person";
};

const CONTACTS: Contact[] = [
  {
    id: "support",
    name: "Oakmonte Support",
    subtitle: "Official support",
    preview: "Make complaints or observations",
    initials: "O",
    accent: "bg-white",
    icon: "support",
  },
  {
    id: "me",
    name: "Me",
    subtitle: "Personal notes",
    preview: "A quiet place for your thoughts",
    initials: "M",
    accent: "bg-[#4b4b4b]",
    icon: "me",
  },
  {
    id: "preview",
    name: "Nia from Lagos",
    subtitle: "Preview contact",
    preview: "That blue jacket is everything",
    initials: "N",
    accent: "bg-[#4b4b4b]",
    icon: "person",
  },
];

type LocalMessage = {
  id: string;
  body: string;
  sender: "user" | "contact";
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

type ChatMessage = SupportMessage | LocalMessage;

const LOCAL_MESSAGES: Record<Exclude<ContactId, "support">, LocalMessage[]> = {
  me: [
    {
      id: "me-1",
      body: "Ideas, saved looks, and little reminders live here.",
      sender: "contact",
      created_at: "2026-09-09T08:30:00.000Z",
    },
    {
      id: "me-2",
      body: "Remember: the best outfits usually start with one good piece.",
      sender: "user",
      created_at: "2026-09-09T08:31:00.000Z",
    },
  ],
  preview: [
    {
      id: "preview-1",
      body: "That blue jacket is everything",
      sender: "contact",
      created_at: "2026-09-08T18:42:00.000Z",
    },
    {
      id: "preview-2",
      body: "Right? I found it on Oakmonte yesterday.",
      sender: "user",
      created_at: "2026-09-08T18:45:00.000Z",
    },
  ],
};

function ContactAvatar({ contact, large = false }: { contact: Contact; large?: boolean }) {
  const Icon = contact.icon === "support" ? CircleHelp : UserRound;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full ${contact.accent} text-white ${large ? "h-12 w-12" : "h-11 w-11"}`}
    >
      {contact.id === "support" ? (
        <img src={logoAsset.url} alt="Oakmonte" className="h-[68%] w-[68%] object-contain" />
      ) : (
        <Icon size={large ? 21 : 19} strokeWidth={1.8} />
      )}
    </div>
  );
}

function MessagesPage() {
  const { user } = useSession();
  const touchStartX = useRef<number | null>(null);
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("messages");
  const [storyNotice, setStoryNotice] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<ContactId | null>(null);
  const [draft, setDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

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

  const chatOpen = selectedContactId !== null;
  const selectedContact = CONTACTS.find((contact) => contact.id === selectedContactId);

  useEffect(() => {
    if (!chatOpen || !user || selectedContactId !== "support") {
      if (selectedContactId && selectedContactId !== "support") {
        setChatMessages(LOCAL_MESSAGES[selectedContactId]);
        setMessagesLoading(false);
      }
      return;
    }
    let cancelled = false;
    setMessagesLoading(true);
    setMessageError(null);
    setChatMessages([]);

    messagingClient
      .from("support_messages")
      .select("id, user_id, body, sender, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setMessageError("Messages are temporarily unavailable.");
        } else {
          setChatMessages(data ?? []);
        }
        setMessagesLoading(false);
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
          const message = payload.new as SupportMessage;
          setChatMessages((messages) =>
            messages.some((existing) => existing.id === message.id)
              ? messages
              : [...messages, { ...message, sender: message.sender }],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void messagingClient.removeChannel(channel);
    };
  }, [chatOpen, selectedContactId, user]);

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMessageError(null);

    if (selectedContactId !== "support") {
      setChatMessages((messages) => [
        ...messages,
        {
          id: `local-${Date.now()}`,
          body: text,
          sender: "user",
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }

    if (!user) return;

    const { error } = await messagingClient.from("support_messages").insert({
      user_id: user.id,
      body: text,
      sender: "user",
    });

    if (error) {
      setDraft(text);
      setMessageError("Your message could not be sent. Please try again.");
    }
  };

  const openContact = (contactId: ContactId) => {
    setSelectedContactId(contactId);
    setDraft("");
    setMessageError(null);
  };

  const closeChat = () => {
    setSelectedContactId(null);
    setDraft("");
    setMessageError(null);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!chatOpen && !filterOpen) touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (chatOpen || filterOpen || touchStartX.current === null) return;

    const distance = event.changedTouches[0]?.clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 50) return;

    const currentIndex = TABS.findIndex(({ key }) => key === tab);
    const nextIndex = distance < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextTab = TABS[nextIndex];
    if (nextTab) setTab(nextTab.key);
  };

  return (
    <div
      className="min-h-screen bg-black pb-28 text-white"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-end px-4 pt-4">
        {chatOpen ? (
          <button
            type="button"
            onClick={closeChat}
            aria-label="Back to conversations"
            className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/10"
          >
            <ArrowLeft size={15} />
            Inbox
          </button>
        ) : (
          <div className="flex w-full items-center gap-3 pt-1">
            <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl bg-[#25282e] px-4 text-white/65">
              <Search size={22} strokeWidth={2} />
              <span className="text-[18px]">Search</span>
            </div>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="shrink-0 px-1 text-[17px] font-semibold text-[#7596ff]"
            >
              Filter
            </button>
          </div>
        )}
      </div>

      {!chatOpen && (
        <>
          <div className="mt-5 flex gap-4 overflow-x-auto px-5 pb-1 no-scrollbar">
            {STORIES.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setStoryNotice(true)}
                className="flex shrink-0 flex-col items-center gap-1.5"
                style={{ width: 78 }}
              >
                <div className="relative">
                  <div className="h-[74px] w-[74px] rounded-full border border-white/20 bg-[#1b1d20]" />
                  <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-white">
                    <Plus size={15} strokeWidth={2.5} className="text-black" />
                  </span>
                </div>
                <span className="w-full truncate text-center text-[12px] text-white/60">
                  {story.name}
                </span>
              </button>
            ))}
          </div>

          {storyNotice && (
            <div
              className="mx-4 mt-3 rounded-xl border border-white/10 bg-[#24272c] px-4 py-3 text-center text-sm text-white/75 shadow-lg"
              style={{ animation: "messages-banner-drop 280ms ease-out both" }}
            >
              Stories will be available soon
            </div>
          )}

          <div className="mt-7">
            <div className="flex items-center justify-center gap-9 border-b border-white/10 px-4 text-[17px] font-bold">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`pb-3 -mb-px border-b-2 transition-colors duration-200 ${
                    tab === key ? "border-white text-white" : "border-transparent text-white/45"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "messages" ? (
              <div className="pt-3">
                {CONTACTS.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => openContact(contact.id)}
                    className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.08]"
                  >
                    <div className="scale-[1.08]">
                      <ContactAvatar contact={contact} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[17px] font-semibold tracking-[-0.01em]">
                          {contact.name}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-[15px] text-white/55">{contact.preview}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 pt-10 text-center text-sm text-white/50">
                This feature will be available in full launch
              </div>
            )}
          </div>
        </>
      )}

      {chatOpen && (
        <div className="mt-4 flex min-h-[calc(100vh-150px)] flex-col px-4">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            {selectedContact && <ContactAvatar contact={selectedContact} large />}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{selectedContact?.name}</h2>
              <p className="mt-1 truncate text-sm text-white/50">{selectedContact?.subtitle}</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 py-5">
            {messagesLoading && (
              <p className="pt-10 text-center text-sm text-white/35">Loading messages...</p>
            )}
            {!messagesLoading && chatMessages.length === 0 && (
              <p className="pt-10 text-center text-sm text-white/35">
                Start a conversation with {selectedContact?.name}
              </p>
            )}
            {messageError && <p className="text-center text-sm text-red-300">{messageError}</p>}
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${message.sender === "user" ? "bg-white text-black" : "bg-white/10 text-white"}`}
                >
                  {message.body}
                </p>
              </div>
            ))}
          </div>
          <form
            onSubmit={sendMessage}
            className="flex items-center gap-2 border-t border-white/10 py-3"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message..."
              aria-label="Write a message"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="rounded-full bg-white p-2 text-black disabled:opacity-40"
              disabled={!draft.trim()}
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      )}

      {filterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/65"
          role="presentation"
          onClick={() => setFilterOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-filter-title"
            className="w-full rounded-t-[34px] border-t border-white/10 bg-[#1a1d22] px-5 pb-10 pt-4 text-white shadow-2xl"
            style={{ animation: "messages-sheet-rise 280ms ease-out both" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/55" />
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="w-16" />
              <h2 id="message-filter-title" className="text-[22px] font-bold">
                Filter
              </h2>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="w-16 text-right text-[18px] font-semibold"
              >
                Clear
              </button>
            </div>
            <div className="pt-1">
              {MESSAGE_FILTERS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  className="flex w-full items-center gap-4 py-3.5 text-left text-[20px] font-medium"
                >
                  <Icon size={27} strokeWidth={1.8} />
                  <span className="flex-1">{label}</span>
                  <span className="h-8 w-8 rounded-full border-2 border-white/65" />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <BottomNav active="messages" ownUsername={ownUsername} />
    </div>
  );
}
