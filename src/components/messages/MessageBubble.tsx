import { motion, useAnimationControls } from "framer-motion";
import { Check, CheckCheck, CornerUpLeft } from "lucide-react";
import { useLongPress } from "@/hooks/use-long-press";
import type { SeedMessage } from "@/lib/messages-seed";
import { clockTime, haptic } from "@/lib/messages-format";
import { ProductCard } from "./ProductCard";
import { OfferCard } from "./OfferCard";
import { OrderCard } from "./OrderCard";

type Props = {
  message: SeedMessage;
  mine: boolean;
  /** Last bubble of a same-sender group: gets the tail corner and the stamp. */
  lastOfGroup: boolean;
  reaction?: string;
  seenLabel?: string | null;
  sending?: boolean;
  onLongPress: () => void;
  onReply: () => void;
  onAddToCart: () => void;
};

/** Outgoing bubbles are a warm vertical gradient rather than flat white. */
const OUTGOING = "linear-gradient(180deg,#ffffff 0%,#ece7e1 100%)";

export function MessageBubble({
  message,
  mine,
  lastOfGroup,
  reaction,
  seenLabel,
  sending,
  onLongPress,
  onReply,
  onAddToCart,
}: Props) {
  const controls = useAnimationControls();
  const press = useLongPress(() => {
    haptic();
    onLongPress();
  });

  const isCard = message.kind !== "text";
  const tail = mine
    ? lastOfGroup
      ? "rounded-br-[8px]"
      : ""
    : lastOfGroup
      ? "rounded-bl-[8px]"
      : "";

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <div className="relative flex max-w-[78%] items-center">
        {!mine && (
          <span className="pointer-events-none absolute -left-7 text-chat-faint" aria-hidden>
            <CornerUpLeft size={14} />
          </span>
        )}
        <motion.div
          drag="x"
          dragDirectionLock
          dragElastic={0.2}
          dragConstraints={{ left: 0, right: 64 }}
          animate={controls}
          onDragEnd={(_, info) => {
            if (info.offset.x > 44) {
              haptic();
              onReply();
            }
            void controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 40 } });
          }}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate-presence-safe=""
          whileTap={{ scale: 0.985 }}
          className="relative touch-pan-y"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={`Message: ${message.body ?? message.kind}`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onLongPress();
                }
              }}
              {...press}
              className={`select-none ${isCard ? "" : `rounded-[22px] px-3.5 py-2.5 ${tail}`} ${
                isCard ? "" : mine ? "text-chat-inverse" : "bg-white/10 text-chat-text"
              } ${sending ? "opacity-60" : ""}`}
              style={isCard || !mine ? undefined : { background: OUTGOING }}
            >
              {message.reply_to_body && (
                <div
                  className={`mb-1.5 border-l-2 pl-2 text-[12px] ${
                    mine ? "border-black/30 text-black/55" : "border-white/35 text-chat-muted"
                  }`}
                >
                  <p className="font-semibold">{mine ? "You replied" : "Replied to you"}</p>
                  <p className="line-clamp-2">{message.reply_to_body}</p>
                </div>
              )}

              {message.kind === "text" && (
                <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.35]">
                  {message.body}
                </p>
              )}
              {message.kind === "product" && message.product && (
                <ProductCard product={message.product} onAdd={onAddToCart} />
              )}
              {message.kind === "offer" && <OfferCard message={message} />}
              {message.kind === "order" && <OrderCard message={message} />}
            </div>
          </motion.div>

          {reaction && (
            <span
              className={`absolute -bottom-2.5 ${
                mine ? "left-1" : "right-1"
              } rounded-full border border-chat-bg bg-chat-elevated px-1.5 py-[1px] text-[12px] leading-none`}
            >
              {reaction}
            </span>
          )}
        </motion.div>
      </div>

      {lastOfGroup && (
        <p
          className={`mt-1.5 flex items-center gap-1 px-1 text-[11px] text-chat-faint ${
            reaction ? "mt-3" : ""
          }`}
        >
          {clockTime(message.created_at)}
          {mine && !seenLabel && (
            <span aria-hidden>{sending ? <Check size={12} /> : <CheckCheck size={12} />}</span>
          )}
        </p>
      )}
      {seenLabel && <p className="px-1 text-[11px] text-chat-faint">{seenLabel}</p>}
    </div>
  );
}
