import { useEffect, useRef, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { type BarcodeType } from "@/lib/barcode-types";

// The Shape Detection API's BarcodeDetector -- shipped in Chrome/Android and
// in Safari/iOS since 17 -- lets us decode straight from the live <video>
// element with no scanning library or extra bundle weight. Where it isn't
// available (older WebKit, most non-Chromium desktop browsers) this sheet
// falls back to a plain "not supported, type it in" message rather than
// pretending to scan.
type DetectedBarcode = { rawValue: string; format: string };
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
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
  const [supported] = useState(
    () => typeof window !== "undefined" && typeof window.BarcodeDetector !== "undefined",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported || !window.BarcodeDetector) return;
    let cancelled = false;
    let rafId = 0;
    let detected = false;
    const detector = new window.BarcodeDetector({ formats: SCAN_FORMATS });

    async function loop() {
      if (cancelled || detected) return;
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setError("");
        loop();
      } catch {
        if (!cancelled) setError("Camera access was denied or isn't available.");
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
    // mid-scan for no reason. Only facing/supported should ever restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, supported]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col min-h-dvh animate-in fade-in duration-200">
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 pt-4 pb-3">
        <button
          onClick={onClose}
          type="button"
          className="text-white text-[15px] font-medium bg-white/15 rounded-full px-3.5 py-1.5"
        >
          Cancel
        </button>
        <span className="text-white text-[15px] font-semibold">Scan barcode</span>
        <button
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          type="button"
          aria-label="Switch camera"
          className="p-2 rounded-full bg-white/15"
        >
          <SwitchCamera size={16} className="text-white" />
        </button>
      </div>

      {supported ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 w-full h-full object-cover"
          />
          <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 aspect-[16/9] border-2 border-white/70 rounded-2xl pointer-events-none" />
          {error && (
            <p className="absolute bottom-10 inset-x-6 text-center text-sm text-white/90">
              {error}
            </p>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center px-8">
          <p className="text-center text-sm text-white/80">
            Barcode scanning isn't supported on this browser — enter the code manually instead.
          </p>
        </div>
      )}
    </div>
  );
}
