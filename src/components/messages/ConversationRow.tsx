import { useRef } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { Archive, BellOff, Check, CheckCheck, MailOpen } from "lucide-react";
import type { Conversation } from "@/lib/messages-seed";
import { activeLabel, haptic, relativeShort } from "@/lib/messages-format";
import { ConversationAvatar } from "./ConversationAvatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { TypingDots } from "./TypingDots";

const ACTION_WIDTH = 152;

type Props = {
  conversation: Conversation;
  query: string;
  muted: boolean;
  onOpen: () => void;
  onToggleRead: () => void;
  onToggleMute: () => void;
  onArchive: () => void;
};

function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-[3px] bg-[#7596ff]/30 px-[1px] text-white">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

export function ConversationRow({
  conversation,
  query,
  muted,
  onOpen,
  onToggleRead,
  onToggleMute,
  onArchive,
}: Props) {
  const controls = useAnimationControls();
  const openRef = useRef(false);
  const unread = conversation.unread > 0;
  const presence = activeLabel(conversation.activeMinutesAgo);

  const settle = (to: number) => {
    openRef.current = to !== 0;
    void controls.start({ x: to, transition: { type: "spring", stiffness: 520, damping: 44 } });
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          type="button"
          aria-label={muted ? `Unmute ${conversation.name}` : `Mute ${conversation.name}`}
          onClick={() => {
            onToggleMute();
            settle(0);
          }}
          className="flex w-[76px] flex-col items-center justify-center gap-1 bg-[#3a3d44] text-[11px] font-semibold text-white active:bg-[#4a4e56]"
        >
          <BellOff size={19} />
          {muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          aria-label={`Archive ${conversation.name}`}
          onClick={() => {
            onArchive();
            settle(0);
          }}
          className="flex w-[76px] flex-col items-center justify-center gap-1 bg-[#7596ff] text-[11px] font-semibold text-black active:bg-[#8fa9ff]"
        >
          <Archive size={19} />
          Archive
        </button>
      </div>
      <div className="absolute inset-y-0 left-0 flex w-[110px] items-center gap-2 bg-[#2ee36a]/80 pl-5 text-[11px] font-semibold text-black">
        <MailOpen size={18} />
        {unread ? "Read" : "Unread"}
      </div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragElastic={0.18}
        dragConstraints={{ left: -ACTION_WIDTH, right: 110 }}
        animate={controls}
        onDragEnd={(_, info) => {
          if (info.offset.x > 70) {
            haptic();
            onToggleRead();
            settle(0);
          } else if (info.offset.x < -60) {
            haptic();
            settle(-ACTION_WIDTH);
          } else {
            settle(0);
          }
        }}
        className="relative bg-black"
      >
        <button
          type="button"
          onClick={() => {
            if (openRef.current) {
              settle(0);
              return;
            }
            onOpen();
          }}
          className="flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors active:bg-white/[0.07]"
        >
          <ConversationAvatar conversation={conversation} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p
                className={`truncate text-[16px] tracking-[-0.01em] ${unread ? "font-bold text-white" : "font-semibold text-white/95"}`}
              >
                {<Highlighted text={conversation.name} query={query} />}
              </p>
              {conversation.verified && <VerifiedBadge />}
              {muted && <BellOff size={13} className="shrink-0 text-white/40" />}
            </div>
            {conversation.typing ? (
              <p className="mt-[3px] flex h-[19px] items-center text-[#7596ff]">
                <TypingDots />
              </p>
            ) : (
              <p
                className={`mt-[3px] flex items-center gap-1 truncate text-[14px] ${unread ? "font-semibold text-white" : "text-white/50"}`}
              >
                {conversation.previewFromMe && (
                  <span className="shrink-0 text-white/45" aria-hidden>
                    {conversation.previewStatus === "sent" ? (
                      <Check size={13} />
                    ) : (
                      <CheckCheck
                        size={13}
                        className={conversation.previewStatus === "seen" ? "text-[#7596ff]" : ""}
                      />
                    )}
                  </span>
                )}
                <span className="truncate">
                  <Highlighted text={conversation.preview} query={query} />
                </span>
              </p>
            )}
            {presence && !conversation.typing && (
              <p className="mt-[2px] truncate text-[12px] text-white/35">{presence}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 pl-1">
            <span className="text-[12px] text-white/40">
              {relativeShort(conversation.last_message_at)}
            </span>
            {unread && <span className="h-[9px] w-[9px] rounded-full bg-[#3897f0]" />}
          </div>
        </button>
      </motion.div>
    </div>
  );
}
