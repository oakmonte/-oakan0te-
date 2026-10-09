import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, MoreVertical, Play, Share, Smartphone } from "lucide-react";
import { isIOS } from "@/lib/platform";
import { isStandalone } from "@/lib/standalone";
import { canPromptInstall, promptInstall, subscribeInstallPrompt } from "@/lib/installed-app";
import iosExplainerSrc from "@/assets/webapp-screen-record/ios-add-to-home-screen.mp4";

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
  const [showVideo, setShowVideo] = useState(false);
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
              {ios ? "On iPhone or iPad" : "In your browser menu"}
            </p>
          </div>
          <ol className="flex flex-col gap-3">
            {ios ? (
              <>
                <Step n={1}>
                  Tap the <Share size={13} className="inline -mt-0.5 mx-0.5" /> share button at the
                  top or bottom of the screen.
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

      {/* Steps first, the clip on request -- same as /get-the-webapp. Only
          iPhone has a recording; drop the `ios` condition once Android's lands. */}
      {ios && !videoFailed && (
        <div className="mt-6">
          {showVideo ? (
            // iPhone 12 Pro Max recording, 1284x2778: the frame takes that exact
            // ratio and has no background, so its edge is the video's edge.
            <div className="mx-auto w-[min(100%,250px)] overflow-hidden rounded-[26px] animate-in fade-in duration-300">
              <video
                src={iosExplainerSrc}
                className="block aspect-[1284/2778] w-full object-cover"
                autoPlay
                loop
                playsInline
                muted
                disablePictureInPicture
                disableRemotePlayback
                onError={() => setVideoFailed(true)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowVideo(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-sd-line py-3.5 text-sm font-medium text-sd-ink oak-motion-control active:scale-[0.98]"
            >
              <Play size={14} />
              See Safari install video
            </button>
          )}
        </div>
      )}

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
