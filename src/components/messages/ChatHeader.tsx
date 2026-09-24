import { useEffect, useRef, useState } from "react";
import { BellOff, ChevronLeft, MailOpen, ShieldAlert, Tag } from "lucide-react";
import type { Conversation } from "@/lib/messages-seed";
import { activeLabel } from "@/lib/messages-format";
import { ConversationAvatar } from "./ConversationAvatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { glassFloating } from "./glass";
import { GLASS_RIM } from "@/lib/liquid-glass";

type Props = {
  conversation: Conversation;
  scrolled: boolean;
  muted: boolean;
  onBack: () => void;
  onToggleMute: () => void;
  onMarkUnread: () => void;
};

export function ChatHeader({
  conversation,
  scrolled,
  muted,
  onBack,
  onToggleMute,
  onMarkUnread,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const presence = activeLabel(conversation.activeMinutesAgo);
  const status = presence ?? (conversation.businessChat ? "Business chat" : null);

  return (
    <header
      className={`sticky top-0 z-30 flex items-center gap-2.5 bg-chat-bg/95 px-2 py-2 backdrop-blur-xl transition-colors ${
        scrolled ? "border-b border-chat-border" : "border-b border-transparent"
      }`}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to inbox"
        className="flex h-11 w-11 items-center justify-center rounded-full text-chat-text active:bg-white/10"
      >
        <ChevronLeft size={26} />
      </button>
      <ConversationAvatar conversation={conversation} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h1 className="truncate text-[16px] font-semibold text-chat-text">{conversation.name}</h1>
          {conversation.verified && <VerifiedBadge />}
        </div>
        {status && (
          <p className="flex items-center gap-1.5 text-[12px] text-chat-muted">
            {conversation.activeMinutesAgo === 0 && (
              <span className="h-[6px] w-[6px] rounded-full bg-chat-online" aria-hidden />
            )}
            {status}
          </p>
        )}
      </div>
      <div className="relative" ref={wrapper}>
        <button
          type="button"
          aria-label="Conversation options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-chat-text active:bg-white/10"
        >
          <Tag size={21} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className={`absolute right-1 top-11 z-40 w-[188px] overflow-hidden rounded-[16px] text-[14px] text-chat-text ${GLASS_RIM}`}
            style={glassFloating}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onToggleMute();
                setMenuOpen(false);
              }}
              className="flex h-11 w-full items-center gap-2.5 px-3.5 text-left active:bg-white/10"
            >
              <BellOff size={17} /> {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMarkUnread();
                setMenuOpen(false);
              }}
              className="flex h-11 w-full items-center gap-2.5 border-t border-chat-border px-3.5 text-left active:bg-white/10"
            >
              <MailOpen size={17} /> Mark unread
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex h-11 w-full items-center gap-2.5 border-t border-chat-border px-3.5 text-left text-chat-danger active:bg-white/10"
            >
              <ShieldAlert size={17} /> Report
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
