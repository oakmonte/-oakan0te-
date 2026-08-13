import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Store, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/store")({
  component: OakmonteStore,
});

function OakmonteStore() {
  const { user, loading: sessionLoading } = useSession();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "connected" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

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
          if (data.bumpa_connected_at) setStatus("connected");
        }
        setStoreLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleConnect() {
    if (!apiKey.trim() || !storeId) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/bumpa/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, apiKey: apiKey.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong");
        return;
      }

      setStatus("connected");
    } catch {
      setStatus("error");
      setErrorMsg("Network error — try again");
    }
  }

  if (sessionLoading || storeLoading) {
    return <div className="min-h-screen bg-white px-4 py-8 text-sm text-gray-400">Loading…</div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-white px-4 py-8 text-sm text-gray-400">Sign in to manage your store.</div>;
  }

  if (!storeId) {
    return <div className="min-h-screen bg-white px-4 py-8 text-sm text-gray-400">No store found for this account.</div>;
  }

  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">Oakmonte Store</h1>

      <div className="border border-gray-200 rounded-2xl p-5 max-w-md">
        <div className="flex items-center gap-2 mb-3">
          <Store size={18} />
          <h2 className="font-medium">Connect your store</h2>
        </div>

        {status === "connected" ? (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 size={16} />
            Bumpa connected
          </div>
        ) : (
          <>
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
            {status === "error" && (
              <p className="text-sm text-red-500 mb-2">{errorMsg}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={status === "loading" || !apiKey.trim()}
              className="w-full bg-black text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {status === "loading" && <Loader2 size={14} className="animate-spin" />}
              {status === "loading" ? "Connecting..." : "Connect Bumpa"}
            </button>
          </>
        )}
      </div>

      <div className="mt-8 text-sm text-gray-400 space-y-1">
        <p>Inventory — coming soon</p>
        <p>Orders — coming soon</p>
        <p>Analytics — coming soon</p>
      </div>
    </div>
  );
}