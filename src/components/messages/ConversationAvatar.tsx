import { UserRound } from "lucide-react";
import logoO from "@/assets/logo-o.png";
import type { Conversation } from "@/lib/messages-seed";

type Props = {
  conversation: Conversation;
  size?: number;
};

export function ConversationAvatar({ conversation, size = 56 }: Props) {
  const ring = conversation.hasStory;
  const inner = size - (ring ? 6 : 0);

  return (
    <div
      className="relative shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        padding: ring ? 2.5 : 0,
        background: ring
          ? "linear-gradient(135deg,#f9ce34 0%,#ee2a7b 52%,#6228d7 100%)"
          : undefined,
      }}
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{
          background:
            conversation.kind === "support"
              ? "#ffffff"
              : "linear-gradient(160deg,#4a4d54 0%,#2b2e33 100%)",
          border: ring ? "2px solid var(--color-chat-bg)" : "none",
          // The support avatar is a white disc; on the light inbox it needs
          // an edge or it dissolves into the page.
          boxShadow:
            conversation.kind === "support"
              ? "inset 0 0 0 1px var(--color-chat-border)"
              : undefined,
          width: ring ? inner : size,
          height: ring ? inner : size,
        }}
      >
        {conversation.kind === "support" ? (
          <img src={logoO} alt="" className="h-[64%] w-[64%] object-contain" />
        ) : conversation.avatar ? (
          <img src={conversation.avatar} alt="" className="h-full w-full object-cover" />
        ) : conversation.kind === "store" ? (
          <span className="text-[13px] font-bold tracking-tight text-white/85">
            {conversation.initials}
          </span>
        ) : (
          <UserRound size={size * 0.42} strokeWidth={1.7} className="text-white/80" />
        )}
      </div>
      {conversation.activeMinutesAgo === 0 && conversation.kind !== "self" && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-[2.5px] border-chat-bg bg-chat-online"
          style={{ width: size * 0.24, height: size * 0.24 }}
        />
      )}
    </div>
  );
}
