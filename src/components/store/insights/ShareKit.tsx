import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, MessageCircle, Share2 } from "lucide-react";
import { encodeQr, qrToPngBlob } from "@/lib/qr-code";
import { storeLink, storeLinkLabel } from "@/lib/store-link";
import { QrCode } from "./QrCode";

/** Everything a seller needs to put their store in front of people: the link,
 *  big enough to read aloud; copy, WhatsApp and the native share sheet; and a
 *  QR code to scan off a screen or print on packaging. */
export function ShareKit({ username, brandName }: { username: string; brandName: string }) {
  const link = storeLink(username);
  const message = `Shop ${brandName} on Oakmonte: ${link}`;
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  // Feature-detected after mount, not during render, so the server-rendered
  // HTML and the first client render agree.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    return () => window.clearTimeout(copiedTimer.current);
  }, []);
  const matrix = useMemo(() => encodeQr(link, "M"), [link]);

  async function copy() {
    setNote(null);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (older in-app browsers, permissions).
      // The link is printed on screen, so say how to get it by hand.
      setNote("Couldn't copy here. Press and hold the link above to copy it.");
    }
  }

  async function share() {
    setNote(null);
    try {
      await navigator.share({ title: brandName, text: `Shop ${brandName} on Oakmonte`, url: link });
    } catch (err) {
      // Closing the share sheet rejects with AbortError: not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setNote("Couldn't open sharing. Copy the link instead.");
    }
  }

  async function saveQr() {
    setNote(null);
    const blob = await qrToPngBlob(matrix);
    if (!blob) {
      setNote("Couldn't make the image on this device.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${username}-oakmonte-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked a beat later: Safari starts the download asynchronously.
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const btn =
    "oak-tap flex h-11 items-center justify-center gap-2 rounded-full text-[14px] font-semibold oak-motion-control active:scale-[0.97]";

  return (
    <div className="rounded-3xl border-2 border-sd-line-strong bg-sd-hero-bg p-5">
      <p className="oak-eyebrow">Your store link</p>
      {/* select-all: one tap selects the whole link where copying is blocked. */}
      <p className="mt-3 select-all break-all text-[18px] font-semibold leading-snug tracking-[-0.01em] text-sd-ink">
        {storeLinkLabel(username)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void copy()} className={`${btn} bg-sd-ink text-sd-bg`}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className={`${btn} border border-sd-line bg-sd-surface text-sd-ink`}
        >
          <MessageCircle size={16} /> WhatsApp
        </a>
        {canShare && (
          <button
            type="button"
            onClick={() => void share()}
            className={`${btn} col-span-2 border border-sd-line bg-sd-surface text-sd-ink`}
          >
            <Share2 size={16} /> More ways to share
          </button>
        )}
      </div>
      <p aria-live="polite" className="mt-2 min-h-[18px] text-[12px] text-sd-ink-muted">
        {note ?? (copied ? "Link copied. Paste it into your status or bio." : "")}
      </p>

      <div className="mt-2 flex items-center gap-4 border-t border-sd-line pt-4">
        <QrCode value={link} size={120} label={`QR code for ${storeLinkLabel(username)}`} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-sd-ink">Scan to shop</p>
          <p className="mt-1 text-[13px] leading-relaxed text-sd-ink-muted">
            Print it on packaging, receipts or your stall.
          </p>
          <button
            type="button"
            onClick={() => void saveQr()}
            className="oak-tap mt-2 inline-flex h-10 items-center gap-1.5 text-[13px] font-semibold text-sd-accent-ink"
          >
            <Download size={15} /> Save QR image
          </button>
        </div>
      </div>
    </div>
  );
}
