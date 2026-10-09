import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Link2,
  Loader2,
  Share,
  X,
  type LucideIcon,
} from "lucide-react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import {
  cancelOfflineSave,
  dismissOfflineSaveError,
  downloadFraction,
  formatBytes,
  startOfflineSave,
  useOfflineSave,
  type OfflinePostInput,
} from "@/lib/offline-videos";

/** The link a post is shared by.
 *
 *  There is no per-post route in the app yet (posts only exist inside the
 *  feed and the profile grid's viewer), so the link opens the AUTHOR'S
 *  PROFILE, where the post sits in their grid. The sheet says so under the
 *  row rather than letting someone believe they sent the post itself. Swap
 *  this for the post's own URL once one exists. */
function shareUrlFor(username: string | null): string | null {
  if (!username || typeof window === "undefined") return null;
  return new URL(`/profile/${encodeURIComponent(username)}`, window.location.origin).href;
}

/** The legacy copy path, for browsers without the async clipboard API (older
 *  iOS webviews, non-secure previews). Must run inside the tap's own call
 *  stack -- iOS refuses execCommand("copy") from anything async. */
function copyWithSelection(text: string): boolean {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  // Off-screen but still selectable; display:none can't be selected at all.
  el.style.position = "fixed";
  el.style.top = "-1000px";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.remove();
  return ok;
}

type CopyState = "idle" | "copied" | "manual";

/** The share plane's sheet: copy a link to the post, save it for offline
 *  viewing, and -- where the phone has one -- hand it to the system share
 *  sheet.
 *
 *  Portalled to <body> for the same reason CommentSheet is: it renders from
 *  inside the feed's transformed swipe-to-dismiss shell, and a transformed
 *  ancestor becomes the containing block for `position: fixed`.
 *
 *  Written in the chat-* tokens, so on /home and on profiles it follows the
 *  phone's light/dark setting like the rest of the social surface. */
