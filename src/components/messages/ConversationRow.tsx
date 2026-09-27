import { useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  BellOff,
  Camera,
  Check,
  CheckCheck,
  Mail,
  MailOpen,
  Mic,
  Pin,
  PinOff,
} from "lucide-react";
import { useLongPress } from "@/hooks/use-long-press";
import { haptic, relativeShort } from "@/lib/messages-format";
import { describeMessage, isOnline, isUnread, tickFor, type Chat } from "@/lib/chat/model";
import { Avatar } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { TypingDots } from "./TypingDots";

const ACTION_WIDTH = 74;

type Props = {
  chat: Chat;
  query: string;
  typing: boolean;
  onOpen: () => void;
  onLongPress: () => void;
  onToggleRead: () => void;
  onToggleMute: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
};

export function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[3px] bg-chat-accent/25 px-[1px] text-chat-text">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

export function ConversationRow({
  chat,
  query,
  typing,
  onOpen,
  onLongPress,
  onToggleRead,
  onToggleMute,
  onTogglePin,
  onToggleArchive,
}: Props) {
  const controls = useAnimationControls();
  const revealed = useRef(false);
  // A swipe ends in a click on the same row; that click is not a tap.
  const draggedAt = useRef(0);
  const unread = isUnread(chat);
  const last = chat.lastMessage;
  const supportsSwipe = chat.kind !== "support";
  const trailing = chat.kind === "self" ? 2 : 3;

  const settle = (to: number) => {
    revealed.current = to !== 0;
    void controls.start({ x: to, transition: { type: "spring", stiffness: 520, damping: 44 } });
  };

  const press = useLongPress(
    () => {
      haptic(12);
      settle(0);
      onLongPress();
    },
    {
      delay: 380,
      onTap: () => {
        if (Date.now() - draggedAt.current < 400) return;
        if (revealed.current) {
          settle(0);
          return;
        }
        onOpen();
      },
    },
  );

  const preview = typing ? null : last ? describeMessage(last) : null;

  return (
    // The row owns its own horizontal swipe, so the inbox's folder swipe
    // stands down for any gesture that starts here.
    <div data-swipe-owner className="relative overflow-hidden">
      {supportsSwipe && (
        <>
          <div className="absolute inset-y-0 right-0 flex items-stretch">
            <SwipeAction
              name={chat.title}
              label={chat.muted ? "Unmute" : "Mute"}
              icon={BellOff}
              className="bg-[#8e8e93]"
              onClick={() => {
                onToggleMute();
                settle(0);
              }}
            />
            {chat.kind !== "self" && (
              <SwipeAction
                name={chat.title}
                label={chat.pinnedAt ? "Unpin" : "Pin"}
                icon={chat.pinnedAt ? PinOff : Pin}
                className="bg-[#ff9500]"
                onClick={() => {
                  onTogglePin();
                  settle(0);
                }}
              />
            )}
            <SwipeAction
              name={chat.title}
              label={chat.archivedAt ? "Unarchive" : "Archive"}
              icon={chat.archivedAt ? ArchiveRestore : Archive}
              className="bg-[#5b7cfa]"
              onClick={() => {
                onToggleArchive();
                settle(0);
              }}
            />
          </div>
          <div className="absolute inset-y-0 left-0 flex w-[120px] items-center gap-2 bg-chat-accent pl-6 text-[12px] font-semibold text-white">
            {unread ? <MailOpen size={20} /> : <Mail size={20} />}
            {unread ? "Read" : "Unread"}
          </div>
        </>
      )}

      <motion.div
        drag={supportsSwipe ? "x" : false}
        dragDirectionLock
        dragElastic={0.12}
        dragConstraints={{ left: -ACTION_WIDTH * trailing, right: 120 }}
        animate={controls}
        onDragStart={() => (draggedAt.current = Date.now())}
        onDragEnd={(_, info) => {
          draggedAt.current = Date.now();
          if (info.offset.x > 80) {
            haptic();
            onToggleRead();
            settle(0);
          } else if (info.offset.x < -60) {
            haptic();
            settle(-ACTION_WIDTH * trailing);
          } else {
            settle(0);
          }
        }}
        className="relative bg-chat-bg"
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={`${chat.title}${unread ? ", unread" : ""}`}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpen();
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            onLongPress();
          }}
          {...press}
          className="flex w-full select-none items-center gap-3 px-4 py-[3px] text-left transition-colors active:bg-chat-text/[0.06]"
          style={{ WebkitTouchCallout: "none" }}
        >
          <Avatar
            kind={chat.kind}
            name={chat.title}
            src={chat.peer?.avatarUrl}
            seed={chat.peer?.id ?? chat.id}
            online={chat.kind === "direct" && isOnline(chat.peerLastActiveAt)}
          />
          <div className="min-w-0 flex-1 border-b border-chat-border py-[11px]">
            <div className="flex items-center gap-1.5">
              <p
                className={`min-w-0 truncate text-[16px] tracking-[-0.01em] ${
                  unread ? "font-bold" : "font-semibold"
                } text-chat-text`}
              >
                <Highlighted text={chat.title} query={query} />
              </p>
              {chat.verified && <VerifiedBadge />}
              {chat.muted && (
                <BellOff size={13} className="shrink-0 text-chat-faint" aria-label="Muted" />
              )}
              <span
                className={`ml-auto shrink-0 pl-2 text-[12.5px] ${
                  unread && !chat.muted ? "font-semibold text-chat-accent" : "text-chat-faint"
                }`}
              >
                {last ? relativeShort(last.createdAt) : ""}
              </span>
            </div>
            <div className="mt-[3px] flex items-center gap-1.5">
              {typing ? (
                <p className="flex h-[20px] flex-1 items-center gap-1.5 text-[14px] font-medium text-chat-accent">
                  <TypingDots /> typing
                </p>
              ) : (
                <p
                  className={`flex min-w-0 flex-1 items-center gap-1 text-[14.5px] leading-[20px] ${
                    unread ? "font-medium text-chat-text" : "text-chat-muted"
                  }`}
                >
                  {last?.mine && !last.deleted && chat.kind === "direct" && (
                    <PreviewTick chat={chat} />
                  )}
                  {last?.kind === "image" && !last.deleted && (
                    <Camera size={15} className="shrink-0" aria-hidden />
                  )}
                  {last?.kind === "audio" && !last.deleted && (
                    <Mic size={15} className="shrink-0 text-chat-accent" aria-hidden />
                  )}
                  <span className={`truncate ${last?.deleted ? "italic" : ""}`}>
                    {preview ? (
                      <Highlighted text={preview} query={query} />
                    ) : chat.kind === "self" ? (
                      "Notes, links and saved looks"
                    ) : chat.kind === "support" ? (
                      "Questions, complaints or feedback"
                    ) : (
                      ""
                    )}
                  </span>
                </p>
              )}
              <span className="flex shrink-0 items-center gap-1.5">
                {chat.pinnedAt && (
                  <Pin size={14} className="rotate-45 text-chat-faint" aria-label="Pinned" />
                )}
                {unread && (
                  <span
                    className={`flex h-[21px] min-w-[21px] items-center justify-center rounded-full px-1.5 text-[12px] font-bold text-white ${
                      chat.muted ? "bg-chat-faint" : "bg-chat-accent"
                    }`}
                  >
                    {chat.unreadCount > 0 ? (chat.unreadCount > 99 ? "99+" : chat.unreadCount) : ""}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PreviewTick({ chat }: { chat: Chat }) {
  if (!chat.lastMessage) return null;
  const tick = tickFor({ createdAt: chat.lastMessage.createdAt }, chat);
  if (tick === "sent") return <Check size={15} className="shrink-0" aria-label="Sent" />;
  return (
    <CheckCheck
      size={15}
      className={`shrink-0 ${tick === "read" ? "text-chat-accent" : ""}`}
      aria-label={tick === "read" ? "Read" : "Delivered"}
    />
  );
}

function SwipeAction({
  label,
  name,
  icon: Icon,
  className,
  onClick,
}: {
  label: string;
  name: string;
  icon: typeof Pin;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} ${name}`}
      className={`flex flex-col items-center justify-center gap-1 text-[11.5px] font-semibold text-white active:brightness-110 ${className}`}
      style={{ width: ACTION_WIDTH }}
    >
      <Icon size={20} />
      {label}
    </button>
  );
}
