import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronDown, ShoppingBag, Store, Upload, Check, X } from "lucide-react";
import { authedFetch } from "@/lib/authed-fetch";
import { useActiveStoreId } from "@/hooks/use-own-store";
import { Spinner } from "@/components/spinner";

export const Route = createFileRoute("/store/products_/upload")({
  component: ProductsUpload,
});

// Mirrors import_jobs.status per the platform-import-contract skill
// (oakmonte-import-worker/skills/platform-import-contract.md): pending ->
// running -> succeeded | failed | partial. "done" covers succeeded/failed/
// partial, matching the worker's own api.import.status.ts response shape.
type JobStatus = {
  id: string;
  status: string;
  error: string | null;
  done: boolean;
  result?: { created?: number; updated?: number; failed?: number; warnings?: unknown[] } | null;
};

const POLL_MS = 3000;

function JobBanner({ job, onDismiss }: { job: JobStatus; onDismiss: () => void }) {
  const inProgress = job.status === "pending" || job.status === "running";
  const ok = job.status === "succeeded";
  const partial = job.status === "partial";

  return (
    <div
      className={`mx-4 mt-4 rounded-xl border p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
        inProgress
          ? "border-gray-200 bg-gray-50"
          : ok
            ? "border-gray-200 bg-gray-50"
            : "border-red-100 bg-red-50"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {inProgress ? (
          <Spinner className="text-gray-400" />
        ) : ok || partial ? (
          <Check size={18} className="text-gray-900" />
        ) : (
          <X size={18} className="text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {inProgress
            ? "Import running…"
            : ok
              ? "Import finished"
              : partial
                ? "Import finished with issues"
                : "Import failed"}
        </p>
        {job.error && <p className="text-xs text-gray-500 mt-0.5 break-words">{job.error}</p>}
        {job.result && (job.result.created || job.result.updated) ? (
          <p className="text-xs text-gray-400 mt-0.5">
            {job.result.created ?? 0} created · {job.result.updated ?? 0} updated
            {job.result.failed ? ` · ${job.result.failed} failed` : ""}
          </p>
        ) : null}
      </div>
      {job.done && (
        <button type="button" onClick={onDismiss} className="shrink-0 p-1 -mr-1 -mt-1">
          <X size={16} className="text-gray-400" />
        </button>
      )}
    </div>
  );
}

// Numbers the two paths inside an expanded Shopify/Bumpa section — "connect"
// and "upload a CSV" read as one continuous block without this, and a seller
// skimming past the first button can miss that a second, actually-working
// option sits right below it.
function OptionLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] font-medium flex items-center justify-center shrink-0">
        {n}
      </span>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{children}</span>
    </div>
  );
}

/** Hidden file input; exposes a single `pick()` that resolves with the chosen file. */
function useFilePicker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resolveRef = useRef<((file: File | null) => void) | null>(null);

  const node = (
    <input
      ref={inputRef}
      type="file"
      accept=".csv,text/csv"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0] ?? null;
        e.target.value = "";
        resolveRef.current?.(file);
        resolveRef.current = null;
      }}
    />
  );

  function pick(): Promise<File | null> {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      inputRef.current?.click();
    });
  }

  return { node, pick };
}

function ProductsUpload() {
  const navigate = useNavigate();
  const { storeId } = useActiveStoreId();

  const [openSection, setOpenSection] = useState<"shopify" | "bumpa" | null>(null);
  const [shopDomain, setShopDomain] = useState("");
  const [bumpaKey, setBumpaKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connectedNote, setConnectedNote] = useState<"shopify" | "bumpa" | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);

  const shopifyPicker = useFilePicker();
  const bumpaPicker = useFilePicker();
  const universalPicker = useFilePicker();

  // Polls the most recently created job until it reaches a terminal state.
  // Only one job is tracked at a time — the worker processes one job per
  // tick anyway (see index.js), so showing more than the latest adds
  // complexity without telling a seller anything they need mid-import.
  useEffect(() => {
    if (!job || job.done) return;
    const timer = setInterval(async () => {
      try {
        const res = await authedFetch(`/api/import/status?jobId=${job.id}`);
        const data = await res.json();
        if (!res.ok) return;
        setJob(data as JobStatus);
      } catch {
        // Transient network error — next tick tries again.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [job]);

  async function uploadCsv(file: File, platform: "csv" | "bumpa", profile?: string) {
    if (!storeId) {
      setError("No store found on this account");
      return;
    }
    setBusy(true);
    setError("");

    const form = new FormData();
    form.append("file", file);
    form.append("storeId", storeId);
    form.append("platform", platform);
    if (profile) form.append("profile", profile);

    try {
      const res = await authedFetch("/api/import/csv", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setJob({ id: data.jobId, status: data.status ?? "pending", error: null, done: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function connectShopify() {
    if (!storeId) {
      setError("No store found on this account");
      return;
    }
    const shop = shopDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "");
    if (!shop) {
      setError("Enter your shop domain first");
      return;
    }
    const domain = shop.endsWith(".myshopify.com") ? shop : `${shop}.myshopify.com`;

    setBusy(true);
    setError("");
    try {
      const res = await authedFetch("/api/shopify/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: domain, storeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start Shopify connect");
      // Shopify's own consent screen is where the merchant actually
      // authorizes — nothing here can or should skip that step.
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Shopify");
      setBusy(false);
    }
  }

  async function connectBumpa() {
    if (!storeId) {
      setError("No store found on this account");
      return;
    }
    if (!bumpaKey.trim()) {
      setError("Enter your Bumpa API key first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await authedFetch("/api/bumpa/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, apiKey: bumpaKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not connect Bumpa");
      setBumpaKey("");
      setConnectedNote("bumpa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Bumpa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white pb-10">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center">
        <button
          onClick={() => navigate({ to: "/store/products" })}
          className="text-sm text-gray-500 flex items-center gap-0.5 -ml-1"
          type="button"
        >
          <ChevronLeft size={18} />
          Products
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Upload products
        </span>
      </div>

      {job && <JobBanner job={job} onDismiss={() => setJob(null)} />}
      {error && (
        <p className="px-4 pt-3 text-sm text-red-500 animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}

      <div className="px-4 py-6">
        <p className="text-sm text-gray-500 mb-6">
          Bring in products you already have listed somewhere else.
        </p>

        <div className="flex flex-col gap-3">
          {/* Shopify */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenSection((v) => (v === "shopify" ? null : "shopify"))}
              className="w-full flex items-center gap-3 p-4 text-left oak-motion-control"
            >
              <div className="p-2 rounded-full bg-gray-100">
                <ShoppingBag size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Shopify</p>
                <p className="text-xs text-gray-500 mt-0.5">Connect your store or upload a CSV.</p>
              </div>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform duration-200 ${openSection === "shopify" ? "rotate-180" : ""}`}
              />
            </button>
            {openSection === "shopify" && (
              <div className="border-t border-gray-100 px-4 py-4 flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
                <div>
                  <OptionLabel n={1}>Connect directly</OptionLabel>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400">Shop domain</span>
                    <input
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      placeholder="mystore or mystore.myshopify.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="text-base border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={connectShopify}
                    disabled={busy || !shopDomain.trim()}
                    className="mt-2 w-full bg-black text-white text-sm font-medium rounded-lg py-2.5 disabled:opacity-40 oak-motion-control active:scale-[0.98]"
                  >
                    Connect Shopify
                  </button>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Connecting links your account for later — it doesn't pull products in on its own
                    yet. Use option 2 to actually bring your catalogue in today.
                  </p>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <OptionLabel n={2}>Upload a CSV</OptionLabel>
                  <button
                    type="button"
                    onClick={async () => {
                      const file = await shopifyPicker.pick();
                      if (file) uploadCsv(file, "csv", "shopify");
                    }}
                    disabled={busy}
                    className="w-full text-left border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 font-medium oak-motion-control disabled:opacity-40"
                  >
                    Upload Shopify CSV export
                  </button>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    From Shopify admin: Products → Export.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bumpa */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenSection((v) => (v === "bumpa" ? null : "bumpa"))}
              className="w-full flex items-center gap-3 p-4 text-left oak-motion-control"
            >
              <div className="p-2 rounded-full bg-gray-100">
                <Store size={18} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Bumpa</p>
                <p className="text-xs text-gray-500 mt-0.5">Connect your store or upload a CSV.</p>
              </div>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform duration-200 ${openSection === "bumpa" ? "rotate-180" : ""}`}
              />
            </button>
            {openSection === "bumpa" && (
              <div className="border-t border-gray-100 px-4 py-4 flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
                <div>
                  <OptionLabel n={1}>Connect directly</OptionLabel>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400">Bumpa API key</span>
                    <input
                      value={bumpaKey}
                      onChange={(e) => setBumpaKey(e.target.value)}
                      placeholder="Paste your API key"
                      type="password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="text-base border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={connectBumpa}
                    disabled={busy || !bumpaKey.trim()}
                    className="mt-2 w-full bg-black text-white text-sm font-medium rounded-lg py-2.5 disabled:opacity-40 oak-motion-control active:scale-[0.98]"
                  >
                    Connect Bumpa
                  </button>
                  {connectedNote === "bumpa" ? (
                    <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
                      <Check size={12} /> Connected. Use option 2 to bring products in.
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400 mt-1.5">
                      Found in your Bumpa dashboard under API settings.
                    </p>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <OptionLabel n={2}>Upload a CSV</OptionLabel>
                  <button
                    type="button"
                    onClick={async () => {
                      const file = await bumpaPicker.pick();
                      if (file) uploadCsv(file, "bumpa");
                    }}
                    disabled={busy}
                    className="w-full text-left border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 font-medium oak-motion-control disabled:opacity-40"
                  >
                    Upload Bumpa CSV export
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Universal CSV */}
          <button
            type="button"
            onClick={async () => {
              const file = await universalPicker.pick();
              if (file) uploadCsv(file, "csv");
            }}
            disabled={busy}
            className="flex items-center gap-3 border border-gray-200 rounded-2xl p-4 text-left oak-motion-control disabled:opacity-40"
          >
            <div className="p-2 rounded-full bg-gray-100">
              <Upload size={18} />
            </div>
            <div>
              <p className="text-sm font-medium">Upload from anywhere else</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Any CSV — we'll match the columns automatically.
              </p>
            </div>
          </button>
        </div>
      </div>

      {shopifyPicker.node}
      {bumpaPicker.node}
      {universalPicker.node}
    </div>
  );
}