export function PostShareSheet({
  open,
  onClose,
  post,
}: {
  open: boolean;
  onClose: () => void;
  post: OfflinePostInput;
}) {
  useOverlayHistory(open, onClose);
  useBodyScrollLock(open);
  const navigate = useNavigate();
  const save = useOfflineSave(post.postId);
  const [copy, setCopy] = useState<CopyState>("idle");
  const copyTimer = useRef<number | null>(null);
  const url = shareUrlFor(post.author.username);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Each opening starts clean: "Link copied" from last time is stale news.
  useEffect(() => {
    if (open) return;
    setCopy("idle");
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, [open]);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  function handleCopy() {
    if (!url) return;
    const done = () => {
      setCopy("copied");
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopy("idle"), 2200);
    };
    // The selection fallback runs first when there is no async clipboard,
    // while we are still inside the tap.
    if (!navigator.clipboard?.writeText) {
      if (copyWithSelection(url)) done();
      else setCopy("manual");
      return;
    }
    navigator.clipboard.writeText(url).then(done, () => {
      // Permission refused, or a webview that exposes the API but blocks it.
      // Show the link itself so it can still be copied by hand.
      setCopy("manual");
    });
  }

  async function handleNativeShare() {
    if (!url) return;
    try {
      await navigator.share({
        title: post.author.displayName ?? "Oakmonte",
        text: post.caption ?? undefined,
        url,
      });
      onClose();
    } catch {
      // Dismissing the system sheet rejects with AbortError; nothing to say.
    }
  }

  const copyRow =
    copy === "copied" ? (
      <Row icon={Check} label="Link copied" sub={profileNote(post.author.username)} />
    ) : (
      <Row
        icon={Link2}
        label="Copy link"
        sub={url ? profileNote(post.author.username) : "This account has no public link yet"}
        disabled={!url}
        onPress={handleCopy}
      />
    );

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="share-scrim"
          className="fixed inset-0 z-[90] flex items-end justify-center bg-chat-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Share post"
            className="relative w-full max-w-[560px] overflow-hidden rounded-t-[24px] bg-chat-bg text-chat-text shadow-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            onClick={(e) => e.stopPropagation()}
          >
            <DragHandle onDismiss={onClose} />
            <header className="relative flex items-center justify-center px-4 pb-3">
              <h2 className="text-[16px] font-semibold">Share</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-full text-chat-text active:scale-95"
              >
                <X size={20} />
              </button>
            </header>

            <div className="mx-4 overflow-hidden rounded-[18px] bg-chat-elevated">
              {copyRow}
              {copy === "manual" && url && (
                <div className="border-t border-chat-border px-4 py-3">
                  <p className="mb-2 text-[12px] text-chat-muted">
                    Copying isn&apos;t allowed here. Press and hold the link to copy it.
                  </p>
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    // 16px: anything smaller makes iOS zoom the page on focus.
                    className="h-10 w-full rounded-[10px] bg-chat-soft px-3 text-[16px] text-chat-text outline-none"
                  />
                </div>
              )}
              <div className="border-t border-chat-border">
                <OfflineRow
                  save={save}
                  onSave={() => {
                    dismissOfflineSaveError(post.postId);
                    startOfflineSave(post);
                  }}
                  onCancel={() => cancelOfflineSave(post.postId)}
                  onView={() => {
                    onClose();
                    void navigate({ to: "/offline-videos" });
                  }}
                />
              </div>
              {canNativeShare && url && (
                <div className="border-t border-chat-border">
                  <Row
                    icon={Share}
                    label="More options"
                    sub="Send with another app"
                    onPress={handleNativeShare}
                  />
                </div>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function profileNote(username: string | null): string {
  return username ? `Opens @${username}'s profile, where this post is` : "";
}

function OfflineRow({
  save,
  onSave,
  onCancel,
  onView,
}: {
  save: ReturnType<typeof useOfflineSave>;
  onSave: () => void;
  onCancel: () => void;
  onView: () => void;
}) {
  switch (save.status) {
    case "unsupported":
      return (
        <Row
          icon={Download}
          label="Save for offline"
          sub="This browser can't keep posts for offline viewing"
          disabled
        />
      );
    case "saving": {
      const fraction = downloadFraction(save.progress);
      const amount =
        fraction !== null
          ? `${Math.round(fraction * 100)}%`
          : save.progress.loaded > 0
            ? formatBytes(save.progress.loaded)
            : "";
      return (
        <Row
          icon={Loader2}
          iconClassName="animate-spin"
          label={amount ? `Saving… ${amount}` : "Saving…"}
          sub={
            <span
              className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-chat-soft"
              role="progressbar"
              aria-label="Saving for offline"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={fraction !== null ? Math.round(fraction * 100) : undefined}
            >
              {/* No total from the server: an honest indeterminate sliver
                  that pulses, rather than a bar that pretends to know. */}
              <span
                className={`block h-full rounded-full bg-chat-text transition-[width] duration-150 ${
                  fraction === null ? "w-1/4 animate-pulse" : ""
                }`}
                style={fraction !== null ? { width: `${Math.max(3, fraction * 100)}%` } : undefined}
              />
            </span>
          }
          trailing={
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel saving"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-chat-text/[0.07] text-chat-text active:scale-95"
            >
              <X size={18} />
            </button>
          }
        />
      );
    }
    case "saved":
      return (
        <Row
          icon={CheckCircle2}
          label="Saved offline"
          sub={`${formatBytes(save.entry.bytes)} · plays without a connection`}
          trailing={
            <button
              type="button"
              onClick={onView}
              className="h-10 rounded-full bg-chat-text px-4 text-[14px] font-semibold text-chat-inverse active:scale-95"
            >
              View
            </button>
          }
        />
      );
    case "error":
      return (
        <Row
          icon={AlertCircle}
          iconClassName="text-chat-danger"
          label="Couldn't save"
          sub={<span className="text-chat-danger">{save.error.message}</span>}
          trailing={
            save.error.code === "unsupported" ? undefined : (
              <button
                type="button"
                onClick={onSave}
                className="h-10 rounded-full bg-chat-text px-4 text-[14px] font-semibold text-chat-inverse active:scale-95"
              >
                Retry
              </button>
            )
          }
        />
      );
    default:
      return (
        <Row
          icon={Download}
          label="Save for offline"
          sub="Watch it later without a connection"
          onPress={onSave}
        />
      );
  }
}

/** One line of the action group. A button when it does something on its
 *  own; a plain row when its action is the trailing control (Cancel, View),
 *  so the two never nest one button inside another. */
function Row({
  icon: Icon,
  iconClassName = "",
  label,
  sub,
  onPress,
  disabled,
  trailing,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  sub?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      <Icon size={21} strokeWidth={1.9} className={`shrink-0 ${iconClassName}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] leading-tight">{label}</span>
        {sub && (
          <span className="mt-0.5 block text-[12.5px] leading-snug text-chat-muted">{sub}</span>
        )}
      </span>
      {trailing}
    </>
  );
  const rowClass = "flex min-h-[56px] w-full items-center gap-3.5 px-4 py-2.5 text-left";
  if (onPress && !trailing) {
    return (
      <button
        type="button"
        onClick={onPress}
        disabled={disabled}
        className={`${rowClass} active:bg-chat-text/[0.08] disabled:opacity-45`}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={`${rowClass} ${disabled ? "opacity-45" : ""}`} aria-disabled={disabled}>
      {body}
    </div>
  );
}

/** The grab bar: drag it down past a threshold (or flick) to dismiss. Same
 *  feel as the chat sheets (messages/Sheet.tsx). */
function DragHandle({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.9 }}
      dragSnapToOrigin
      onDragEnd={(_: unknown, info: PanInfo) => {
        if (info.offset.y > 70 || info.velocity.y > 500) onDismiss();
      }}
    >
      <span className="h-[5px] w-10 rounded-full bg-chat-text/25" />
    </motion.div>
  );
}
