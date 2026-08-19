import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { takePendingCapture, type CapturedMedia } from "@/lib/capture-handoff";
import { AfterShotContext } from "@/lib/after-shot-context";
import { AfterShotLayersContext, useAfterShotLayersState } from "@/lib/after-shot-layers";

export const Route = createFileRoute("/create/after-shot")({
  component: AfterShotLayout,
});

function AfterShotLayout() {
  const navigate = useNavigate();
  const [media, setMediaState] = useState<CapturedMedia | null>(null);
  const [checked, setChecked] = useState(false);

  // Survives StrictMode's dev-only mount → unmount → remount. The handoff in
  // capture-handoff.ts yields its payload exactly once, so on the second mount
  // takePendingCapture() returned null and this layout bounced the entire
  // after-shot flow straight back to /create — the page was unreachable under
  // `vite dev`. A ref rides out the simulated remount (same fiber), while a real
  // re-entry gets a fresh component instance and so reads the new capture.
  const mediaRef = useRef<CapturedMedia | null>(null);

  useEffect(() => {
    const pending = mediaRef.current ?? takePendingCapture();
    if (!pending) {
      setChecked(true);
      navigate({ to: "/create", replace: true });
      return;
    }
    mediaRef.current = pending;
    setMediaState(pending);
    setChecked(true);
    // Deliberately no revoke-on-unmount: it ran between StrictMode's two mounts
    // and killed the blob before the second one could use it, and it revoked the
    // ORIGINAL url even after setMedia had already replaced (and revoked) it.
    // setMedia and discard cover the real hand-back points.
  }, [navigate]);

  const setMedia = useCallback((next: CapturedMedia) => {
    mediaRef.current = next;
    setMediaState((prev) => {
      if (prev && prev.url !== next.url) URL.revokeObjectURL(prev.url);
      // The poster is a second object URL living on the same value; replacing the
      // media without it leaks one blob per re-export.
      if (prev?.poster && prev.poster.url !== next.poster?.url) {
        URL.revokeObjectURL(prev.poster.url);
      }
      return next;
    });
  }, []);

  const discard = useCallback(() => {
    if (media) URL.revokeObjectURL(media.url);
    if (media?.poster) URL.revokeObjectURL(media.poster.url);
    navigate({ to: "/create", replace: true });
  }, [media, navigate]);

  if (!checked || !media) return <div className="fixed inset-0 bg-black" />;

  return (
    <AfterShotContext.Provider value={{ media, setMedia, discard }}>
      <AfterShotLayersProvider>
        <Outlet />
      </AfterShotLayersProvider>
    </AfterShotContext.Provider>
  );
}

// The layer stack lives on the LAYOUT, not on the index route. It used to be
// provided inside the index page, which unmounts the moment you open the trim
// screen — so nipping over to trim a clip silently threw away every caption and
// drawing you'd added. Held here it survives navigation between the after-shot
// children, and the trim screen can render the layers too.
function AfterShotLayersProvider({ children }: { children: React.ReactNode }) {
  const layersState = useAfterShotLayersState();
  return (
    <AfterShotLayersContext.Provider value={layersState}>
      {children}
    </AfterShotLayersContext.Provider>
  );
}
