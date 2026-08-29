import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Search, Plus } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/messages")({
  head: () => ({ meta: [{ title: "Messages — Oakmonte" }] }),
  component: MessagesPage,
});

type Tab = "offers" | "messages" | "orders";

const TABS: { key: Tab; label: string }[] = [
  { key: "offers", label: "Offers" },
  { key: "messages", label: "Messages" },
  { key: "orders", label: "Orders" },
];

// No messaging/stories backend exists yet (no `messages`/`conversations`/
// `stories` table) — this is UI-only, matching the placeholder-data pattern
// already used for SHOP_ITEMS/EXPLORE_ITEMS on home.tsx, so the page has a
// real destination to design against instead of an empty stub. Swap for real
// queries once a messaging schema exists.
const STORIES = [
  { id: "s1", name: "Wraven Labs", avatar: "https://placehold.co/64x64", seen: false },
  { id: "s2", name: "hernameisR", avatar: "https://placehold.co/64x64", seen: false },
  { id: "s3", name: "Mr Aluca", avatar: "https://placehold.co/64x64", seen: true },
  { id: "s4", name: "Sully", avatar: "https://placehold.co/64x64", seen: true },
  { id: "s5", name: "Steve Jobs", avatar: "https://placehold.co/64x64", seen: false },
];

type Dot = "green" | "red" | "blue" | "gray" | "yellow" | null;

type ConversationRow = {
  id: string;
  name: string;
  preview: string;
  avatar: string;
  dot: Dot;
};

const CONVERSATIONS: Record<Tab, ConversationRow[]> = {
  offers: [
    { id: "o1", name: "Marbies' Store", preview: "Agreed", avatar: "", dot: "green" },
    { id: "o2", name: "Marbies' Store", preview: "₦30,000", avatar: "", dot: "red" },
    { id: "o3", name: "Marbies' Store", preview: "₦30,000", avatar: "", dot: "red" },
    { id: "o4", name: "Marbies' Store", preview: "Agreed", avatar: "", dot: "green" },
    { id: "o5", name: "Marbies' Store", preview: "Agreed", avatar: "", dot: "green" },
    { id: "o6", name: "Marbies' Store", preview: "₦70,000", avatar: "", dot: "red" },
    { id: "o7", name: "Marbies' Store", preview: "₦250,000", avatar: "", dot: "red" },
  ],
  messages: [
    { id: "m1", name: "22", preview: "Checkout what i just copped", avatar: "", dot: null },
    {
      id: "m2",
      name: "Marbies' Store",
      preview: "Your product will be delivered soon",
      avatar: "",
      dot: "blue",
    },
    {
      id: "m3",
      name: "Marbies' Store",
      preview: "No i won't take ass as payment",
      avatar: "",
      dot: "blue",
    },
    {
      id: "m4",
      name: "Diadem's Store",
      preview: "Do you have it in white?",
      avatar: "",
      dot: null,
    },
    {
      id: "m5",
      name: "Tailed Tailor",
      preview: "Yes i also do customizations",
      avatar: "",
      dot: null,
    },
    {
      id: "m6",
      name: "Best Boyfriend",
      preview: "No i won't clear your wishlist",
      avatar: "",
      dot: "blue",
    },
    { id: "m7", name: "Steve Jobs Himself", preview: "67", avatar: "", dot: "blue" },
  ],
  orders: [
    {
      id: "d1",
      name: "Rider's fault Store",
      preview: "Awaiting dispatch",
      avatar: "",
      dot: "blue",
    },
    { id: "d2", name: "Omo Store", preview: "Dispatched", avatar: "", dot: "gray" },
    { id: "d3", name: "Ejiro fast Store", preview: "Dispatched", avatar: "", dot: "gray" },
    { id: "d4", name: "Ejiro's balls Store", preview: "Delivered", avatar: "", dot: "green" },
    {
      id: "d5",
      name: "Ejiro's actual balls Store",
      preview: "Dispute open",
      avatar: "",
      dot: "red",
    },
    { id: "d6", name: "Slow Ejiro Store", preview: "Processing…", avatar: "", dot: "gray" },
    {
      id: "d7",
      name: "Scammer Ejiro' Store",
      preview: "Refund in Progress…",
      avatar: "",
      dot: "yellow",
    },
  ],
};

const DOT_COLOR: Record<Exclude<Dot, null>, string> = {
  green: "#22C55E",
  red: "#EF4444",
  blue: "#3B82F6",
  gray: "#9CA3AF",
  yellow: "#EAB308",
};

function MessagesPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("messages");

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

  const rows = CONVERSATIONS[tab];

  return (
    <div className="min-h-screen bg-black text-white pb-28">
      <div className="pt-4 px-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: ".." })}
          aria-label="Back"
          className="p-1 -ml-1 text-white"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[20px] font-bold">Messages</h1>
        <button aria-label="Search" className="p-1 -mr-1 text-white">
          <Search size={20} />
        </button>
      </div>

      <div className="mt-4 px-4 flex items-center gap-6 border-b border-white/10 text-[15px]">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2.5 -mb-px border-b-2 transition-colors duration-200 ${
              tab === key
                ? "border-white font-semibold text-white"
                : "border-transparent text-white/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 px-4 flex gap-4 overflow-x-auto no-scrollbar pb-1">
        <div className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 60 }}>
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-white/10 border border-white/15" />
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center">
              <Plus size={12} className="text-black" />
            </span>
          </div>
          <span className="text-[11px] text-white/60 truncate w-full text-center">Your story</span>
        </div>
        {STORIES.map((s) => (
          <div
            key={s.id}
            className="flex flex-col items-center gap-1.5 shrink-0"
            style={{ width: 60 }}
          >
            <div
              className="w-14 h-14 rounded-full p-[2px]"
              style={{
                background: s.seen
                  ? "rgba(255,255,255,0.15)"
                  : "linear-gradient(135deg, #F97316, #EC4899, #8B5CF6)",
              }}
            >
              <div className="w-full h-full rounded-full bg-black p-[2px]">
                <div className="w-full h-full rounded-full bg-white/10" />
              </div>
            </div>
            <span className="text-[11px] text-white/60 truncate w-full text-center">{s.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-2">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/5 transition-colors duration-150"
          >
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-white/10 border border-white/10" />
              {row.dot && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black"
                  style={{ background: DOT_COLOR[row.dot] }}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-medium truncate">{row.name}</p>
              <p className="text-[13px] text-white/50 truncate">{row.preview}</p>
            </div>
          </button>
        ))}
      </div>

      <BottomNav active="messages" ownUsername={ownUsername} />
    </div>
  );
}
