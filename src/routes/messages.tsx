import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Paperclip, Plus, Search, Send, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
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

// Keep this as an array so real stories can be appended without changing the UI shape.
const STORIES = [{ id: "your-story", name: "Your story" }];

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

type ChatMessage = SupportMessage;

function MessagesPage() {
  const { user } = useSession();
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("messages");
  const [storyNotice, setStoryNotice] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const messagingClient = supabase as unknown as SupabaseClient<MessagingDatabase>;

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

  useEffect(() => {
    if (!chatOpen || !user) return;
    let cancelled = false;
    setMessagesLoading(true);
    setMessageError(null);

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
              : [...messages, message],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void messagingClient.removeChannel(channel);
    };
  }, [chatOpen, user, messagingClient]);

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !user) return;
    setDraft("");
    setMessageError(null);

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

  return (
    <div className="min-h-screen bg-black text-white pb-28">
      <div className="pt-4 px-4 flex items-center justify-between">
        <h1 className="text-[20px] font-bold">Messages</h1>
        {chatOpen ? (
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            aria-label="Close conversation"
            className="p-1 -mr-1 text-white"
          >
            <X size={20} />
          </button>
        ) : (
          <button aria-label="Search" className="p-1 -mr-1 text-white">
            <Search size={20} />
          </button>
        )}
      </div>

      {!chatOpen && (
        <div className="mt-4 px-4 flex items-center justify-center gap-8 border-b border-white/10 text-[15px]">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-2.5 -mb-px border-b-2 transition-colors duration-200 ${
                tab === key
                  ? "border-white font-semibold text-white"
                  : "border-transparent text-white/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!chatOpen && (
        <>
          <div className="mt-4 px-4 flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {STORIES.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setStoryNotice(true)}
                className="flex flex-col items-center gap-1.5 shrink-0"
                style={{ width: 60 }}
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                    <Plus size={12} className="text-black" />
                  </span>
                </div>
                <span className="text-[11px] text-white/60 truncate w-full text-center">
                  {story.name}
                </span>
              </button>
            ))}
          </div>

          {storyNotice && (
            <div className="mx-4 mt-3 rounded-lg bg-white/10 px-4 py-3 text-center text-sm text-white/70">
              Stories will be available soon
            </div>
          )}

          <div className="mt-4">
            {tab === "messages" ? (
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition-colors duration-150"
              >
                <div className="w-11 h-11 rounded-full bg-white/10 border border-white/10 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium truncate">Oakmonte Labs</p>
                  <p className="text-[13px] text-white/50 truncate">
                    Make complaints or observations
                  </p>
                </div>
              </button>
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
          <div className="border-b border-white/10 pb-4 text-center">
            <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-white/10 border border-white/10" />
            <h2 className="text-base font-semibold">Oakmonte Labs</h2>
            <p className="mt-1 text-sm text-white/50">Make complaints or observations</p>
          </div>
          <div className="flex-1 space-y-3 py-5">
            {messagesLoading && (
              <p className="pt-10 text-center text-sm text-white/35">Loading messages...</p>
            )}
            {!messagesLoading && chatMessages.length === 0 && (
              <p className="pt-10 text-center text-sm text-white/35">
                Start a conversation with Oakmonte Labs
              </p>
            )}
            {messageError && <p className="text-center text-sm text-red-300">{messageError}</p>}
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
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
            <button type="button" aria-label="Attach a file" className="p-2 text-white/60">
              <Paperclip size={19} />
            </button>
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

      <BottomNav active="messages" ownUsername={ownUsername} />
    </div>
  );
}
