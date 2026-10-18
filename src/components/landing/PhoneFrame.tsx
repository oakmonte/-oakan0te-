import { useLayoutEffect, useState, type ReactNode, type Ref } from "react";

/** The iPhone the landing demos play in: thin frame, Dynamic Island, status
 *  bar, home indicator. Styled by the .iph* rules in routes/index.tsx. */

// Shaped like an iPhone 17 Pro Max (440 x 956 pt screen, ratio 1 : 2.17).
// Every demo is laid out on the same fixed canvas, SCREEN_W wide, with its
// content at normal size; the whole phone then scales down only as far as it
// must to fit under the header, and never below MIN_SCALE so text stays
// readable (a very short window scrolls a little instead).
const SCREEN_W = 340;
const SCREEN_H = Math.round((SCREEN_W * 956) / 440);
const BEZEL = 5;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = SCREEN_H + BEZEL * 2;
const MIN_SCALE = 0.8;

export function PhoneFrame({
  ref,
  label,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  label: string;
  children: ReactNode;
}) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const measure = () => {
      const room = window.innerHeight - (window.innerWidth > 800 ? 120 : 100);
      const byWidth = (window.innerWidth - 32) / PHONE_W;
      setScale(Math.max(MIN_SCALE, Math.min(1, room / PHONE_H, byWidth)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      ref={ref}
      className="iph-fit"
      aria-label={label}
      style={{ width: PHONE_W * scale, height: PHONE_H * scale }}
    >
      <div
        className="iph"
        style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}
      >
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
