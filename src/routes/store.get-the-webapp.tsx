import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, MoreVertical, Share, Smartphone } from "lucide-react";
import { isIOS } from "@/lib/platform";
import { isStandalone } from "@/lib/standalone";
import { canPromptInstall, promptInstall, subscribeInstallPrompt } from "@/lib/installed-app";

// A plain public-directory path, deliberately not an `import`. An unresolved
// import of a missing asset fails `bun run build` -- which on Vercel is a failed
// deploy -- while typecheck, lint and test all stay green. A string path just
// 404s, and `onError` below hides the player, so the page still reads correctly
// until the explainer clip is dropped into /public.
const EXPLAINER_SRC = "/get-the-webapp.mp4";

export const Route = createFileRoute("/store/get-the-webapp")({
  validateSearch: (search: Record<string, unknown>): { checklist?: boolean } => ({
    checklist: search.checklist === true || search.checklist === "true" ? true : undefined,
  }),
  component: GetTheWebappPage,
});

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full bg-sd-ink text-sd-bg text-[11px] font-medium flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <span className="text-sm text-sd-ink leading-relaxed">{children}</span>
    </li>
  );
}

function GetTheWebappPage() {
  const navigate = useNavigate();
  const { checklist } = Route.useSearch();

  // Both read `navigator` / a media query, so both are set from an effect
  // rather than a useState initialiser -- see the note on isInstallablePhone.
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Chrome's offer can arrive after this page has already rendered, so the
  // button has to be subscribed to it rather than reading it once on mount.
  // The server snapshot is false: there is no such thing as an install prompt
  // during SSR, and claiming otherwise would swap the button out on hydration.
  const canInstall = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall, () => false);

  useEffect(() => {
    setIos(isIOS());
    setInstalled(isStandalone());
  }, []);

  async function handleInstall() {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      // Deliberately not navigating on "accepted". Android installs in the
      // background and leaves this tab exactly where it was; the stamp that
      // ticks this step lands when they open the installed app, not here.
      setInstalling(false);
    }
  }

  if (installed) {
    return (
      <div className="px-4 py-6">
        <div className="flex flex-col items-center text-center gap-3 border border-sd-line rounded-2xl p-8 animate-in fade-in duration-300">
          <div className="p-3 rounded-full bg-sd-ink">
            <Check size={20} className="text-sd-bg" />
          </div>
          <div>
            <p className="text-sm font-medium text-sd-ink">You&rsquo;re in the app</p>
            <p className="text-xs text-sd-ink-muted mt-0.5">
              This is where the rest of your Oakmonte runs. Carry on with the next step.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/store" })}
          className="mt-8 w-full bg-sd-ink text-sd-bg text-sm font-semibold rounded-full py-4 oak-motion-control active:scale-[0.98]"
        >
          Back to setup
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Get the webapp</h1>
      <p className="text-sm text-sd-ink-muted mb-6">
        Put Oakmonte on your home screen. Everything after this — your orders, your camera, your
        payouts — is faster from there, and the camera stops asking permission every single time.
      </p>

      {!videoFailed && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-sd-soft">
          <video
            src={EXPLAINER_SRC}
            className="w-full"
            autoPlay
            loop
            playsInline
            muted
            disablePictureInPicture
            disableRemotePlayback
            onError={() => setVideoFailed(true)}
          />
        </div>
      )}

      {canInstall && (
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="w-full flex items-center justify-center gap-2 bg-sd-ink text-sd-bg text-sm font-semibold rounded-full py-4 oak-motion-control active:scale-[0.98] disabled:opacity-60"
        >
          <Download size={16} />
          {installing ? "Opening…" : "Add Oakmonte to my home screen"}
        </button>
      )}

      {!canInstall && (
        <div className="border border-sd-line rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone size={16} className="text-sd-ink-muted" />
            <p className="text-sm font-medium text-sd-ink">
              {ios ? "On iPhone, in Safari" : "In your browser menu"}
            </p>
          </div>
          <ol className="flex flex-col gap-3">
            {ios ? (
              <>
                <Step n={1}>
                  Tap the <Share size={13} className="inline -mt-0.5 mx-0.5" /> share button at the
                  bottom of the screen.
                </Step>
                <Step n={2}>
                  Scroll down and tap <span className="font-medium">Add to Home Screen</span>.
                </Step>
                <Step n={3}>
                  Tap <span className="font-medium">Add</span>, then open Oakmonte from your home
                  screen.
                </Step>
              </>
            ) : (
              <>
                <Step n={1}>
                  Tap the <MoreVertical size={13} className="inline -mt-0.5 mx-0.5" /> menu in your
                  browser&rsquo;s toolbar.
                </Step>
                <Step n={2}>
                  Tap <span className="font-medium">Install app</span>, or{" "}
                  <span className="font-medium">Add to Home screen</span>.
                </Step>
                <Step n={3}>Open Oakmonte from your home screen.</Step>
              </>
            )}
          </ol>
        </div>
      )}

      <p className="text-xs text-sd-ink-muted mt-5 leading-relaxed">
        <span className="font-medium text-sd-ink">Then carry on from the app.</span>{" "}
        {ios
          ? "It starts you signed out the first time — that's normal. Sign in with Face ID and this step ticks itself."
          : "You'll already be signed in, and this step ticks itself."}
      </p>

      {checklist && (
        <button
          type="button"
          onClick={() => navigate({ to: "/store" })}
          className="mt-8 w-full border border-sd-line text-sd-ink text-sm font-medium rounded-full py-4 oak-motion-control active:scale-[0.98]"
        >
          Back to setup
        </button>
      )}
    </div>
  );
}
