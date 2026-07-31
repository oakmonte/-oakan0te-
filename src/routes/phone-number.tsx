import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/phone-number")({
  head: () => ({ meta: [{ title: "Phone number — Oakmonte" }] }),
  component: PhoneNumberPage,
});

function getIntent() {
  return typeof window !== "undefined"
    ? sessionStorage.getItem("oakmonte_intent") ?? "seller"
    : "seller";
}

function PhoneNumberPage() {
  const navigate = useNavigate();
  const [personalPhone, setPersonalPhone] = useState<string | undefined>();
  const [businessPhone, setBusinessPhone] = useState<string | undefined>();
  const [sameAsPersonal, setSameAsPersonal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intent = getIntent();
  const isSeller = intent === "seller";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (personalPhone && !isValidPhoneNumber(personalPhone)) {
      setError("That personal phone number doesn't look valid.");
      return;
    }

    const finalBusinessPhone = sameAsPersonal ? personalPhone : businessPhone;

    if (isSeller && finalBusinessPhone && !isValidPhoneNumber(finalBusinessPhone)) {
      setError("That business phone number doesn't look valid.");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You're no longer signed in. Please sign in again.");
      setLoading(false);
      return;
    }

    if (personalPhone) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ personal_phone: personalPhone })
        .eq("id", user.id);

      if (profileError) {
        setLoading(false);
        setError("Something went wrong saving your phone number.");
        console.error(profileError);
        return;
      }
    }

    // Only sellers have a stores row at this point in the flow —
    // curators and creators don't, so skip this update for them.
    if (isSeller) {
      const { error: storeError } = await supabase
        .from("stores")
        .update({ business_phone: finalBusinessPhone || null })
        .eq("owner_id", user.id);

      if (storeError) {
        setLoading(false);
        setError("Something went wrong saving your business phone.");
        console.error(storeError);
        return;
      }
    }

    setLoading(false);

    const nextRoute =
      intent === "curator" ? "/find-your-fit"
      : intent === "creator" ? "/" // TODO: point this at wherever you slot phone-number into the creator flow
      : "/product-category";

    navigate({ to: nextRoute, replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">Phone number</h1>
        <p className="text-sm text-brand-text/70 mb-8">
          We'll use these to keep you and your buyers in the loop.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="oakmonte-phone-input">
            <PhoneInput
              international
              defaultCountry="NG"
              value={personalPhone}
              onChange={setPersonalPhone}
              placeholder="Personal phone number"
            />
          </div>

          {isSeller && (
            <>
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
                <div className="oakmonte-phone-input">
                  <PhoneInput
                    international
                    defaultCountry="NG"
                    value={businessPhone}
                    onChange={setBusinessPhone}
                    placeholder="Business phone number (optional for now)"
                  />
                </div>
              )}

              <p className="text-xs text-brand-text/50 px-2">
                Don't have a separate business line yet? No problem — you can add a
                dedicated one later from your store settings.
              </p>
            </>
          )}

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