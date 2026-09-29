import { memo, useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import {
  AlertCircle,
  Ban,
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  Forward,
  Loader2,
} from "lucide-react";
import { useLongPress } from "@/hooks/use-long-press";
import { clockTime, haptic } from "@/lib/messages-format";
import {
  describeMessage,
  isJumboEmoji,
  linkify,
  type ChatMessage,
  type ReactionSummary,
  type Tick,
} from "@/lib/chat/model";
import { useMediaUrl } from "./use-media-url";
import { VoiceNote } from "./VoiceNote";

/** Where a bubble sits in a run of same-sender messages: decides which
 *  corners are tight, like WhatsApp and iMessage. */
export type GroupPosition = "single" | "first" | "middle" | "last";

type Props = {
  message: ChatMessage;
  mine: boolean;
  position: GroupPosition;
  tick: Tick | null;
  reactions?: ReactionSummary[];
  quote?: { author: string; message: ChatMessage | null } | null;
  highlight?: string;
  flash?: boolean;
  canReply: boolean;
  onMenu: (message: ChatMessage, rect: DOMRect) => void;
  onReply: (message: ChatMessage) => void;
  onDoubleTap: (message: ChatMessage) => void;
  onQuoteTap: (id: string) => void;
  onImageTap: (message: ChatMessage) => void;
  onRetry: (message: ChatMessage) => void;
  onReactionsTap: (message: ChatMessage) => void;
  /** Multi-select mode: a tap anywhere on the row toggles it, and nothing
   *  inside the bubble (play, open photo, swipe to reply) reacts. */
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (message: ChatMessage) => void;
  /** The copy drawn in the long-press menu, on top of the original: no id,
   *  no long-press, double-tap or swipe -- but photos still open and voice
   *  notes still play. */
  lifted?: boolean;
};

const OUTGOING = "var(--chat-outgoing, linear-gradient(180deg,#ffffff 0%,#ece7e1 100%))";
// Incoming bubbles sit on the wallpaper, so they need their own step off it
// in both schemes (styles.css, "Social surface").
const INCOMING = "var(--chat-incoming, #1f2126)";

function corners(mine: boolean, position: GroupPosition) {
  const big = "20px";
  const small = "6px";
  const topNear = position === "middle" || position === "last" ? small : big;
  const bottomNear = position === "first" || position === "middle" ? small : big;
  const tail = position === "single" || position === "last" ? "4px" : bottomNear;
  return mine
    ? { borderRadius: `${big} ${topNear} ${tail} ${big}` }
    : { borderRadius: `${topNear} ${big} ${big} ${tail}` };
}

function TickIcon({ tick, readClass }: { tick: Tick; readClass: string }) {
  if (tick === "sending") return <Clock size={12} aria-label="Sending" />;
  if (tick === "failed") return null;
  if (tick === "sent") return <Check size={15} aria-label="Sent" />;
  return (
    <CheckCheck
      size={15}
      aria-label={tick === "read" ? "Read" : "Delivered"}
      className={tick === "read" ? readClass : ""}
    />
  );
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  const parts = linkify(text);
  return (
    <>
      {parts.map((part, index) =>
        part.href ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="break-all underline underline-offset-2"
          >
            {part.text}
          </a>
        ) : (
          <Marked key={index} text={part.text} query={query} />
        ),
      )}
    </>
  );
}

