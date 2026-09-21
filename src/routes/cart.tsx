import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { useOwnUsername } from "@/hooks/use-own-username";
import cartIcon from "@/assets/cart.svg";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Oakmonte" }] }),
  component: CartPage,
});

// The nav bar has always had a Cart tab pointing here, and until now it landed
// on the not-found page. There is no cart subsystem yet — no table, no state,
// and PostFeed's "add to cart" rail button is deliberately inert — so this is
// an honest placeholder rather than an empty shell pretending to be a cart.
//
// It uses the interior app treatment (black, SF Pro, room for the floating
// nav), not ComingSoonState, which is white-on-grey and built for the seller
// dashboard.
function CartPage() {
  const ownUsername = useOwnUsername();

  return (
    <div
      className="min-h-screen bg-black text-white pb-28"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <header className="px-6 pt-4 pb-2">
        <h1 className="text-[16px] font-bold">Cart</h1>
      </header>

      {/* Centred in what is left of the screen once the header and the nav's
          clearance are accounted for, so the group sits optically centred
          rather than drifting low. */}
      <main className="flex min-h-[calc(100vh-13rem)] flex-col items-center justify-center px-8 text-center">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col items-center">
          <div
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <img
              src={cartIcon}
              alt=""
              width={28}
              height={28}
              // The asset is drawn black for the light nav pill; on black it
              // has to be inverted rather than recoloured.
              style={{ filter: "brightness(0) invert(1)", opacity: 0.85 }}
            />
          </div>

          {/* One statement, said once. An earlier pass had a title, a body and
              a "Coming at launch" pill all carrying the same sentence. */}
          <p className="mt-5 text-[17px] font-semibold tracking-[-0.01em]">Nothing here yet</p>
          <p className="mt-2 max-w-[272px] text-[13px] leading-relaxed text-white/50">
            This route will be available during launch. Everything you pick out will collect here.
          </p>
        </div>
      </main>

      <BottomNav active="cart" ownUsername={ownUsername} />
    </div>
  );
}
