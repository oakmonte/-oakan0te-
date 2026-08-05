import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { getDisplayNameFromUser } from "@/lib/auth";

export const Route = createFileRoute("/choose-username")({
  head: () => ({ meta: [{ title: "Choose a username — Oakmonte" }] }),
  component: ChooseUsernamePage,
});

function ChooseUsernamePage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    setError(null);
    setLoading(true);

    const intent =
      typeof window !== "undefined"
        ? (sessionStorage.getItem("oakmonte_intent") ?? "seller")
        : "seller";

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're no longer signed in. Please sign in again.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      personal_username: username,
      display_name: getDisplayNameFromUser(user) ?? username,
      personal_email: user.email,
      gender: gender || null,
      account_type: intent,
    });

    setLoading(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("That username is taken. Try another.");
      } else {
        setError("Something went wrong. Please try again.");
        console.error(insertError);
      }
      return;
    }

    const nextRoute =
      intent === "creator"
        ? "/where-did-you-hear-about-us"
        : intent === "curator"
          ? "/where-did-you-hear-about-us"
          : "/seller-type";

    navigate({ to: nextRoute, replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">Choose a username</h1>
        <p className="text-sm text-brand-text/70 mb-8">
          Your personal unique handle on Oakmonte — you can set a separate display name later.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm text-brand-text/80 focus:outline-none focus:border-brand-accent transition-colors"
          >
            <option value="">Gender (optional)</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="prefer not to say">prefer not to say</option>
          </select>
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
