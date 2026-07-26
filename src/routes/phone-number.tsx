import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/phone-number")({
  head: () => ({ meta: [{ title: "Phone number — Oakmonte" }] }),
  component: PhoneNumberPage,
});

function PhoneNumberPage() {
  const navigate = useNavigate();
  const [personalPhone, setPersonalPhone] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [sameAsPersonal, setSameAsPersonal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You're no longer signed in. Please sign in again.");
      setLoading(false);
      return;
    }

    const finalBusinessPhone = sameAsPersonal ? personalPhone.trim() : businessPhone.trim();

    // Save personal phone to profiles
    if (personalPhone.trim()) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ personal_phone: personalPhone.trim() })
        .eq("id", user.id);

      if (profileError) {
        setLoading(false);
        setError("Something went wrong saving your phone number.");
        console.error(profileError);
        return;
      }
    }

    // Save business phone to this user's store
    const { error: storeError } = await supabase
      .from("stores")
      .update({ business_phone: finalBusinessPhone || null })
      .eq("owner_id", user.id);

    setLoading(false);

    if (storeError) {
      setError("Something went wrong saving your business phone.");
      console.error(storeError);
      return;
    }

    navigate({ to: "/", replace: true }); // or next onboarding step
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">Phone number</h1>
        <p className="text-sm text-brand-text/70 mb-8">
          We'll use these to keep you and your buyers in the loop.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="tel"
            value={personalPhone}
            onChange={(e) => setPersonalPhone(e.target.value)}
            placeholder="Personal phone number"
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
          />

          <label className="flex items-center gap-2 text-xs text-brand-text/70 px-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={sameAsPersonal}
              onChange={(e) => setSameAsPersonal(e.target.checked)}
              className="accent-brand-accent"
            />
            Use this as my business contact number too
          </label>

          {!sameAsPersonal && (
            <input
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="Business phone number (optional for now)"
              className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
            />
          )}

          <p className="text-xs text-brand-text/50 px-2">
            Don't have a separate business line yet? No problem — you can add a
            dedicated one later from your store settings.
          </p>

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