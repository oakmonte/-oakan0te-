import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/name-your-store")({
  head: () => ({ meta: [{ title: "Name your store — Oakmonte" }] }),
  component: NameYourStorePage,
});

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  if (!slug) {
    return `store-${Math.random().toString(36).slice(2, 8)}`;
  }

  return slug;
}

function NameYourStorePage() {
  const navigate = useNavigate();
  const [brandName, setBrandName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storeType =
    typeof window !== "undefined" ? sessionStorage.getItem("oakmonte_store_type") : null;
  const customOrders =
    typeof window !== "undefined"
      ? sessionStorage.getItem("oakmonte_custom_orders") === "true"
      : false;
  const isBrand = storeType === "Brand";
  const heading = isBrand ? "Name your brand" : "Name your store";
  const placeholder = isBrand ? "My Brand" : "My Store";
  const emailPlaceholder = isBrand
    ? "Brand email (optional for now)"
    : "Store email (optional for now)";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're no longer signed in. Please sign in again.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("stores").insert({
      owner_id: user.id,
      brand_name: brandName.trim(),
      store_username: slugify(brandName),
      business_email: businessEmail.trim() || null,
      store_type: storeType,
      offers_custom_orders: customOrders,
    });

    setLoading(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("That store name is taken. Try another.");
      } else {
        setError("Something went wrong. Please try again.");
        console.error(insertError);
      }
      return;
    }

    sessionStorage.removeItem("oakmonte_store_type");
    sessionStorage.removeItem("oakmonte_custom_orders");
    navigate({ to: "/phone-number", replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">{heading}</h1>
        <p className="text-sm text-brand-text/70 mb-8">
          Pick a name that reflects your {isBrand ? "brand" : "store"}.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
          />
          <input
            type="email"
            value={businessEmail}
            onChange={(e) => setBusinessEmail(e.target.value)}
            placeholder={emailPlaceholder}
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
