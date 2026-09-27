import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Bell,
  BellOff,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Eraser,
  Info,
  MoreVertical,
  Search,
  ShieldAlert,
} from "lucide-react";
import { GLASS_RIM } from "@/lib/liquid-glass";
import { isOnline, presenceLabel, type Chat } from "@/lib/chat/model";
import { Avatar } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { glassFloating } from "./glass";

export type HeaderMenuAction = "info" | "search" | "mute" | "clear" | "block" | "report";

type Props = {
  chat: Chat;
  typing: boolean;
  scrolled: boolean;
  otherUnread: number;
  onBack: () => void;
  onOpenInfo: () => void;
  onMenu: (action: HeaderMenuAction) => void;
  search: {
    active: boolean;
    query: string;
    count: number;
    index: number;
    onQuery: (value: string) => void;
    onStep: (direction: -1 | 1) => void;
    onClose: () => void;
  };
};

function statusLine(chat: Chat, typing: boolean): string | null {
  if (chat.kind === "support") return "Oakmonte team · replies within a day";
  if (chat.kind === "self") return "Only you can see this";
  if (chat.blockedByMe) return "Blocked";
  if (typing) return "typing…";
  return presenceLabel(chat.peerLastActiveAt) ?? (chat.handle ? `@${chat.handle}` : null);
}

export function ChatHeader({
  chat,
  typing,
  scrolled,
  otherUnread,
  onBack,
  onOpenInfo,
  onMenu,
  search,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (search.active) field.current?.focus();
  }, [search.active]);

  const status = statusLine(chat, typing);
  const items: { key: HeaderMenuAction; label: string; icon: LucideIcon; danger?: boolean }[] = [
    { key: "info", label: chat.kind === "direct" ? "Contact info" : "Chat info", icon: Info },
    ...(chat.kind !== "support"
      ? [
          { key: "search" as const, label: "Search", icon: Search },
          {
            key: "mute" as const,
            label: chat.muted ? "Unmute" : "Mute notifications",
            icon: chat.muted ? Bell : BellOff,
          },
          { key: "clear" as const, label: "Clear chat", icon: Eraser },
        ]
      : []),
    ...(chat.kind === "direct"
      ? [
          {
            key: "block" as const,
            label: chat.blockedByMe ? "Unblock" : "Block",
            icon: Ban,
            danger: !chat.blockedByMe,
          },
          { key: "report" as const, label: "Report", icon: ShieldAlert, danger: true },
        ]
      : []),
  ];

  return (
    <header
      className={`relative z-30 flex h-[60px] shrink-0 items-center gap-1 bg-chat-bg/90 px-1.5 backdrop-blur-xl transition-[border-color] ${
        scrolled ? "border-b border-chat-border" : "border-b border-transparent"
      }`}
    >
      {search.active ? (
        <>
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-chat-soft px-3 text-chat-muted">
            <Search size={17} />
            <input
              ref={field}
              value={search.query}
              onChange={(event) => search.onQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") search.onStep(event.shiftKey ? 1 : -1);
                if (event.key === "Escape") search.onClose();
              }}
              placeholder="Search in chat"
              aria-label="Search in chat"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-chat-text outline-none placeholder:text-chat-muted"
            />
            {search.query && (
              <span className="shrink-0 text-[12.5px] tabular-nums">
                {search.count ? `${search.index + 1} of ${search.count}` : "0"}
              </span>
            )}
          </div>
          <button
            type="button"
            aria-label="Older match"
            disabled={!search.count}
            onClick={() => search.onStep(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-chat-text disabled:opacity-30"
          >
            <ChevronUp size={22} />
          </button>
          <button
            type="button"
            aria-label="Newer match"
            disabled={!search.count}
            onClick={() => search.onStep(1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-chat-text disabled:opacity-30"
          >
            <ChevronDown size={22} />
          </button>
          <button
            type="button"
            onClick={search.onClose}
            className="h-10 px-2 text-[15px] font-semibold text-chat-accent"
          >
            Done
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chats"
            className="flex h-11 min-w-11 items-center justify-center rounded-full pr-1 text-chat-text active:bg-chat-text/10"
          >
            <ChevronLeft size={28} />
            {otherUnread > 0 && (
              <span className="-ml-1 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-chat-text/10 px-1.5 text-[12px] font-semibold">
                {otherUnread > 99 ? "99+" : otherUnread}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenInfo}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 pr-2 text-left active:opacity-70"
            aria-label={`${chat.title}, open chat info`}
          >
            <Avatar
              kind={chat.kind}
              name={chat.title}
              src={chat.peer?.avatarUrl}
              seed={chat.peer?.id ?? chat.id}
              size={40}
              online={chat.kind === "direct" && isOnline(chat.peerLastActiveAt)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[16.5px] font-semibold text-chat-text">
                  {chat.title}
                </span>
                {chat.verified && <VerifiedBadge />}
                {chat.muted && <BellOff size={13} className="shrink-0 text-chat-faint" />}
              </span>
              <AnimatePresence mode="wait" initial={false}>
                {status && (
                  <motion.span
                    key={status}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.14 }}
                    className={`block truncate text-[12.5px] ${
                      typing || status === "online" ? "text-chat-accent" : "text-chat-muted"
                    }`}
                  >
                    {status}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </button>
          {chat.kind !== "support" && (
            <button
              type="button"
              onClick={() => onMenu("search")}
              aria-label="Search in chat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-chat-text active:bg-chat-text/10"
            >
              <Search size={21} />
            </button>
          )}
          <div className="relative" ref={wrapper}>
            <button
              type="button"
              aria-label="More options"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-chat-text active:bg-chat-text/10"
            >
              <MoreVertical size={21} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -4 }}
                  transition={{ duration: 0.14 }}
                  className={`absolute right-1 top-12 z-40 w-[228px] origin-top-right overflow-hidden rounded-[18px] text-[15px] text-chat-text ${GLASS_RIM}`}
                  style={glassFloating}
                >
                  {items.map(({ key, label, icon: Icon, danger }, index) => (
                    <button
                      key={key}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onMenu(key);
                      }}
                      className={`flex h-12 w-full items-center gap-3 px-4 text-left active:bg-chat-text/10 ${
                        index > 0 ? "border-t border-chat-border" : ""
                      } ${danger ? "text-chat-danger" : ""}`}
                    >
                      <Icon size={18} /> {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </header>
  );
}
