import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Check,
  ImageIcon,
  Keyboard,
  Mic,
  Pencil,
  Plus,
  Reply,
  SendHorizontal,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { haptic } from "@/lib/messages-format";
import { canRecordVoice, VoiceRecorder, type VoiceRecording } from "@/lib/chat/media";
import { formatDuration } from "@/lib/chat/model";
import { EmojiPicker } from "./EmojiPicker";
import { glassPanel } from "./glass";

export type ComposerContext =
  | { mode: "reply"; author: string; text: string }
  | { mode: "edit"; text: string }
  | null;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onPickImages?: (files: File[]) => void;
  onVoice?: (recording: VoiceRecording) => void;
  onTyping?: (active: boolean) => void;
  onError?: (message: string) => void;
  context: ComposerContext;
  onCancelContext: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Bumped by the parent to pull focus into the field (reply, edit). */
  focusKey?: number;
};

const LINE_HEIGHT = 21;
const MAX_LINES = 6;

export function Composer({
  value,
  onChange,
  onSend,
  onPickImages,
  onVoice,
  onTyping,
  onError,
  context,
  onCancelContext,
  placeholder = "Message",
  disabled,
  focusKey,
}: Props) {
  const field = useRef<HTMLTextAreaElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const attachWrapper = useRef<HTMLDivElement>(null);
  const [recorder, setRecorder] = useState<VoiceRecorder | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const hasText = value.trim().length > 0;
  const voiceAvailable = !!onVoice && canRecordVoice();

  /* ---------- auto-grow ---------- */
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, LINE_HEIGHT * MAX_LINES + 20)}px`;
  }, [value]);

  useEffect(() => {
    if (focusKey) {
      setEmojiOpen(false);
      field.current?.focus();
    }
  }, [focusKey]);

  /* ---------- typing signal ---------- */
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = (next: string) => {
    onChange(next);
    if (!onTyping) return;
    if (next.trim()) onTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 3000);
  };
  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    },
    [],
  );

  const send = () => {
    if (!hasText || disabled) return;
    haptic();
    onSend();
    onTyping?.(false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
  };

  /* ---------- voice ---------- */
  useEffect(() => {
    if (!recorder) return;
    const timer = setInterval(() => setElapsed(recorder.elapsed), 200);
    recorder.onLevel = (level) => setLevels((current) => [...current.slice(-31), level]);
    return () => clearInterval(timer);
  }, [recorder]);

  const startRecording = async () => {
    if (disabled) return;
    try {
      const started = await VoiceRecorder.start();
      haptic(15);
      setEmojiOpen(false);
      setElapsed(0);
      setLevels([]);
      setRecorder(started);
    } catch {
      onError?.("Allow microphone access to send voice messages");
    }
  };

  const finishRecording = async () => {
    if (!recorder) return;
    const recording = await recorder.stop();
    setRecorder(null);
    if (recording.duration < 0.8 || recording.blob.size === 0) {
      onError?.("Hold on a little longer to record");
      return;
    }
    haptic();
    onVoice?.(recording);
  };

  const cancelRecording = () => {
    recorder?.cancel();
    setRecorder(null);
    haptic();
  };

  useEffect(() => () => recorder?.cancel(), [recorder]);

  /* ---------- attachments ---------- */
  // A document listener rather than a full-screen backdrop: the composer's
  // backdrop-filter makes it the containing block for fixed children, so an
  // "inset-0" backdrop only ever covered the composer itself.
  useEffect(() => {
    if (!attachOpen) return;
    const close = (event: PointerEvent) => {
      if (!attachWrapper.current?.contains(event.target as Node)) setAttachOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [attachOpen]);

  const handleFiles = (list: FileList | null) => {
    const files = [...(list ?? [])].filter((file) => file.type.startsWith("image/"));
    if (files.length) onPickImages?.(files.slice(0, 10));
    setAttachOpen(false);
  };

  const insertEmoji = (emoji: string) => {
    const node = field.current;
    if (!node) {
      change(value + emoji);
      return;
    }
    const start = node.selectionStart ?? value.length;
    const end = node.selectionEnd ?? value.length;
    change(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      node.selectionStart = node.selectionEnd = start + emoji.length;
    });
  };

  return (
    <div
      className="relative z-30 shrink-0"
      style={{ ...glassPanel, boxShadow: "0 -1px 0 var(--color-chat-border)" }}
    >
      <AnimatePresence initial={false}>
        {context && (
          <motion.div
            key={context.mode}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 pt-2.5">
              <span className="text-chat-accent">
                {context.mode === "reply" ? <Reply size={20} /> : <Pencil size={18} />}
              </span>
              <div className="min-w-0 flex-1 border-l-[3px] border-chat-accent pl-2.5">
                <p className="text-[13px] font-semibold text-chat-accent">
                  {context.mode === "reply" ? `Reply to ${context.author}` : "Edit message"}
                </p>
                <p className="truncate text-[13.5px] text-chat-muted">{context.text}</p>
              </div>
              <button
                type="button"
                aria-label={context.mode === "reply" ? "Cancel reply" : "Cancel edit"}
                onClick={onCancelContext}
                className="flex h-10 w-10 items-center justify-center rounded-full text-chat-muted active:bg-chat-text/10"
              >
                <X size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {recorder ? (
        <div className="flex items-center gap-3 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
          <button
            type="button"
            onClick={cancelRecording}
            aria-label="Discard recording"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-chat-danger active:bg-chat-danger/10"
          >
            <Trash2 size={23} />
          </button>
          <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-chat-text/[0.07] px-4">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#ff3b30]" />
            <span className="w-11 shrink-0 text-[15px] tabular-nums text-chat-text">
              {formatDuration(elapsed)}
            </span>
            <span className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
              {levels.map((level, index) => (
                <span
                  key={index}
                  className="w-[3px] shrink-0 rounded-full bg-chat-accent"
                  style={{ height: `${Math.max(14, level * 100)}%` }}
                />
              ))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void finishRecording()}
            aria-label="Send voice message"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-chat-accent text-white active:scale-95"
          >
            <SendHorizontal size={21} />
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
          className="flex items-end gap-1.5 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2"
        >
          {onPickImages && context?.mode !== "edit" && (
            <div className="relative" ref={attachWrapper}>
              <button
                type="button"
                aria-label="Attach"
                aria-expanded={attachOpen}
                disabled={disabled}
                onClick={() => setAttachOpen((open) => !open)}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-chat-text transition-transform active:scale-90 disabled:opacity-40 ${
                  attachOpen ? "rotate-45" : ""
                }`}
              >
                <Plus size={28} strokeWidth={1.9} />
              </button>
              <AnimatePresence>
                {attachOpen && (
                  <>
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.16 }}
                      // Solid, not glass: it opens inside the composer's own
                      // backdrop-filter, and a nested backdrop-filter samples
                      // nothing, so glass here rendered as a see-through box.
                      className="absolute bottom-[52px] left-0 z-20 w-[210px] origin-bottom-left overflow-hidden rounded-[18px] border border-chat-border bg-chat-bg text-[15px] text-chat-text shadow-2xl"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => library.current?.click()}
                        className="flex h-12 w-full items-center gap-3 px-4 text-left active:bg-chat-text/10"
                      >
                        <ImageIcon size={20} className="text-[#2f80ff]" /> Photos
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => camera.current?.click()}
                        className="flex h-12 w-full items-center gap-3 border-t border-chat-border px-4 text-left active:bg-chat-text/10"
                      >
                        <Camera size={20} className="text-[#ff2d55]" /> Camera
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
              <input
                ref={library}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => {
                  handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={camera}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) => {
                  handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>
          )}

          <div className="flex min-h-12 min-w-0 flex-1 items-end rounded-[24px] border border-chat-border bg-chat-bg pl-3.5 pr-1">
            <textarea
              ref={field}
              rows={1}
              value={value}
              disabled={disabled}
              onChange={(event) => change(event.target.value)}
              onFocus={() => setEmojiOpen(false)}
              onKeyDown={(event) => {
                const desktop =
                  typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
                if (event.key === "Enter" && !event.shiftKey && desktop) {
                  event.preventDefault();
                  send();
                }
                if (event.key === "Escape" && context) onCancelContext();
              }}
              placeholder={placeholder}
              aria-label="Write a message"
              enterKeyHint="send"
              className="min-w-0 flex-1 resize-none bg-transparent py-3 text-[16px] leading-[21px] text-chat-text outline-none placeholder:text-chat-faint disabled:opacity-50"
            />
            <button
              type="button"
              aria-label={emojiOpen ? "Show keyboard" : "Emoji"}
              disabled={disabled}
              onClick={() => {
                if (emojiOpen) {
                  setEmojiOpen(false);
                  field.current?.focus();
                } else {
                  field.current?.blur();
                  setEmojiOpen(true);
                }
              }}
              className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-chat-muted active:scale-90 disabled:opacity-40"
            >
              {emojiOpen ? <Keyboard size={23} /> : <Smile size={23} />}
            </button>
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {hasText || !voiceAvailable || context?.mode === "edit" ? (
              <motion.button
                key="send"
                type="submit"
                aria-label={context?.mode === "edit" ? "Save edit" : "Send message"}
                disabled={!hasText || disabled}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 560, damping: 32 }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-chat-accent text-white transition-opacity disabled:opacity-40"
              >
                {context?.mode === "edit" ? <Check size={23} /> : <SendHorizontal size={21} />}
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                type="button"
                aria-label="Record voice message"
                disabled={disabled}
                onClick={() => void startRecording()}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 560, damping: 32 }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-chat-text active:scale-90 active:bg-chat-text/10 disabled:opacity-40"
              >
                <Mic size={25} />
              </motion.button>
            )}
          </AnimatePresence>
        </form>
      )}

      {emojiOpen && !recorder && (
        <div className="pb-[env(safe-area-inset-bottom)]">
          <EmojiPicker onPick={insertEmoji} />
        </div>
      )}
    </div>
  );
}
