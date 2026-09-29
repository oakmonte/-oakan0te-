import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { takePendingCapture, type CapturedMedia } from "@/lib/capture-handoff";
import { AfterShotContext, NO_EDITS, type AfterShotEdits } from "@/lib/after-shot-context";
import { AfterShotLayersContext, useAfterShotLayersState } from "@/lib/after-shot-layers";
import { BlobManager } from "@/lib/blob-manager";

export const Route = createFileRoute("/create/after-shot")({
  component: AfterShotLayout,
});

function AfterShotLayout() {
  const navigate = useNavigate();
  const [media, setMediaState] = useState<CapturedMedia | null>(null);
  const [checked, setChecked] = useState(false);
  const [edits, setEdits] = useState<AfterShotEdits>(NO_EDITS);
  const [output, setOutputState] = useState<CapturedMedia | null>(null);

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
    // No revoke here: it ran between StrictMode's two mounts and killed the blob
    // before the second one could use it. The deferred cleanup below is what
    // frees an abandoned session.
  }, [navigate]);

  // The composite publish uploads. Kept apart from `media` so going back from
  // publish reopens the edit rather than its result — see AfterShotEdits.
  // Revokes only what it alone owns: the poster (and a fast-path blob) can be
  // the very same URLs the source is still showing.
  const outputRef = useRef<CapturedMedia | null>(null);
  const setOutput = useCallback((next: CapturedMedia | null) => {
    const prev = outputRef.current;
    const source = mediaRef.current;
    if (prev && prev.url !== next?.url && prev.url !== source?.url) {
      URL.revokeObjectURL(prev.url);
    }
    if (
      prev?.poster &&
      prev.poster.url !== next?.poster?.url &&
      prev.poster.url !== source?.poster?.url
    ) {
      URL.revokeObjectURL(prev.poster.url);
    }
    outputRef.current = next;
    setOutputState(next);
  }, []);

  const setMedia = useCallback(
    (next: CapturedMedia) => {
      const prevSource = mediaRef.current;
      // A new file (the studio's render) makes the old composite stale, and the
      // crop meaningless: it was a fraction of a frame that no longer exists.
      // A sound or cover change on the same file keeps both.
      if (prevSource && prevSource.blob !== next.blob) {
        setOutput(null);
        setEdits((e) => ({ ...e, cropRect: null }));
      }
      mediaRef.current = next;
      setMediaState((prev) => {
        if (prev && prev.url !== next.url) URL.revokeObjectURL(prev.url);
        // The poster is a second object URL living on the same value; replacing the
        // media without it leaks one blob per re-export.
        if (prev?.poster && prev.poster.url !== next.poster?.url) {
          URL.revokeObjectURL(prev.poster.url);
        }
        // Same again for the two fields that arrived with carousels and sound.
        // Each is another object URL riding on this one value, so a re-export
        // that keeps them (the common case — they compare equal and nothing is
        // freed) must not be the only case that behaves correctly.
        if (prev?.audio && prev.audio.url !== next.audio?.url) {
          URL.revokeObjectURL(prev.audio.url);
        }
        const keptExtras = new Set((next.extra ?? []).map((e) => e.url));
        prev?.extra?.forEach((item) => {
          if (!keptExtras.has(item.url)) URL.revokeObjectURL(item.url);
        });
        return next;
      });
    },
    [setOutput],
  );

  // Leaving the flow any way other than discard or a sent post (the system
  // back gesture, say) used to strand the capture; with the composite now kept
  // beside it, that would be two full-size videos pinned for the life of the
  // tab. Deferred a tick so StrictMode's simulated unmount → remount doesn't
  // revoke what the remount is about to show — the studio does the same.
  //
  // Only for a capture this flow owns. A post handed over by the video or
  // photo editor (`origin`) can share URLs with that editor's parked session,
  // which Back from publish returns to.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const source = mediaRef.current;
      const out = outputRef.current;
      if (!source || source.origin) return;
      const urls = [source.url, source.poster?.url, out?.url, out?.poster?.url];
      setTimeout(() => {
        if (mountedRef.current) return;
        for (const url of new Set(urls)) if (url) URL.revokeObjectURL(url);
      }, 0);
    };
  }, []);

  const discard = useCallback(() => {
    setOutput(null);
    if (media) URL.revokeObjectURL(media.url);
    if (media?.poster) URL.revokeObjectURL(media.poster.url);
    if (media?.audio) URL.revokeObjectURL(media.audio.url);
    media?.extra?.forEach((item) => URL.revokeObjectURL(item.url));

    BlobManager.revokeAll();

    navigate({ to: "/create", replace: true });
  }, [media, navigate, setOutput]);

  if (!checked || !media) return <div className="fixed inset-0 bg-black" />;

  return (
    <AfterShotContext.Provider
      value={{ media, setMedia, discard, edits, setEdits, output, setOutput }}
    >
      <AfterShotLayersProvider>
        <Outlet />
      </AfterShotLayersProvider>
    </AfterShotContext.Provider>
  );
}

// The layer stack lives on the LAYOUT, not on the index route. It used to be
// provided inside the index page, which unmounts the moment you open the
// studio — so nipping over to trim a clip silently threw away every caption and
// drawing you'd added. Held here it survives navigation between the after-shot
// children, and the studio can render the layers too.
//
// Sticker images are object URLs, so the provider owns them too. The index page
// used to revoke them when IT unmounted — fine while a sticker was baked into
// the media on the way out, but the layers now outlive the page and get baked
// again after Back from publish or a trip to the studio, and a revoked URL
// bakes as nothing, silently. Freed here, on the flow's real exit only.
function AfterShotLayersProvider({ children }: { children: React.ReactNode }) {
  const layersState = useAfterShotLayersState();
  const layersRef = useRef(layersState.layers);
  layersRef.current = layersState.layers;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const urls = layersRef.current.flatMap((l) =>
        l.kind === "sticker" && l.assetUrl.startsWith("blob:") ? [l.assetUrl] : [],
      );
      setTimeout(() => {
        if (mountedRef.current) return;
        for (const url of urls) URL.revokeObjectURL(url);
      }, 0);
    };
  }, []);
  return (
    <AfterShotLayersContext.Provider value={layersState}>
      {children}
    </AfterShotLayersContext.Provider>
  );
}