function Marked({ text, query }: { text: string; query?: string }) {
  const needle = query?.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const out: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let from = 0;
  let index = lower.indexOf(needle);
  while (index >= 0) {
    out.push(text.slice(from, index));
    out.push(
      <mark key={index} className="rounded-[3px] bg-[#ffd33d] px-[1px] text-black">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    from = index + needle.length;
    index = lower.indexOf(needle, from);
  }
  out.push(text.slice(from));
  return <>{out}</>;
}

function Stamp({
  message,
  tick,
  overlay,
  mine,
}: {
  message: ChatMessage;
  tick: Tick | null;
  overlay?: boolean;
  mine: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-[3px] whitespace-nowrap text-[11px] leading-none ${
        overlay
          ? "rounded-full bg-black/45 px-1.5 py-[3px] text-white"
          : mine
            ? "text-chat-inverse/60"
            : "text-chat-muted"
      }`}
    >
      {message.editedAt && !message.deletedAt && <span>edited</span>}
      {clockTime(message.createdAt)}
      {/* Only my messages get a tick. `mine` is false for the jumbo-emoji
          stamp too, which sits on an incoming-coloured pill, not my bubble. */}
      {tick && (
        <TickIcon
          tick={tick}
          readClass={overlay ? "text-[#53bdeb]" : mine ? "text-chat-tick-read" : "text-chat-accent"}
        />
      )}
    </span>
  );
}

function ImageContent({
  message,
  onTap,
  hasCaption,
}: {
  message: ChatMessage;
  onTap: () => void;
  hasCaption: boolean;
}) {
  const url = useMediaUrl(message.mediaPath, message.localUrl);
  const { width = 4, height = 5 } = message.meta;
  const ratio = Math.min(1.9, Math.max(0.55, width / height));
  const displayWidth = 252;
  const displayHeight = Math.round(displayWidth / ratio);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onTap();
      }}
      aria-label="Open photo"
      className={`relative block overflow-hidden bg-chat-text/10 ${hasCaption ? "rounded-t-[16px]" : "rounded-[16px]"}`}
      style={{ width: displayWidth, height: displayHeight }}
    >
      {url ? (
        <img
          src={url}
          alt={message.body ?? "Photo"}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="messages-skeleton absolute inset-0" />
      )}
      {message.status === "sending" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white">
            <Loader2 size={22} className="animate-spin" />
          </span>
        </span>
      )}
    </button>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  position,
  tick,
  reactions,
  quote,
  highlight,
  flash,
  canReply,
  onMenu,
  onReply,
  onDoubleTap,
  onQuoteTap,
  onImageTap,
  onRetry,
  onReactionsTap,
  selecting = false,
  selected = false,
  onToggleSelect,
  lifted = false,
}: Props) {
  const bubble = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const x = useMotionValue(0);
  const replyOpacity = useTransform(x, [0, 56], [0, 1]);
  const replyScale = useTransform(x, [0, 56], [0.5, 1]);

  const openMenu = () => {
    if (!bubble.current) return;
    onMenu(message, bubble.current.getBoundingClientRect());
  };

  const press = useLongPress(
    () => {
      haptic(12);
      openMenu();
    },
    {
      delay: 360,
      onTap: () => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          lastTap.current = 0;
          if (!message.deletedAt && !message.status) {
            haptic();
            onDoubleTap(message);
          }
          return;
        }
        lastTap.current = now;
      },
    },
  );

  const deleted = !!message.deletedAt;
  const jumbo =
    !deleted && message.kind === "text" && !message.replyToId && isJumboEmoji(message.body);
  const isImage = !deleted && message.kind === "image";
  const hasCaption = isImage && !!message.body;
  const failed = message.status === "failed";
  const bubbleStyle = jumbo
    ? undefined
    : {
        ...corners(mine, position),
        ...(mine ? (deleted ? {} : { background: OUTGOING }) : { background: INCOMING }),
      };

  const spacing = position === "single" || position === "first" ? "mt-2" : "mt-[2px]";

  return (
    <div
      id={lifted ? undefined : `message-${message.id}`}
      className={`relative flex flex-col ${mine ? "items-end" : "items-start"} ${spacing} ${
        selecting
          ? // The reaction pill hangs below the bubble; inside the row's
            // padding here so it sits on the selected tint, not past it.
            `-mx-3 pl-12 pr-3 pt-[2px] ${reactions?.length ? "pb-5" : "pb-[2px]"} ${
              selected ? "bg-chat-accent/15" : ""
            }`
          : reactions?.length
            ? "mb-4"
            : ""
      }`}
    >
      {selecting && (
        <>
          <span
            className={`absolute left-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 ${
              selected
                ? "border-chat-accent bg-chat-accent text-white"
                : "border-chat-text/35 text-transparent"
            }`}
            aria-hidden
          >
            <Check size={14} strokeWidth={3} />
          </span>
          <button
            type="button"
            onClick={() => onToggleSelect?.(message)}
            aria-pressed={selected}
            aria-label={`Select: ${describeMessage({ ...message, deleted: !!message.deletedAt })}`}
            className="absolute inset-0 z-20"
          />
        </>
      )}
      <div className="relative flex max-w-[82%] items-center gap-2">
        {canReply && !deleted && (
          <motion.span
            className="pointer-events-none absolute -left-9 flex h-7 w-7 items-center justify-center rounded-full bg-chat-text/10 text-chat-text"
            style={{ opacity: replyOpacity, scale: replyScale }}
            aria-hidden
          >
            <CornerUpLeft size={15} />
          </motion.span>
        )}
        {failed && mine && (
          <button
            type="button"
            onClick={() => onRetry(message)}
            aria-label="Message not sent. Tap for options"
            className="order-first flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-chat-danger active:scale-90"
          >
            <AlertCircle size={21} />
          </button>
        )}
        <motion.div
          drag={canReply && !lifted && !deleted && !message.status ? "x" : false}
          dragDirectionLock
          dragElastic={0.25}
          dragConstraints={{ left: 0, right: 72 }}
          dragSnapToOrigin
          style={{ x }}
          onDragEnd={(_, info) => {
            if (info.offset.x > 56) {
              haptic();
              onReply(message);
            }
          }}
          className="relative min-w-0 touch-pan-y"
        >
          <motion.div
            initial={message.status === "sending" ? { opacity: 0, y: 10, scale: 0.97 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
          >
            <div
              ref={bubble}
              data-bubble
              {...(lifted
                ? { onContextMenu: (event: React.MouseEvent) => event.preventDefault() }
                : {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": `${mine ? "You" : "Them"}: ${describeMessage({ ...message, deleted })}`,
                    onKeyDown: (event: React.KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openMenu();
                      }
                    },
                    onContextMenu: (event: React.MouseEvent) => {
                      event.preventDefault();
                      openMenu();
                    },
                    ...press,
                  })}
              className={`relative select-none transition-shadow ${
                jumbo
                  ? ""
                  : `${isImage ? "p-[3px]" : "px-3 py-[7px]"} ${
                      mine
                        ? deleted
                          ? "border border-chat-border text-chat-muted"
                          : "text-chat-inverse"
                        : "text-chat-text shadow-[0_1px_0.5px_rgba(0,0,0,0.08)]"
                    }`
              } ${flash ? "ring-2 ring-chat-accent ring-offset-2 ring-offset-transparent" : ""}`}
              style={{ ...bubbleStyle, WebkitTouchCallout: "none" }}
            >
              {message.forwarded && !deleted && (
                <p
                  className={`flex items-center gap-1 pb-0.5 text-[12px] italic ${
                    isImage ? "px-2 pt-1" : ""
                  } ${mine ? "text-chat-inverse/60" : "text-chat-muted"}`}
                >
                  <Forward size={12} /> Forwarded
                </p>
              )}

              {quote && !deleted && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (quote.message) onQuoteTap(quote.message.id);
                  }}
                  className={`mb-1 flex w-full min-w-[140px] overflow-hidden rounded-[10px] text-left ${
                    mine ? "bg-chat-inverse/10" : "bg-chat-text/[0.06]"
                  }`}
                >
                  <span className="w-[3px] shrink-0 bg-chat-accent" />
                  <span className="min-w-0 px-2 py-1.5">
                    <span
                      className={`block text-[12.5px] font-semibold ${
                        mine ? "text-chat-inverse" : "text-chat-accent"
                      }`}
                    >
                      {quote.author}
                    </span>
                    <span
                      className={`line-clamp-2 text-[13px] leading-snug ${
                        mine ? "text-chat-inverse/70" : "text-chat-muted"
                      }`}
                    >
                      {quote.message
                        ? describeMessage({ ...quote.message, deleted: !!quote.message.deletedAt })
                        : "Original message unavailable"}
                    </span>
                  </span>
                </button>
              )}

              {deleted ? (
                <p className="flex items-center gap-1.5 text-[14.5px] italic">
                  <Ban size={14} />
                  {mine ? "You deleted this message" : "This message was deleted"}
                  <span className="ml-1 inline-flex">
                    <Stamp message={message} tick={null} mine={false} />
                  </span>
                </p>
              ) : jumbo ? (
                <div className="flex flex-col items-end">
                  <p className="text-[46px] leading-[1.1]">{message.body}</p>
                  <span
                    className="mt-0.5 rounded-full px-2 py-[3px]"
                    style={{ background: INCOMING }}
                  >
                    <Stamp message={message} tick={tick} mine={false} />
                  </span>
                </div>
              ) : message.kind === "image" ? (
                <>
                  <div className="relative">
                    <ImageContent
                      message={message}
                      onTap={() => onImageTap(message)}
                      hasCaption={hasCaption}
                    />
                    {!hasCaption && (
                      <span className="absolute bottom-1.5 right-1.5">
                        <Stamp message={message} tick={tick} overlay mine={mine} />
                      </span>
                    )}
                  </div>
                  {hasCaption && (
                    <p className="max-w-[252px] whitespace-pre-wrap break-words px-2 pb-1 pt-1.5 text-[15px] leading-[1.35]">
                      <HighlightedText text={message.body ?? ""} query={highlight} />
                      <span className="inline-block w-[72px]" aria-hidden />
                      <span className="absolute bottom-[7px] right-2.5">
                        <Stamp message={message} tick={tick} mine={mine} />
                      </span>
                    </p>
                  )}
                </>
              ) : message.kind === "audio" ? (
                <div className="py-0.5">
                  <VoiceNote
                    message={message}
                    mine={mine}
                    stamp={<Stamp message={message} tick={tick} mine={mine} />}
                  />
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words text-[15.5px] leading-[1.35]">
                  <HighlightedText text={message.body ?? ""} query={highlight} />
                  {/* Reserves room on the last line so the stamp never sits on
                      top of text; the stamp itself is pinned bottom-right. */}
                  <span
                    className="inline-block"
                    style={{ width: message.editedAt ? 104 : mine ? 66 : 46 }}
                    aria-hidden
                  />
                  <span className="absolute bottom-[6px] right-3">
                    <Stamp message={message} tick={tick} mine={mine} />
                  </span>
                </p>
              )}
            </div>
          </motion.div>

          {reactions && reactions.length > 0 && (
            <button
              type="button"
              onClick={() => onReactionsTap(message)}
              onPointerDown={(event) => event.stopPropagation()}
              className={`absolute -bottom-[18px] ${mine ? "right-2" : "left-2"} flex items-center gap-0.5 rounded-full border-2 px-1.5 py-[2px] text-[14px] leading-none shadow-sm active:scale-95`}
              style={{ background: INCOMING, borderColor: "var(--chat-wallpaper, #0b0c0e)" }}
              aria-label={`Reactions: ${reactions.map((r) => `${r.emoji} ${r.count}`).join(", ")}`}
            >
              {reactions.slice(0, 3).map((reaction) => (
                <span key={reaction.emoji}>{reaction.emoji}</span>
              ))}
              {reactions.reduce((sum, reaction) => sum + reaction.count, 0) > 1 && (
                <span className="ml-0.5 text-[11.5px] font-semibold text-chat-muted">
                  {reactions.reduce((sum, reaction) => sum + reaction.count, 0)}
                </span>
              )}
            </button>
          )}
        </motion.div>
      </div>
      {failed && mine && (
        <button
          type="button"
          onClick={() => onRetry(message)}
          className="mt-1 px-1 text-[11.5px] font-medium text-chat-danger active:opacity-60"
        >
          Not sent · Tap to retry
        </button>
      )}
    </div>
  );
});
