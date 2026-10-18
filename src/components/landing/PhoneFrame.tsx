import type { ReactNode, Ref } from "react";

/** The iPhone the landing demos play in: thin frame, Dynamic Island, status
 *  bar, home indicator. Styled by the .iph* rules in routes/index.tsx. */

// Shaped like an iPhone 17 Pro Max (440 x 956 pt screen), with content at
// its normal size. The phone is shortened to fit the window under the header
// (CSS max-height), so the bottom of a long demo may be cut off -- by design:
// one look shows the demo, and the content stays readable.
export function PhoneFrame({
  ref,
  label,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div ref={ref} className="iph-fit" aria-label={label}>
      <div className="iph">
        <div className="iph-screen" aria-hidden="true">
          <div className="iph-status">
            <span className="iph-time">9:41</span>
            <span className="iph-island" />
            <span className="iph-icons">
              <svg width="18" height="12" viewBox="0 0 17 11">
                <rect x="0" y="7" width="3" height="4" rx="1" />
                <rect x="4.5" y="5" width="3" height="6" rx="1" />
                <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
                <rect x="13.5" y="0" width="3" height="11" rx="1" />
              </svg>
              <svg width="16" height="12" viewBox="0 0 15 11">
                <path d="M7.5 2.3c2.1 0 4 .8 5.4 2.1l1.1-1.1A9.1 9.1 0 0 0 7.5.7 9.1 9.1 0 0 0 1 3.3l1.1 1.1A7.6 7.6 0 0 1 7.5 2.3Zm0 3.2c1.2 0 2.3.4 3.1 1.2l1.1-1.1a6 6 0 0 0-8.4 0l1.1 1.1c.8-.8 1.9-1.2 3.1-1.2Zm0 3.2c-.5 0-.9.2-1.2.5L7.5 10.4l1.2-1.2c-.3-.3-.7-.5-1.2-.5Z" />
              </svg>
              <svg width="27" height="13" viewBox="0 0 25 12">
                <rect
                  x=".5"
                  y=".5"
                  width="21"
                  height="11"
                  rx="3.5"
                  fill="none"
                  strokeOpacity=".4"
                />
                <rect x="2" y="2" width="18" height="8" rx="2" />
                <path d="M23 4v4a2 2 0 0 0 0-4Z" fillOpacity=".4" />
              </svg>
            </span>
          </div>
          <div className="iph-body">{children}</div>
          <span className="iph-home" />
        </div>
      </div>
    </div>
  );
}
