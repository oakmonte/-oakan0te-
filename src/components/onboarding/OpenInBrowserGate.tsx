import { useEffect, useState, type ReactNode } from "react";
import { androidChromeIntentUrl, isInAppBrowser } from "@/lib/in-app-browser";
import { isStandalone } from "@/lib/standalone";
import { isIOS } from "@/lib/platform";
import logoO from "@/assets/logo-o.png";

const PASS_KEY = "oak-in-app-gate-passed";

type Gate = { kind: "pass" } | { kind: "block"; chromeUrl: string | null; ios: boolean };

// Read in an effect, never a useState initialiser: the server has no
// navigator, so the first client render must match the server's "pass".
function readGate(): Gate {
  if (isStandalone() || !isInAppBrowser(navigator.userAgent)) return { kind: "pass" };
  try {
    if (sessionStorage.getItem(PASS_KEY) === "1") return { kind: "pass" };
  } catch {
    // Storage blocked: fall through and show the gate rather than skip it.
  }
  const android = /Android/.test(navigator.userAgent);
  return {
    kind: "block",
    chromeUrl: android ? androidChromeIntentUrl(window.location.href) : null,
    ios: isIOS(),
  };
}

/** Sits in front of every sign-in / sign-up screen. Inside an Instagram- or
 *  TikTok-style in-app webview, camera access is restricted and Google sign-in
 *  is refused outright, so an account started there strands the person midway.
 *  Instead of a banner they can dismiss and ignore, they get one full screen
 *  with a single way out. It always has an exit ("continue here anyway"):
 *  user-agent sniffing misfires, and a wrong guess must never lock someone out. */
export function OpenInBrowserGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>({ kind: "pass" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setGate(readGate());
  }, []);

  if (gate.kind === "pass") return <>{children}</>;

  const browser = gate.ios ? "Safari" : "Chrome";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard blocked in some webviews; the manual steps above still apply.
    }
  }

  function continueAnyway() {
    try {
      sessionStorage.setItem(PASS_KEY, "1");
    } catch {
      // Not persisted, but the in-memory state below still lets them through.
    }
    setGate({ kind: "pass" });
  }

  return (
    <div
      data-onboarding
      className="min-h-dvh bg-white text-[#0A0A0A] flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+24px)]"
    >
      <div className="flex items-baseline gap-0.5">
        <img src={logoO} alt="" className="h-9 w-auto translate-y-0.5" />
        <span className="text-lg tracking-tight leading-none">akmonte</span>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-sm w-full mx-auto">
        <h1 className="font-serif text-4xl leading-tight">Open in {browser}</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#0A0A0A]/70">
          This in-app view can&rsquo;t sign you in properly, and the camera and uploads won&rsquo;t
          work in it. Continue in {browser} and you&rsquo;ll pick up right where you are.
        </p>

        {gate.chromeUrl ? (
          <a
            href={gate.chromeUrl}
            className="mt-8 w-full rounded-full bg-[#2151F5] text-white py-4 text-sm font-medium uppercase tracking-widest active:scale-[0.98] transition-transform"
          >
            Open in Chrome
          </a>
        ) : (
          <ol className="mt-8 w-full text-left text-sm leading-relaxed flex flex-col gap-3 rounded-2xl border border-[#0A0A0A]/15 p-5">
            <li>
              <span className="font-medium">1.</span> Tap the{" "}
              <span className="font-medium">•••</span> or Share button at the top or bottom of this
              screen.
            </li>
            <li>
              <span className="font-medium">2.</span> Choose{" "}
              <span className="font-medium">Open in Browser</span> (or Open in Safari).
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={copyLink}
          className="mt-4 w-full rounded-full border border-[#0A0A0A]/20 py-3.5 text-sm font-medium active:scale-[0.98] transition-transform"
        >
          {copied ? "Link copied — paste it in your browser" : "Copy link"}
        </button>
      </main>

      <button
        type="button"
        onClick={continueAnyway}
        className="text-center text-[11px] uppercase tracking-widest text-[#0A0A0A]/50 underline underline-offset-2 py-2"
      >
        Continue here anyway
      </button>
    </div>
  );
}
