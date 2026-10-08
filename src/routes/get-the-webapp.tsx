import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, MoreVertical, Play, Share, Smartphone } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { OpenInBrowserGate } from "@/components/onboarding/OpenInBrowserGate";
import { OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { useBack } from "@/hooks/use-back";
import { isIOS, isInstallablePhone } from "@/lib/platform";
import { isStandalone } from "@/lib/standalone";
import { canPromptInstall, promptInstall, subscribeInstallPrompt } from "@/lib/installed-app";
import iosExplainerSrc from "@/assets/webapp-screen-record/ios-add-to-home-screen.mp4";

// The seller dashboard has its own copy of this screen (store.get-the-webapp.tsx),
// dressed in the dashboard's light/dark tokens. This one is for creators and
// curators, who never see /store, so it uses the same fixed light styling as
// the rest of onboarding. The install mechanics are shared through
// installed-app.ts; only the surface and the copy differ.

// Android's clip doesn't exist yet -- a plain public-directory path, not an
// import: an unresolved import of a missing asset fails the production build,
// while a string path just 404s and `onError` below hides the player.
const ANDROID_EXPLAINER_SRC = "/get-the-webapp.mp4";

type Intent = "creator" | "curator";

const COPY: Record<Intent | "default", { lead: string }> = {
  creator: {
    lead: "Put Oakmonte on your home screen. Posting, editing and sharing are faster from there, and the camera stops asking permission every single time.",
  },
  curator: {
    lead: "Put Oakmonte on your home screen. Browsing, curating and following are faster from there, and everything opens like a real app.",
  },
  default: {
    lead: "Put Oakmonte on your home screen. Everything is faster from there, and the camera stops asking permission every single time.",
  },
};

export const Route = createFileRoute("/get-the-webapp")({
  head: () => ({
    // White page, so the iOS status strip must be white too -- the root default
    // is #000000 and would otherwise paint a black band above it.
    meta: [{ title: "Get the app — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  validateSearch: (search: Record<string, unknown>): { intent?: Intent } => ({
    intent: search.intent === "creator" || search.intent === "curator" ? search.intent : undefined,
  }),
  component: GetTheWebappPage,
});

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-text text-[11px] font-medium text-brand-bg">
        {n}
      </span>
      <span className="text-sm leading-relaxed">{children}</span>
    </li>
  );
}

function GetTheWebappPage() {
  // In an Instagram/TikTok-style webview nothing here can work: the browser's
  // install offer doesn't exist and Add to Home Screen isn't in its menu. The
  // gate hands them to a real browser first, same as sign-in does.
  return (
    <OpenInBrowserGate>
      <GetTheWebappInner />
    </OpenInBrowserGate>
  );
}

function GetTheWebappInner() {
  const { intent } = Route.useSearch();
  const { checking } = useRequireSession();
  const { back } = useBack();

  // Both read `navigator` / a media query, so both are set from an effect and
  // never a useState initialiser -- the hydration rule in platform.ts.
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installable, setInstallable] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Chrome's offer can arrive after this page has rendered, so subscribe to it
  // rather than reading once. The server snapshot is false: there is no install
  // prompt during SSR.
  const canInstall = useSyncExternalStore(subscribeInstallPrompt, canPromptInstall, () => false);

  useEffect(() => {
    setIos(isIOS());
    setInstalled(isStandalone());
    setInstallable(isInstallablePhone());
  }, []);

  async function handleInstall() {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      // Not navigating on "accepted": Android installs in the background and
      // leaves this tab where it was.
      setInstalling(false);
    }
  }

  if (checking) return <OnboardingChecking />;

  const lead = COPY[intent ?? "default"].lead;

  return (
    <div className="min-h-dvh bg-brand-bg text-brand-text">
      <header className="flex items-center px-4 py-5 min-[360px]:px-6 sm:px-10">
        <BackButton alwaysShow className="-ml-2 grid h-10 w-10 place-items-center" />
      </header>

      <main className="mx-auto w-full max-w-sm px-4 pb-12 min-[360px]:px-6">
        {installed ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-brand-text/15 p-8 text-center">
            <div className="rounded-full bg-brand-text p-3">
              <Check size={20} className="text-brand-bg" />
            </div>
            <div>
              <p className="text-sm font-medium">You&rsquo;re in the app</p>
              <p className="mt-0.5 text-xs text-brand-text/60">
                You&rsquo;re all set — carry on from here.
              </p>
            </div>
            <button
              type="button"
              onClick={back}
              className="mt-4 w-full rounded-full bg-brand-accent py-4 text-sm font-medium uppercase tracking-widest text-brand-bg active:scale-[0.98] transition-transform"
            >
              Done
            </button>
          </div>
        ) : !installable ? (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-brand-text/15 p-8 text-center">
            <Smartphone size={22} className="text-brand-text/60" />
            <p className="text-sm font-medium">Open Oakmonte on your phone</p>
            <p className="text-xs leading-relaxed text-brand-text/60">
              The app goes on a phone or tablet&rsquo;s home screen. Visit oakmonte.store there and
              sign in to add it.
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-[32px] leading-tight min-[360px]:text-4xl">
              Get the app
            </h1>
            <p className="mt-3 mb-6 text-sm leading-relaxed text-brand-text/70">{lead}</p>

            {canInstall ? (
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-accent py-4 text-sm font-medium uppercase tracking-widest text-brand-bg active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                <Download size={16} />
                {installing ? "Opening…" : "Add Oakmonte to my home screen"}
              </button>
            ) : (
              <div className="rounded-2xl border border-brand-text/15 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Smartphone size={16} className="text-brand-text/60" />
                  <p className="text-sm font-medium">
                    {ios ? "On iPhone or iPad" : "In your browser menu"}
                  </p>
                </div>
                <ol className="flex flex-col gap-3">
                  {ios ? (
                    <>
                      <Step n={1}>
                        Tap the <Share size={13} className="mx-0.5 -mt-0.5 inline" /> share button
                        at the top or bottom of the screen.
                      </Step>
                      <Step n={2}>
                        Scroll down and tap <span className="font-medium">Add to Home Screen</span>.
                      </Step>
                      <Step n={3}>
                        Tap <span className="font-medium">Add</span>, then open Oakmonte from your
                        home screen.
                      </Step>
                    </>
                  ) : (
                    <>
                      <Step n={1}>
                        Tap the <MoreVertical size={13} className="mx-0.5 -mt-0.5 inline" /> menu in
                        your browser&rsquo;s toolbar.
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

            <p className="mt-5 text-xs leading-relaxed text-brand-text/60">
              <span className="font-medium text-brand-text">Then carry on from the app.</span>{" "}
              {ios
                ? "It starts you signed out the first time — that's normal. Sign in with Face ID or Apple and you're back where you left off."
                : "You'll already be signed in."}
            </p>

            {/* The steps come first; the clip is opt-in. Only iPhone has one --
                Android's doesn't exist yet, and a button that reveals nothing
                is worse than no button. Drop the `ios` condition once it lands. */}
            {ios && !videoFailed && (
              <div className="mt-6">
                {showVideo ? (
                  // iPhone 12 Pro Max recording, 1284x2778: the frame takes that
                  // exact ratio and has no background, so its edge is the video's.
                  <div className="mx-auto w-[min(100%,250px)] overflow-hidden rounded-[26px]">
                    <video
                      src={ios ? iosExplainerSrc : ANDROID_EXPLAINER_SRC}
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
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-text/20 py-3.5 text-sm font-medium active:scale-[0.98] transition-transform"
                  >
                    <Play size={14} />
                    See Safari install video
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
