import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { takePendingCapture, type CapturedMedia } from "@/lib/capture-handoff";

export const Route = createFileRoute("/create/after-shot")({
  component: AfterShotLayout,
});

type AfterShotContextValue = {
  media: CapturedMedia;
  setMedia: (media: CapturedMedia) => void;
  discard: () => void;
};

const AfterShotContext = createContext<AfterShotContextValue | null>(null);

export function useAfterShotContext() {
  const ctx = useContext(AfterShotContext);
  if (!ctx) throw new Error("useAfterShotContext must be used within /create/after-shot");
  return ctx;
}

function AfterShotLayout() {
  const navigate = useNavigate();
  const [media, setMediaState] = useState<CapturedMedia | null>(null);

  useEffect(() => {
    const pending = takePendingCapture();
    if (!pending) {
      navigate({ to: "/create", replace: true });
      return;
    }
    setMediaState(pending);
    return () => URL.revokeObjectURL(pending.url);
  }, [navigate]);

  const setMedia = useCallback((next: CapturedMedia) => {
    setMediaState((prev) => {
      if (prev && prev.url !== next.url) URL.revokeObjectURL(prev.url);
      return next;
    });
  }, []);

  const discard = useCallback(() => {
    if (media) URL.revokeObjectURL(media.url);
    navigate({ to: "/create", replace: true });
  }, [media, navigate]);

  if (!media) return <div className="fixed inset-0 bg-black" />;

  return (
    <AfterShotContext.Provider value={{ media, setMedia, discard }}>
      <Outlet />
    </AfterShotContext.Provider>
  );
}
