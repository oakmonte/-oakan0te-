import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  Ban,
  Bell,
  BellOff,
  Check,
  Eraser,
  Loader2,
  Mail,
  MailOpen,
  Pin,
  PinOff,
  Search,
  SendHorizontal,
  ShieldAlert,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import * as api from "@/lib/chat/api";
import { isOnline, isUnread, presenceLabel, type Chat, type ChatMessage } from "@/lib/chat/model";
import { Avatar } from "./Avatar";
import { ActionList, Sheet, type ActionItem } from "./Sheet";
import { VerifiedBadge } from "./VerifiedBadge";
import { useMediaUrl } from "./use-media-url";

function SearchField({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="mx-4 flex h-11 items-center gap-2 rounded-[12px] bg-chat-soft px-3 text-chat-muted">
      <Search size={18} />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
        className="min-w-0 flex-1 bg-transparent text-[16px] text-chat-text outline-none placeholder:text-chat-muted"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => onChange("")}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-chat-text/15 text-chat-bg"
        >
          <X size={14} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

function PersonRow({
  name,
  subtitle,
  avatar,
  kind = "direct",
  seed,
  online,
  onSelect,
  trailing,
}: {
  name: string;
  subtitle?: string | null;
  avatar?: string | null;
  kind?: Chat["kind"];
  seed?: string;
  online?: boolean;
  onSelect: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-4 py-2 text-left active:bg-chat-text/[0.06]"
    >
      <Avatar kind={kind} name={name} src={avatar} seed={seed} size={46} online={online} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-chat-text">{name}</span>
        {subtitle && (
          <span className="block truncate text-[13.5px] text-chat-muted">{subtitle}</span>
        )}
      </span>
      {trailing}
    </button>
  );
}

/* ---------- new chat ---------- */

export function NewChatSheet({
  open,
  me,
  chats,
  onClose,
  onOpenChat,
  onStartWith,
}: {
  open: boolean;
  me: string | null;
  chats: Chat[];
  onClose: () => void;
  onOpenChat: (chat: Chat) => void;
  onStartWith: (person: api.PersonResult) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<api.PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.replace(/^@/, "").length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      api
        .searchPeople(needle, me)
        .then((found) => {
          setResults(found);
          setError(null);
        })
        .catch((reason: Error) => setError(reason.message))
        .finally(() => setSearching(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [query, me]);

  const self = chats.find((chat) => chat.kind === "self");
  const recent = chats.filter((chat) => chat.kind === "direct").slice(0, 12);

  return (
    <Sheet open={open} onClose={onClose} title="New message" tall>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search name or @username"
        autoFocus
      />
      {query.trim().length >= 2 ? (
        <div className="pt-2">
          {searching && results.length === 0 && (
            <p className="flex items-center justify-center gap-2 py-8 text-[14px] text-chat-muted">
              <Loader2 size={16} className="animate-spin" /> Searching
            </p>
          )}
          {error && <p className="px-6 py-8 text-center text-[14px] text-chat-danger">{error}</p>}
          {!searching && !error && results.length === 0 && (
            <p className="px-6 py-10 text-center text-[14px] text-chat-muted">
              No one matches “{query.trim()}”.
            </p>
          )}
          {results.map((person) => (
            <PersonRow
              key={person.id}
              name={person.displayName?.trim() || person.username}
              subtitle={`@${person.username}`}
              avatar={person.avatarUrl}
              seed={person.id}
              onSelect={() => {
                setStarting(person.id);
                void onStartWith(person).finally(() => setStarting(null));
              }}
              trailing={
                starting === person.id ? (
                  <Loader2 size={18} className="animate-spin text-chat-muted" />
                ) : null
              }
            />
          ))}
        </div>
      ) : (
        <div className="pt-3">
          {self && (
            <PersonRow
              name="Message yourself"
              subtitle="Notes, links and saved looks"
              kind="self"
              onSelect={() => onOpenChat(self)}
            />
          )}
          {recent.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-4 text-[13px] font-semibold uppercase tracking-wide text-chat-muted">
                Recent
              </p>
              {recent.map((chat) => (
                <PersonRow
                  key={chat.id}
                  name={chat.title}
                  subtitle={chat.handle ? `@${chat.handle}` : null}
                  avatar={chat.peer?.avatarUrl}
                  seed={chat.peer?.id}
                  online={isOnline(chat.peerLastActiveAt)}
                  onSelect={() => onOpenChat(chat)}
                />
              ))}
            </>
          )}
          <p className="px-8 pb-4 pt-6 text-center text-[13px] text-chat-muted">
            Find anyone on Oakmonte by their name or @username.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- inbox row long-press ---------- */

export function ChatActionsSheet({
  chat,
  onClose,
  onTogglePin,
  onToggleMute,
  onToggleRead,
  onToggleArchive,
  onDelete,
}: {
  chat: Chat | null;
  onClose: () => void;
  onTogglePin: (chat: Chat) => void;
  onToggleMute: (chat: Chat) => void;
  onToggleRead: (chat: Chat) => void;
  onToggleArchive: (chat: Chat) => void;
  onDelete: (chat: Chat) => void;
}) {
  const items: ActionItem[] = chat
    ? [
        {
          key: "pin",
          label: chat.pinnedAt ? "Unpin" : "Pin",
          icon: chat.pinnedAt ? PinOff : Pin,
          onSelect: () => onTogglePin(chat),
          hidden: chat.kind === "self",
        },
        {
          key: "read",
          label: isUnread(chat) ? "Mark as read" : "Mark as unread",
          icon: isUnread(chat) ? MailOpen : Mail,
          onSelect: () => onToggleRead(chat),
          hidden: chat.kind === "support",
        },
        {
          key: "mute",
          label: chat.muted ? "Unmute" : "Mute",
          icon: chat.muted ? Bell : BellOff,
          onSelect: () => onToggleMute(chat),
          hidden: chat.kind === "support",
        },
        {
          key: "archive",
          label: chat.archivedAt ? "Unarchive" : "Archive",
          icon: chat.archivedAt ? ArchiveRestore : Archive,
          onSelect: () => onToggleArchive(chat),
          hidden: chat.kind === "support",
        },
        {
          key: "delete",
          label: chat.kind === "self" ? "Clear notes" : "Delete chat",
          icon: Trash2,
          danger: true,
          onSelect: () => onDelete(chat),
          hidden: chat.kind === "support",
        },
      ]
    : [];

  return (
    <Sheet open={!!chat} onClose={onClose}>
      {chat && (
        <>
          <div className="flex items-center gap-3 px-5 pb-4 pt-1">
            <Avatar
              kind={chat.kind}
              name={chat.title}
              src={chat.peer?.avatarUrl}
              seed={chat.peer?.id ?? chat.id}
              size={48}
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[17px] font-semibold">
                {chat.title} {chat.verified && <VerifiedBadge />}
              </p>
              {chat.handle && <p className="text-[13.5px] text-chat-muted">@{chat.handle}</p>}
            </div>
          </div>
          {chat.kind === "support" ? (
            <p className="px-6 pb-4 text-center text-[14px] text-chat-muted">
              Oakmonte Support is always kept at the top of your inbox.
            </p>
          ) : (
            <ActionList items={items} />
          )}
        </>
      )}
    </Sheet>
  );
}

/* ---------- forward ---------- */

export function ForwardSheet({
  message,
  chats,
  onClose,
  onForward,
}: {
  message: ChatMessage | null;
  chats: Chat[];
  onClose: () => void;
  onForward: (targets: Chat[]) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!message) {
      setQuery("");
      setPicked([]);
      setSending(false);
    }
  }, [message]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return chats
      .filter((chat) => chat.kind !== "support" && !chat.blockedByMe)
      .filter(
        (chat) =>
          !needle ||
          chat.title.toLowerCase().includes(needle) ||
          (chat.handle ?? "").toLowerCase().includes(needle),
      );
  }, [chats, query]);

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 5),
    );

  return (
    <Sheet
      open={!!message}
      onClose={onClose}
      title="Forward to…"
      tall
      action={
        <button
          type="button"
          disabled={picked.length === 0 || sending}
          onClick={() => {
            setSending(true);
            void onForward(chats.filter((chat) => picked.includes(chat.id))).finally(() =>
              setSending(false),
            );
          }}
          aria-label="Send"
          className="flex h-10 items-center gap-1.5 rounded-full bg-chat-accent px-3.5 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
          {picked.length > 0 ? picked.length : ""}
        </button>
      }
    >
      <SearchField value={query} onChange={setQuery} placeholder="Search chats" />
      <div className="pt-2">
        {candidates.length === 0 && (
          <p className="px-6 py-10 text-center text-[14px] text-chat-muted">
            No chats to forward to.
          </p>
        )}
        {candidates.map((chat) => {
          const selected = picked.includes(chat.id);
          return (
            <PersonRow
              key={chat.id}
              name={chat.kind === "self" ? "Me (notes)" : chat.title}
              subtitle={chat.handle ? `@${chat.handle}` : null}
              avatar={chat.peer?.avatarUrl}
              kind={chat.kind}
              seed={chat.peer?.id ?? chat.id}
              onSelect={() => toggle(chat.id)}
              trailing={
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-chat-accent bg-chat-accent text-white"
                      : "border-chat-text/30 text-transparent"
                  }`}
                  aria-hidden
                >
                  <Check size={14} strokeWidth={3} />
                </span>
              }
            />
          );
        })}
      </div>
    </Sheet>
  );
}

/* ---------- report ---------- */

const REPORT_REASONS = [
  "Spam or scam",
  "Harassment or bullying",
  "Fake or counterfeit goods",
  "Hate speech",
  "Nudity or sexual content",
  "Selling prohibited items",
  "Something else",
];

export function ReportSheet({
  target,
  onClose,
  onSubmit,
}: {
  target: { chat: Chat; message: ChatMessage | null } | null;
  onClose: () => void;
  onSubmit: (reason: string, alsoBlock: boolean) => Promise<void>;
}) {
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setAlsoBlock(false);
      setSending(null);
    }
  }, [target]);

  return (
    <Sheet
      open={!!target}
      onClose={onClose}
      title={target?.message ? "Report message" : `Report ${target?.chat.title ?? ""}`}
    >
      <p className="px-6 pb-3 text-center text-[13.5px] text-chat-muted">
        {target?.message
          ? "The message is sent to Oakmonte for review. They won't know it was you."
          : "The most recent messages are reviewed by Oakmonte. They won't know it was you."}
      </p>
      <div className="mx-4 overflow-hidden rounded-[18px] bg-chat-elevated">
        {REPORT_REASONS.map((reason, index) => (
          <button
            key={reason}
            type="button"
            disabled={!!sending}
            onClick={() => {
              setSending(reason);
              void onSubmit(reason, alsoBlock).finally(() => setSending(null));
            }}
            className={`flex h-[50px] w-full items-center justify-between px-4 text-left text-[16px] text-chat-text active:bg-chat-text/[0.08] ${
              index > 0 ? "border-t border-chat-border" : ""
            }`}
          >
            {reason}
            {sending === reason && <Loader2 size={17} className="animate-spin text-chat-muted" />}
          </button>
        ))}
      </div>
      {target?.chat.kind === "direct" && !target.chat.blockedByMe && (
        <label className="mx-4 mt-3 flex h-[52px] items-center justify-between rounded-[18px] bg-chat-elevated px-4 text-[16px] text-chat-text">
          Also block {target.chat.title}
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(event) => setAlsoBlock(event.target.checked)}
            className="h-5 w-5 accent-[var(--color-chat-accent)]"
          />
        </label>
      )}
    </Sheet>
  );
}

/* ---------- contact info ---------- */

function MediaThumb({ message, onOpen }: { message: ChatMessage; onOpen: () => void }) {
  const url = useMediaUrl(message.mediaPath, message.localUrl);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open photo"
      className="aspect-square overflow-hidden bg-chat-soft"
    >
      {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </button>
  );
}

export function ContactInfoSheet({
  chat,
  open,
  media,
  onClose,
  onSearch,
  onToggleMute,
  onOpenMedia,
  onClear,
  onToggleBlock,
  onReport,
  onDelete,
}: {
  chat: Chat;
  open: boolean;
  media: ChatMessage[];
  onClose: () => void;
  onSearch: () => void;
  onToggleMute: () => void;
  onOpenMedia: (message: ChatMessage) => void;
  onClear: () => void;
  onToggleBlock: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  const presence =
    chat.kind === "direct"
      ? chat.blockedByMe
        ? "Blocked"
        : presenceLabel(chat.peerLastActiveAt)
      : chat.kind === "support"
        ? "Replies within a day"
        : "Only you can see this chat";

  const quick = [
    chat.peer?.username
      ? {
          key: "profile",
          label: "Profile",
          icon: UserRound,
          node: (
            <Link
              to="/profile/$username"
              params={{ username: chat.peer.username }}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-[16px] bg-chat-elevated py-3 text-[13px] font-medium text-chat-text active:bg-chat-soft"
            >
              <UserRound size={21} className="text-chat-accent" />
              Profile
            </Link>
          ),
        }
      : null,
    chat.kind !== "support"
      ? { key: "search", label: "Search", icon: Search, onSelect: onSearch }
      : null,
    chat.kind !== "support"
      ? {
          key: "mute",
          label: chat.muted ? "Unmute" : "Mute",
          icon: chat.muted ? Bell : BellOff,
          onSelect: onToggleMute,
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    label: string;
    icon: typeof Search;
    onSelect?: () => void;
    node?: React.ReactNode;
  }[];

  const actions: ActionItem[] = [
    {
      key: "clear",
      label: "Clear chat",
      icon: Eraser,
      onSelect: onClear,
      hidden: chat.kind === "support",
    },
    {
      key: "block",
      label: chat.blockedByMe ? `Unblock ${chat.title}` : `Block ${chat.title}`,
      icon: Ban,
      danger: !chat.blockedByMe,
      onSelect: onToggleBlock,
      hidden: chat.kind !== "direct",
    },
    {
      key: "report",
      label: `Report ${chat.title}`,
      icon: ShieldAlert,
      danger: true,
      onSelect: onReport,
      hidden: chat.kind !== "direct",
    },
    {
      key: "delete",
      label: "Delete chat",
      icon: Trash2,
      danger: true,
      onSelect: onDelete,
      hidden: chat.kind !== "direct",
    },
  ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={chat.kind === "direct" ? "Contact info" : "Chat info"}
    >
      <div className="flex flex-col items-center px-6 pb-5 text-center">
        <Avatar
          kind={chat.kind}
          name={chat.title}
          src={chat.peer?.avatarUrl}
          seed={chat.peer?.id ?? chat.id}
          size={96}
          online={chat.kind === "direct" && isOnline(chat.peerLastActiveAt)}
        />
        <p className="mt-3 flex items-center gap-1.5 text-[22px] font-bold">
          {chat.title} {chat.verified && <VerifiedBadge size={18} />}
        </p>
        {chat.handle && <p className="text-[15px] text-chat-muted">@{chat.handle}</p>}
        {presence && <p className="mt-1 text-[13px] text-chat-muted">{presence}</p>}
      </div>

      {quick.length > 0 && (
        <div className="flex gap-2.5 px-4 pb-5">
          {quick.map((item) =>
            item.node ? (
              <div key={item.key} className="flex flex-1">
                {item.node}
              </div>
            ) : (
              <button
                key={item.key}
                type="button"
                onClick={item.onSelect}
                className="flex flex-1 flex-col items-center gap-1.5 rounded-[16px] bg-chat-elevated py-3 text-[13px] font-medium text-chat-text active:bg-chat-soft"
              >
                <item.icon size={21} className="text-chat-accent" />
                {item.label}
              </button>
            ),
          )}
        </div>
      )}

      {chat.kind !== "support" && (
        <section className="pb-5">
          <p className="px-5 pb-2 text-[13px] font-semibold uppercase tracking-wide text-chat-muted">
            Photos {media.length > 0 ? `· ${media.length}` : ""}
          </p>
          {media.length === 0 ? (
            <p className="mx-4 rounded-[16px] bg-chat-elevated px-4 py-5 text-center text-[14px] text-chat-muted">
              Photos you share in this chat show up here.
            </p>
          ) : (
            <div className="mx-4 grid grid-cols-3 gap-[3px] overflow-hidden rounded-[16px]">
              {media
                .slice()
                .reverse()
                .slice(0, 30)
                .map((message) => (
                  <MediaThumb
                    key={message.id}
                    message={message}
                    onOpen={() => onOpenMedia(message)}
                  />
                ))}
            </div>
          )}
        </section>
      )}

      {chat.kind === "support" ? (
        <p className="px-8 pb-6 text-center text-[14px] text-chat-muted">
          Tell us about an order, a seller, a payout or anything that isn't working. A real person
          on the Oakmonte team replies here.
        </p>
      ) : (
        <ActionList items={actions} />
      )}
    </Sheet>
  );
}
