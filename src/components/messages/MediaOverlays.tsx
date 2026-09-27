import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, Plus, SendHorizontal, Trash2, X } from "lucide-react";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { dayDividerLabel, clockTime } from "@/lib/messages-format";
import type { ChatMessage } from "@/lib/chat/model";
import { useMediaUrl } from "./use-media-url";

/* ---------- full-screen photo ---------- */

export function ImageViewer({
  message,
  author,
  onClose,
}: {
  message: ChatMessage | null;
  author: string;
  onClose: () => void;
}) {
  useOverlayHistory(!!message, onClose);
  const url = useMediaUrl(message?.mediaPath ?? null, message?.localUrl);

  const save = async () => {
    if (!url) return;
    try {
      const blob = await fetch(url).then((response) => response.blob());
      const file = new File([blob], `oakmonte-${message?.id.slice(0, 8)}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      // Phones: the share sheet is how a web page saves to Photos.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      /* share cancelled */
    }
  };

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="fixed inset-0 z-[90] flex flex-col bg-black text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex items-center gap-2 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+8px)]">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close photo"
              className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
            >
              <X size={24} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{author}</p>
              <p className="text-[12px] text-white/60">
                {dayDividerLabel(message.createdAt)
                  .toLowerCase()
                  .replace(/^./, (c) => c.toUpperCase())}{" "}
                · {clockTime(message.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void save()}
              aria-label="Save photo"
              className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
            >
              <Download size={22} />
            </button>
          </div>
          <motion.div
            className="flex min-h-0 flex-1 items-center justify-center"
            drag="y"
            dragSnapToOrigin
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.y) > 120 || Math.abs(info.velocity.y) > 700) onClose();
            }}
          >
            {url ? (
              <img
                src={url}
                alt={message.body ?? "Photo"}
                draggable={false}
                className="max-h-full max-w-full select-none object-contain"
              />
            ) : (
              <Loader2 size={30} className="animate-spin text-white/70" />
            )}
          </motion.div>
          {message.body && (
            <p className="max-h-[22dvh] overflow-y-auto whitespace-pre-wrap px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 text-center text-[15px]">
              {message.body}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- review picked photos before sending ---------- */

export function PhotoSendPreview({
  files,
  recipient,
  onCancel,
  onSend,
  onAddMore,
  onRemove,
}: {
  files: File[];
  recipient: string;
  onCancel: () => void;
  onSend: (caption: string) => void;
  onAddMore: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const open = files.length > 0;
  useOverlayHistory(open, onCancel);
  const [caption, setCaption] = useState("");
  const [index, setIndex] = useState(0);
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  useEffect(() => {
    if (index >= files.length) setIndex(Math.max(0, files.length - 1));
  }, [files.length, index]);
  useEffect(() => {
    if (!open) setCaption("");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex flex-col bg-black text-white"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
        >
          <div className="flex items-center justify-between px-2 pb-2 pt-[calc(env(safe-area-inset-top)+8px)]">
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel"
              className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
            >
              <X size={24} />
            </button>
            {files.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label="Remove this photo"
                className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
              >
                <Trash2 size={21} />
              </button>
            )}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            {urls[index] && (
              <img
                src={urls[index]}
                alt=""
                className="max-h-full max-w-full rounded-[6px] object-contain"
              />
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto px-3 pt-3 no-scrollbar">
            {urls.map((url, thumb) => (
              <button
                key={url}
                type="button"
                onClick={() => setIndex(thumb)}
                aria-label={`Photo ${thumb + 1}`}
                className={`h-14 w-14 shrink-0 overflow-hidden rounded-[10px] border-2 ${
                  thumb === index ? "border-white" : "border-transparent opacity-70"
                }`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            {files.length < 10 && (
              <label className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-white/30 text-white/80">
                <Plus size={22} />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  aria-label="Add more photos"
                  onChange={(event) => {
                    const picked = [...(event.target.files ?? [])].filter((file) =>
                      file.type.startsWith("image/"),
                    );
                    if (picked.length) onAddMore(picked);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
          <form
            className="flex items-end gap-2 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              onSend(caption);
            }}
          >
            <input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Add a caption…"
              aria-label="Caption"
              maxLength={1000}
              className="h-12 min-w-0 flex-1 rounded-full bg-white/12 px-4 text-[16px] text-white outline-none placeholder:text-white/50"
            />
            <button
              type="submit"
              aria-label={`Send to ${recipient}`}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-chat-accent text-white active:scale-95"
            >
              <SendHorizontal size={20} />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
