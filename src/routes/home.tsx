import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopToggleNav } from "@/components/TopToggleNav";
import { Lock, Search } from "lucide-react";
import { ExplorePreview, ShopPreview } from "@/components/home/LockedPreview";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Oakmonte" }] }),
  component: HomePage,
});

function HomePage() {
  const [tab, setTab] = useState<"shop" | "explore">("explore");
  const { user } = useSession();
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);
  const [isSeller, setIsSeller] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("personal_username, account_type")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setOwnUsername(data.personal_username);
        setIsSeller(data.account_type === "seller");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div
      // chat-* tokens, not bg-black: /home is the "social" surface and follows
      // the phone's light/dark setting (styles.css, lib/surface.ts).
      className="min-h-screen bg-chat-bg text-chat-text pb-28"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 pb-2">
        <TopToggleNav
          active={tab}
          onChange={setTab}
          searchIcon={<Search size={17} color="#1A1A1A" />}
        />
      </div>

      <div className="relative">
        <div className="pointer-events-none select-none" aria-hidden>
          {tab === "shop" ? <ShopPreview /> : <ExplorePreview />}
        </div>

        <div className="fixed inset-x-0 top-[30vh] z-40 flex flex-col items-center gap-2 px-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-chat-text/10 text-chat-text">
            <Lock size={24} />
          </span>
          <p className="text-[20px] font-bold text-chat-text">
            {tab === "shop" ? "Shopping" : "Explore"} opens at full launch
          </p>
          <p className="text-[15px] font-medium text-chat-text/85">
            {tab === "shop"
              ? "Browse shelves from every store and check out in a tap."
              : "Scroll looks, then shop every piece in them straight from the post."}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              to="/create"
              className="h-10 rounded-full bg-chat-text px-5 text-[14px] font-semibold leading-10 text-chat-inverse"
            >
              Post a look
            </Link>
            {isSeller && (
              <Link
                to="/set-up-store"
                className="h-10 rounded-full border border-chat-border px-5 text-[14px] font-semibold leading-10 text-chat-text"
              >
                Set up a store
              </Link>
            )}
          </div>
        </div>
      </div>

      <BottomNav active="home" ownUsername={ownUsername} />
    </div>
  );
}
