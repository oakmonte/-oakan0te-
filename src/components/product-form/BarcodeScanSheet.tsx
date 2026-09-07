import { useEffect, useRef, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { type BarcodeType } from "@/lib/barcode-types";

// The Shape Detection API's native BarcodeDetector -- shipped in Chrome/Edge/
// Android -- decodes straight off the live <video> element with zero bundle
// cost. Safari and Firefox have never implemented it (checked against MDN/
// caniuse directly -- an earlier version of this comment claimed Safari 17
// shipped it, which is wrong), which used to mean every iPhone seller landed
// on a plain "not supported" message with no way to scan at all. Where the
// native constructor is missing, `start()` below dynamically imports the
// `barcode-detector` package instead -- a same-interface ponyfill backed by
// ZXing compiled to WebAssembly. That import (and the wasm binary it fetches
// on first use) only happens inside this effect, so it costs nothing on any
// other page, and costs nothing at all for the Chrome/Android sellers who
// already had a working native detector.
type DetectedBarcode = { rawValue: string; format: string };
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

async function getBarcodeDetectorCtor(): Promise<BarcodeDetectorCtor> {
  if (typeof window !== "undefined" && window.BarcodeDetector) return window.BarcodeDetector;
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return BarcodeDetector as unknown as BarcodeDetectorCtor;
}

const SCAN_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "codabar",
  "itf",
  "qr_code",
];

// EAN-13 is a superset of ISBN (a book's EAN-13 always starts 978/979), so a
// scanned ISBN barcode is only distinguishable from a plain EAN by prefix --
// GTIN and ASIN aren't real detectable symbologies, so those two are never
// auto-picked here, only offered as manual choices in BarcodesSheet.
function formatToBarcodeType(format: string, value: string): BarcodeType {
  if (format === "ean_13" && (value.startsWith("978") || value.startsWith("979"))) return "isbn";
  if (format === "ean_13" || format === "ean_8") return "ean";
  if (format === "upc_a" || format === "upc_e") return "upc";
  return "custom";
}

export function BarcodeScanSheet({
  onDetected,
  onClose,
}: {
  onDetected: (value: string, type: BarcodeType) => void;
  onClose: () => void;
}) {
  useLockedViewport();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let detected = false;
    let detector: BarcodeDetectorLike | null = null;

    async function loop() {
      if (cancelled || detected || !detector) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const results = await detector.detect(video);
          // Re-check after the await, not just before it -- Cancel can land
          // while a detect() call is still in flight, and without this a
          // decode that resolves a moment later would still fire onDetected
          // into a row the seller already backed out of.
          if (cancelled || detected) return;
          if (results.length > 0) {
            detected = true;
            const { rawValue, format } = results[0];
            onDetected(rawValue, formatToBarcodeType(format, rawValue));
            return;
          }
        } catch {
          // One failed decode attempt on a blurry/empty frame isn't fatal --
          // the loop just tries again on the next frame.
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    async function start() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        const [stream, DetectorCtor] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 1280 } },
          }),
          getBarcodeDetectorCtor(),
        ]);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        detector = new DetectorCtor({ formats: SCAN_FORMATS });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setError("");
        loop();
      } catch {
        if (!cancelled)
          setError(
            "Couldn't start the camera or scanner. Try again, or enter the code manually below.",
          );
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // onDetected excluded on purpose -- it's a fresh inline closure on every
    // parent render (BarcodesSheet re-renders on every keystroke in any
    // row), and including it would tear down and restart the camera stream
    // mid-scan for no reason. Only facing should ever restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col min-h-dvh animate-in fade-in duration-200">
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={onClose}
          type="button"
          className="text-white text-[15px] font-medium bg-white/15 rounded-full px-3.5 py-1.5 transition-transform duration-150 active:scale-95"
        >
          Cancel
        </button>
        <span className="text-white text-[15px] font-semibold">Scan barcode</span>
        <button
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          type="button"
          aria-label="Switch camera"
          className="p-2 rounded-full bg-white/15 transition-transform duration-150 active:scale-90"
        >
          <SwitchCamera size={16} className="text-white" />
        </button>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="flex-1 w-full h-full object-cover"
      />

      {/* Corner-bracket frame (not a full outline) -- reads as "a scanner",
          the same shape convention as a phone's own camera code-scanner,
          rather than as a generic cropped-video rectangle. The sweeping line
          is the actual "this is live and looking" cue. */}
      <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 aspect-[2/1] pointer-events-none">
        <span className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-2xl" />
        <span className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-2xl" />
        <span className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-2xl" />
        <span className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-2xl" />
        <div
          className="oak-scan-line absolute inset-x-2 h-[2px] rounded-full"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)",
            boxShadow: "0 0 8px 1px rgba(255,255,255,0.55)",
          }}
        />
      </div>
      {error && (
        <p className="absolute bottom-10 inset-x-6 text-center text-sm text-white/90">{error}</p>
      )}
    </div>
  );
}
