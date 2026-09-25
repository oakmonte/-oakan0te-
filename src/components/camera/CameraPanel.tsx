import { ReactNode, useEffect, useRef } from "react";

type CameraPanelProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  height?: number;
  /** Every other CameraPanel consumer lives inside the black camera/after-shot
   *  editor and wants the default dark sheet. The publish page is the one
   *  deliberate white-background exception (see __root.tsx) — this lets its
   *  sheets match without changing the shared default. */
  light?: boolean;
  /** Pinned between the title and the scrolling content — for controls that
   *  must stay put while the list moves under them (the sound sheet's search
   *  box and genre chips). Content passed as children scrolls; this doesn't. */
  toolbar?: ReactNode;
};

export default function CameraPanel({
  open,
  title,
  children,
  onClose,
  height = 320,
  light = false,
  toolbar,
}: CameraPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Prevent page scrolling while panel is open.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape key closes panel.
  useEffect(() => {
    if (!open) return;

    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop. Dim only — no blur. This covers the full viewport
          (it's also the tap-outside-to-close target), which includes
          whatever slice of the live camera/media preview is still visible
          above the sheet; blurring it there made the very thing panels like
          Filters and Adjust exist to let you judge (the live preview)
          unreadable while you're using them. */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 280ms ease-out",
          willChange: "opacity",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed left-0 right-0 z-50 flex flex-col transition-transform duration-300 ease-out"
        style={{
          bottom: 0,
          // Clamped, not trusted. `height` is what the panel WANTS; a tall one
          // asked for on a short phone would reach past the top of the screen
          // and take its own close affordance with it. `dvh` rather than `vh`
          // so the browser chrome that slides in and out on mobile Safari is
          // already accounted for.
          height: `min(${height}px, 78dvh)`,
          transform: open
            ? "translateY(0)"
            : `translateY(calc(min(${height}px, 78dvh) + env(safe-area-inset-bottom)))`,
          pointerEvents: open ? "auto" : "none",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          background: light ? "#fff" : "#111",
          borderTop: light ? "1px solid rgba(0,0,0,.08)" : "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 -12px 40px rgba(0,0,0,.45)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          willChange: "transform",
        }}
      >
        {/* Drag Handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-2">
          <div
            style={{
              width: 46,
              height: 5,
              borderRadius: 9999,
              background: light ? "rgba(0,0,0,.16)" : "rgba(255,255,255,.28)",
            }}
          />
        </div>

        {/* Header */}
        <div className="shrink-0 px-6 pb-4">
          <h2
            className={
              light ? "text-black text-lg font-semibold" : "text-white text-lg font-semibold"
            }
            style={{
              fontFamily: "'SF Pro', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
        </div>

        {toolbar && <div className="shrink-0 px-6">{toolbar}</div>}

        {/* Content. Takes whatever the clamped panel has left after the
            handle, header and any pinned toolbar — as a flex child rather
            than a hand-computed calc(), so a toolbar doesn't have to know its
            own height for the list to end at the right place. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6">{children}</div>
      </div>
    </>
  );
}
