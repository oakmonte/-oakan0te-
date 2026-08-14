import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Store, CheckCircle2, Loader2, Search, Plus } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/store/products")({
  component: StoreProducts,
});

const TABS = ["All", "Active", "Draft", "Archived"] as const;

function StoreProducts() {
  const { user, loading: sessionLoading } = useSession();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [bumpaConnected, setBumpaConnected] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [connectStatus, setConnectStatus] = useState<"idle" | "loading" | "connected" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");

  useEffect(() => {
    if (!user) {
      setStoreLoading(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("stores")
      .select("id, bumpa_connected_at")
      .eq("owner_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setStoreId(data.id);
          if (data.bumpa_connected_at) {
            setBumpaConnected(true);
            setConnectStatus("connected");
          }
        }
        setStoreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleConnect() {
    if (!apiKey.trim() || !storeId) return;
    setConnectStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/bumpa/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectStatus("error");
        setErrorMsg(data.error ?? "Something went wrong");
        return;
      }
      setConnectStatus("connected");
      setBumpaConnected(true);
    } catch {
      setConnectStatus("error");
      setErrorMsg("Network error — try again");
    }
  }

  if (sessionLoading || storeLoading) {
    return <div className="px-4 py-8 text-sm text-gray-400">Loading…</div>;
  }
  if (!user || !storeId) {
    return (
      <div className="px-4 py-8 text-sm text-gray-400">
        {!user ? "Sign in to manage your store." : "No store found for this account."}
      </div>
    );
  }

  return (
    <div className="px-4 py-5">
      {!bumpaConnected ? (
        <div className="border border-gray-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Store size={18} />
            <h2 className="font-medium">Import your catalog</h2>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Paste your Bumpa API key to import your existing catalog.
          </p>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Bumpa API key"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
          />
          {connectStatus === "error" && <p className="text-sm text-red-500 mb-2">{errorMsg}</p>}
          <button
            onClick={handleConnect}
            disabled={connectStatus === "loading" || !apiKey.trim()}
            className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {connectStatus === "loading" && <Loader2 size={14} className="animate-spin" />}
            {connectStatus === "loading" ? "Connecting..." : "Connect Bumpa"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-green-600 text-sm mb-6">
          <CheckCircle2 size={16} /> Bumpa connected
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search products"
            className="bg-transparent text-sm flex-1 outline-none"
          />
        </div>
        <button className="p-2 rounded-lg bg-black text-white">
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6 border-b border-gray-100 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 -mb-px border-b-2 ${activeTab === tab ? "border-black font-medium text-black" : "border-transparent text-gray-400"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TODO: wire to a real products/product_variants query once manual listing creation ships */}
      <div className="text-sm text-gray-400 text-center py-12">No products yet.</div>
    </div>
  );
}
