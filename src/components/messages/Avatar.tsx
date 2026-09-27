import { Bookmark } from "lucide-react";
import logoO from "@/assets/logo-o.png";
import type { ChatKind } from "@/lib/chat/model";

type Props = {
  kind: ChatKind;
  name: string;
  src?: string | null;
  /** Stable seed for the initials colour -- a user or conversation id. */
  seed?: string;
  size?: number;
  online?: boolean;
};

// Telegram-style: a person with no photo gets their initials on one of a few
// fixed hues picked from their id, so the same person is always the same
// colour and a list of photo-less people isn't a wall of grey.
const HUES = [
  ["#ff885e", "#ff516a"],
  ["#ffcd6a", "#ffa85c"],
  ["#82b1ff", "#665fff"],
  ["#a0de7e", "#54cb68"],
  ["#53edd6", "#28c9b7"],
  ["#72d5fd", "#2a9ef1"],
  ["#e0a2f3", "#d669ed"],
];

function hueFor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return HUES[Math.abs(hash) % HUES.length];
}

function initialsOf(name: string) {
  const words = name.replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function Avatar({ kind, name, src, seed, size = 54, online }: Props) {
  const [from, to] = hueFor(seed ?? name);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={
          kind === "support"
            ? { background: "#ffffff", boxShadow: "inset 0 0 0 1px var(--color-chat-border)" }
            : kind === "self"
              ? { background: "linear-gradient(160deg,#6aa9ff 0%,#2151f5 100%)" }
              : src
                ? { background: "var(--color-chat-soft)" }
                : { background: `linear-gradient(160deg,${from} 0%,${to} 100%)` }
        }
      >
        {kind === "support" ? (
          <img src={logoO} alt="" className="h-[62%] w-[62%] object-contain" />
        ) : kind === "self" ? (
          <Bookmark size={size * 0.42} strokeWidth={2} className="fill-white text-white" />
        ) : src ? (
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span
            className="font-semibold tracking-tight text-white"
            style={{ fontSize: Math.max(11, size * 0.36) }}
          >
            {initialsOf(name)}
          </span>
        )}
      </div>
      {online && (
        <span
          aria-label="Online"
          className="absolute bottom-[1px] right-[1px] rounded-full border-chat-bg bg-chat-online"
          style={{
            width: Math.max(10, size * 0.26),
            height: Math.max(10, size * 0.26),
            borderWidth: size > 40 ? 3 : 2,
          }}
        />
      )}
    </div>
  );
}
