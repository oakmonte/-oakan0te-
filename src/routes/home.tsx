import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopToggleNav } from "@/components/TopToggleNav";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Oakmonte" }] }),
  component: HomePage,
});

const MOCK_ITEMS = [
  { id: "1", src: "https://placehold.co/227x310", title: "Pink summer hoodie", price: "30,000" },
  { id: "2", src: "https://placehold.co/227x310", title: "Pink summer hoodie", price: "30,000" },
  { id: "3", src: "https://placehold.co/227x310", title: "Pink summer hoodie", price: "30,000" },
  { id: "4", src: "https://placehold.co/227x310", title: "Pink summer hoodie", price: "30,000" },
];

function HomePage() {
  const [tab, setTab] = useState<"shop" | "explore">("shop");
  // TODO: replace with the real logged-in user's username (same pattern as profile.$username.tsx)
  const ownUsername = "diadem-ebenezer";

  return (
    <div className="min-h-screen bg-black text-white pb-28" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      <div className="pt-4 px-4 flex justify-center">
        <TopToggleNav active={tab} onChange={setTab} />
      </div>

      <div className="px-4 mt-6">
        <h2 className="text-[24px] font-bold mb-3">Hoodie shelf</h2>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {MOCK_ITEMS.map((item) => (
            <div key={item.id} className="shrink-0" style={{ width: 160 }}>
              <img src={item.src} alt="" className="w-full rounded-[14px] object-cover" style={{ height: 220 }} />
              <p className="text-[14px] font-bold mt-2">{item.title}</p>
              <p className="text-[13px] font-semibold text-white/80">₦{item.price}</p>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="home" ownUsername={ownUsername} />
    </div>
  );
}