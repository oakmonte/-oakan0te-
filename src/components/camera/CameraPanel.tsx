import { ReactNode, useEffect, useRef } from "react";

type CameraPanelProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  height?: number;
};

export default function CameraPanel({
  open,
  title,
  children,
  onClose,
  height = 320,
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
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          background: "rgba(0,0,0,.45)",
          backdropFilter: open ? "blur(10px)" : "blur(0px)",
          transition: "opacity 280ms ease-out, backdrop-filter 280ms ease-out",
          willChange: "opacity, backdrop-filter",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed left-0 right-0 z-50 transition-transform duration-300 ease-out"
        style={{
          bottom: 0,
          height,
          transform: open
            ? "translateY(0)"
            : `translateY(calc(${height}px + env(safe-area-inset-bottom)))`,
          pointerEvents: open ? "auto" : "none",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          background: "#111",
          borderTop: "1px solid rgba(255,255,255,.08)",
          boxShadow: "0 -12px 40px rgba(0,0,0,.45)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          willChange: "transform",
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            style={{
              width: 46,
              height: 5,
              borderRadius: 9999,
              background: "rgba(255,255,255,.28)",
            }}
          />
        </div>

        {/* Header */}
        <div className="px-6 pb-4">
          <h2
            className="text-white text-lg font-semibold"
            style={{
              fontFamily: "'SF Pro', system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
        </div>

        {/* Content */}
        <div
          className="px-6 overflow-y-auto"
          style={{
            height: height - 76,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
