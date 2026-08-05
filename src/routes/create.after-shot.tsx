import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { takePendingCapture, type CapturedMedia } from "@/lib/capture-handoff";
import { AfterShotContext } from "@/lib/after-shot-context";

export const Route = createFileRoute("/create/after-shot")({
  component: AfterShotLayout,
});

function AfterShotLayout() {
  const navigate = useNavigate();
  const [media, setMediaState] = useState<CapturedMedia | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const pending = takePendingCapture();
    if (!pending) {
      setChecked(true);
      navigate({ to: "/create", replace: true });
      return;
    }
    setMediaState(pending);
    setChecked(true);
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

  if (!checked || !media) return <div className="fixed inset-0 bg-black" />;

  return (
    <AfterShotContext.Provider value={{ media, setMedia, discard }}>
      <Outlet />
    </AfterShotContext.Provider>
  );
}