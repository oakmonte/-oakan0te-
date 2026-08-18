import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { takePendingCapture, type CapturedMedia } from "@/lib/capture-handoff";
import { AfterShotContext } from "@/lib/after-shot-context";

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
      return next;
    });
  }, []);

  const discard = useCallback(() => {
    if (media) URL.revokeObjectURL(media.url);
    navigate({ to: "/create", replace: true });
  }, [media, navigate]);

  if (!checked || !media) return <div className="fixed inset-0 bg-black" />;

  return (
    <AfterShotContext.Provider value={{ media, setMedia, discard }}>
      <Outlet />
    </AfterShotContext.Provider>
  );
}
