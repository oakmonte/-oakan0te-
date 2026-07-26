import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/name-your-store")({
  head: () => ({ meta: [{ title: "Name your store — Oakmonte" }] }),
  component: NameYourStorePage,
});

function NameYourStorePage() {
  const navigate = useNavigate();
  const [storeUsername, setStoreUsername] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!storeUsername.trim()) return;

    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You're no longer signed in. Please sign in again.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("stores").insert({
      owner_id: user.id,
      store_username: storeUsername.trim(),
      business_email: businessEmail.trim() || null,
      brand_name: storeUsername.trim(), // placeholder until a dedicated brand-name step exists
    });

    setLoading(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("That store username is taken. Try another.");
      } else {
        setError("Something went wrong. Please try again.");
        console.error(insertError);
      }
      return;
    }

    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">Name your store</h1>
        <p className="text-sm text-brand-text/70 mb-8">
          Pick a store name that reflects your brand.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            value={storeUsername}
            onChange={(e) => setStoreUsername(e.target.value)}
            placeholder="Store username"
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
          />
          <input
            type="email"
            value={businessEmail}
            onChange={(e) => setBusinessEmail(e.target.value)}
            placeholder="Business email (optional for now)"
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
        </form>
      </div>
    </div>
  );
}