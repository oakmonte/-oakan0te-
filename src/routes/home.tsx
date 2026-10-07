import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopToggleNav } from "@/components/TopToggleNav";
import { Search } from "lucide-react";
import { ExploreGrid } from "@/components/home/ExploreGrid";
import { ShopFeed } from "@/components/home/ShopFeed";
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

      {tab === "shop" ? <ShopFeed /> : <ExploreGrid />}

      <BottomNav active="home" ownUsername={ownUsername} />
    </div>
  );
}
