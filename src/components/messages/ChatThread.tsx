import { useEffect, useMemo, useRef, useState } from "react";
import type { Conversation, SeedMessage } from "@/lib/messages-seed";
import { dayDividerLabel, groupsWith, haptic, sameDay } from "@/lib/messages-format";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { DateDivider } from "./DateDivider";
import { MessageBubble } from "./MessageBubble";
import { QuickReplies } from "./QuickReplies";
import { ReactionBar } from "./ReactionBar";
import { ThreadSkeleton } from "./Skeletons";
import { TypingDots } from "./TypingDots";
import { ConversationAvatar } from "./ConversationAvatar";

type Props = {
  conversation: Conversation;
  messages: SeedMessage[];
  loading: boolean;
  error: string | null;
  emptyHint: string;
  quickReplies: string[];
  typing: boolean;
  draft: string;
  sending: boolean;
  composerDisabled?: boolean;
  muted: boolean;
  onDraftChange: (value: string) => void;
  onSend: (replyTo: string | null) => void;
  onBack: () => void;
  onToggleMute: () => void;
  onMarkUnread: () => void;
  onToast: (message: string) => void;
};

export function ChatThread({
  conversation,
  messages,
  loading,
  error,
  emptyHint,
  quickReplies,
  typing,
  draft,
  sending,
  composerDisabled,
  muted,
  onDraftChange,
  onSend,
  onBack,
  onToggleMute,
  onMarkUnread,
  onToast,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<SeedMessage | null>(null);

  // Auto-scroll only when the reader is already near the bottom, so reading
  // history isn't yanked away by an incoming message.
  const nearBottom = useRef(true);
  useEffect(() => {
    const node = scroller.current;
    if (!node || !nearBottom.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, typing, loading]);

  const rows = useMemo(() => {
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];
      const showDivider = !previous || !sameDay(previous.created_at, message.created_at);
      const lastOfGroup =
        !next ||
        next.sender !== message.sender ||
        !groupsWith(message.created_at, next.created_at) ||
        message.kind !== "text";
      return { message, showDivider, lastOfGroup };
    });
  }, [messages]);

  const lastMine = [...messages].reverse().find((message) => message.sender === "user");
  const showEmpty = !loading && messages.length === 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-chat-bg">
      <div className="flex w-full max-w-[560px] flex-col md:border-x md:border-chat-border">

      <ChatHeader
        conversation={conversation}
        scrolled={scrolled}
        muted={muted}
        onBack={onBack}
        onToggleMute={onToggleMute}
        onMarkUnread={onMarkUnread}
      />

      <div
        ref={scroller}
        onScroll={(event) => {
          const node = event.currentTarget;
          setScrolled(node.scrollTop > 6);
          nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
        }}
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-3"
      >
        {loading && <ThreadSkeleton />}

        {showEmpty && (
          <div className="flex flex-col items-center gap-3 px-8 pb-6 pt-16 text-center">
            <ConversationAvatar conversation={conversation} size={72} />
            <p className="text-[17px] font-semibold text-chat-text">{conversation.name}</p>
            <p className="text-[13px] text-chat-muted">{emptyHint}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="py-4 text-center text-[13px] text-chat-danger">
            {error}
          </p>
        )}

        <div className="space-y-1.5 pt-1">
          {rows.map(({ message, showDivider, lastOfGroup }) => (
            <div key={message.id}>
              {showDivider && <DateDivider label={dayDividerLabel(message.created_at)} />}
              <MessageBubble
                message={message}
                mine={message.sender === "user"}
                lastOfGroup={lastOfGroup}
                reaction={reactions[message.id]}
                seenLabel={
                  message.id === lastMine?.id && conversation.kind !== "self" ? "Seen" : null
                }
                onLongPress={() => setActionsFor(message)}
                onReply={() => {
                  setReplyTo(message.body ?? message.product?.name ?? "Attachment");
                }}
                onAddToCart={() => {
                  haptic();
                  onToast("Added to your cart");
                }}
              />
            </div>
          ))}
        </div>

        {typing && (
          <div className="flex items-center gap-2 pt-3">
            <ConversationAvatar conversation={conversation} size={26} />
            <span className="rounded-[18px] bg-white/10 px-3.5 py-3 text-chat-muted">
              <TypingDots />
            </span>
          </div>
        )}
      </div>

      {!loading && !lastMine && draft.trim().length === 0 && (
        <QuickReplies
          replies={quickReplies}
          onPick={(reply) => {
            onDraftChange(reply);
          }}
        />
      )}

      <Composer
        value={draft}
        onChange={onDraftChange}
        onSend={() => {
          onSend(replyTo);
          setReplyTo(null);
        }}
        disabled={composerDisabled}
        sending={sending}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        placeholder={conversation.kind === "self" ? "Message yourself..." : "Message..."}
      />
      </div>



      {actionsFor && (
        <ReactionBar
          onReact={(emoji) => {
            haptic();
            setReactions((current) => ({
              ...current,
              [actionsFor.id]: current[actionsFor.id] === emoji ? "" : emoji,
            }));
            setActionsFor(null);
          }}
          onReply={() => {
            setReplyTo(actionsFor.body ?? actionsFor.product?.name ?? "Attachment");
            setActionsFor(null);
          }}
          onCopy={() => {
            if (actionsFor.body) void navigator.clipboard?.writeText(actionsFor.body);
            onToast("Copied");
            setActionsFor(null);
          }}
          onClose={() => setActionsFor(null)}
        />
      )}
    </div>
  );
}
