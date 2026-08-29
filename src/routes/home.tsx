import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopToggleNav } from "@/components/TopToggleNav";
import { Search } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Oakmonte" }] }),
  component: HomePage,
});

const SHOP_ITEMS = [
  { id: "1", src: "https://placehold.co/227x310", title: "Pink summer hoodie", price: "30,000" },
  { id: "2", src: "https://placehold.co/227x310", title: "Pink summer hoodie", price: "30,000" },
  { id: "3", src: "https://placehold.co/227x310", title: "Pink summer hoodie", price: "30,000" },
  { id: "4", src: "https://placehold.co/227x310", title: "Pink summer hoodie", price: "30,000" },
];

const EXPLORE_ITEMS = [
  { id: "e1", src: "https://placehold.co/280x350" },
  { id: "e2", src: "https://placehold.co/280x280" },
  { id: "e3", src: "https://placehold.co/280x420" },
  { id: "e4", src: "https://placehold.co/280x300" },
  { id: "e5", src: "https://placehold.co/280x380" },
  { id: "e6", src: "https://placehold.co/280x320" },
];

function HomePage() {
  const [tab, setTab] = useState<"shop" | "explore">("shop");
  const { user } = useSession();
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("personal_username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setOwnUsername(data.personal_username);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div
      className="min-h-screen bg-black text-white pb-28"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <div className="pt-4 px-4 flex justify-center">
        <TopToggleNav
          active={tab}
          onChange={setTab}
          searchIcon={<Search size={17} color="#1A1A1A" />}
        />
      </div>

      {tab === "shop" ? (
        <div className="px-4 mt-6">
          <h2 className="text-[24px] font-bold mb-3">Hoodie shelf</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {SHOP_ITEMS.map((item) => (
              <div key={item.id} className="shrink-0" style={{ width: 160 }}>
                <img
                  src={item.src}
                  alt=""
                  className="w-full rounded-[14px] object-cover"
                  style={{ height: 220 }}
                />
                <p className="text-[14px] font-bold mt-2">{item.title}</p>
                <p className="text-[13px] font-semibold text-white/80">₦{item.price}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-3 mt-6 columns-2 gap-2 [column-fill:_balance]">
          {EXPLORE_ITEMS.map((item) => (
            <img
              key={item.id}
              src={item.src}
              alt=""
              className="w-full mb-2 rounded-[13px] object-cover break-inside-avoid"
            />
          ))}
        </div>
      )}

      <BottomNav active="home" ownUsername={ownUsername} />
    </div>
  );
}
