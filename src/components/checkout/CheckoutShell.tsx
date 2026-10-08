import type { ReactNode } from "react";

/** The frame both checkout pages share: black, the back control and title
 *  pinned under the status bar, and a centred column for the steps. */
export function CheckoutShell({ back, children }: { back: ReactNode; children: ReactNode }) {
  return (
    <div
      className="min-h-screen bg-black pb-[calc(env(safe-area-inset-bottom)+2rem)] text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <header className="flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        {back}
        <h1 className="text-[17px] font-semibold">Checkout</h1>
      </header>

      <div className="mx-auto max-w-[520px] px-4 pt-5">{children}</div>
    </div>
  );
}
