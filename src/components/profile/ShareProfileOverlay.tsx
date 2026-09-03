import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Send, MessageCircle, MessageSquare, Check } from "lucide-react";

/** Full-screen "Share profile" view, opened by tapping the profile photo.
 *
 *  Only Copy link does anything — the rest are the share targets Diadem asked
 *  to be built out later, so they're laid out and labelled but inert. They're
 *  deliberately not hidden: the row's spacing is the thing being designed
 *  here, and a row that grows from two icons to six later would need
 *  relaying out anyway. */
const TARGETS: { key: string; label: string; bg: string; Icon: typeof Send }[] = [
  { key: "oakmonte", label: "Oakmonte\nfriends", bg: "#1e88ff", Icon: Send },
  { key: "whatsapp", label: "WhatsApp", bg: "#25d366", Icon: MessageCircle },
  { key: "sms", label: "SMS", bg: "#34c759", Icon: MessageSquare },
  { key: "telegram", label: "Telegram", bg: "#2aabee", Icon: Send },
];

export function ShareProfileOverlay({
  open,
  onClose,
  avatarUrl,
  shareUrl,
}: {
  open: boolean;
  onClose: () => void;
  avatarUrl: string | null;
  shareUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error("ShareProfileOverlay: clipboard write failed", err);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[95] flex flex-col bg-black text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute left-4 z-10 active:scale-90"
            style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
          >
            <X size={26} className="text-white" />
          </button>

          {/* The avatar is the whole point of this screen — big, centred,
              and circular so it reads as the thing being shared. */}
          <div className="flex flex-1 items-center justify-center px-10">
            <motion.div
              className="aspect-square w-full max-w-[300px] overflow-hidden rounded-full bg-white/10"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
            </motion.div>
          </div>

          <div
            className="px-2 pt-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
          >
            <p className="pb-5 text-center text-[15px] font-semibold">Share profile</p>
            <div
              className="flex gap-1 overflow-x-auto px-2"
              style={{ scrollbarWidth: "none" }}
              role="list"
            >
              <ShareTarget
                label={copied ? "Copied" : "Copy link"}
                bg="#3a7bff"
                Icon={copied ? Check : Link2}
                onClick={copyLink}
              />
              {TARGETS.map(({ key, label, bg, Icon }) => (
                <ShareTarget key={key} label={label} bg={bg} Icon={Icon} />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ShareTarget({
  label,
  bg,
  Icon,
  onClick,
}: {
  label: string;
  bg: string;
  Icon: typeof Send;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="listitem"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 disabled:opacity-100"
    >
      <span
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
        style={{ background: bg }}
      >
        <Icon size={24} className="text-white" />
      </span>
      <span className="whitespace-pre-line text-center text-[11px] leading-tight text-white/85">
        {label}
      </span>
    </button>
  );
}
