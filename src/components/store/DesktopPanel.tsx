import type { ReactNode } from "react";

/** A dashboard page's content on a wide screen: one outlined, rounded panel
 *  centred under the header, instead of components that are simply narrowed
 *  and left floating on an empty page (which reads as unfinished). On a phone
 *  it adds nothing -- the page is already the panel.
 *
 *  Only an outline, no fill of its own: it sits on whatever ground the page
 *  already paints (sd-bg on the dashboard, the product form's light grey), so
 *  the cards inside keep the contrast they were designed with. The bottom
 *  margin clears the floating nav pill.
 *
 *  `narrow` is for forms: a column a form reads well at, and less padding,
 *  since form cards already carry their own side margin. */
export function DesktopPanel({
  children,
  narrow = false,
  className = "",
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  const size = narrow
    ? "md:max-w-[720px] md:px-4 md:pt-4 md:pb-6"
    : "md:max-w-[1040px] md:px-8 md:pt-8";
  return (
    <div
      className={`md:mx-auto md:mb-32 md:mt-6 md:w-[calc(100%-3rem)] md:rounded-[28px] md:border md:border-sd-line md:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] ${size} ${className}`}
    >
      {children}
    </div>
  );
}
