import type { ReactNode } from "react";

/** A dashboard page's content on a wide screen: one outlined, rounded panel
 *  centred under the header, instead of components that are simply narrowed
 *  and left floating on an empty page (which reads as unfinished). On a phone
 *  it adds nothing -- the page is already the panel.
 *
 *  The panel keeps the page ground (--sd-bg) and draws only an outline, so the
 *  cards inside it (sd-surface / sd-elevated) keep the contrast they were
 *  designed with. The bottom margin clears the floating nav pill. */
export function DesktopPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`md:mx-auto md:mb-32 md:mt-6 md:w-[calc(100%-3rem)] md:max-w-[1040px] md:rounded-[28px] md:border md:border-sd-line md:bg-sd-bg md:px-8 md:pt-8 md:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}
