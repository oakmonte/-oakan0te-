import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/where-did-you-hear-about-us")({
  head: () => ({ meta: [{ title: "Where did you hear about us — Oakmonte" }] }),
  component: WhereDidYouHearPage,
});

const OPTIONS = ["Instagram", "TikTok", "Youtube", "Online Articles", "A friend", "Google search", "Twitter", "Claude", "ChatGPT", "Perplexity", "Other"];

function WhereDidYouHearPage() {
  const navigate = useNavigate();
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [loading, setLoading] = useState(false);

  const choose = async (option: string) => {
    if (option === "Other") {
      setShowOther(true);
      return;
    }
    await save(option);
  };

  const save = async (value: string) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ referral_source: value }).eq("id", user.id);
    }
    setLoading(false);
    navigate({ to: "/name-your-store" });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">
          Where did you hear about us?
        </h1>
        <p className="text-sm text-brand-text/70 mb-8">So we know who to appreciate.</p>

        {!showOther ? (
          <div className="space-y-3">
            {OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                disabled={loading}
                className="w-full rounded-full border border-brand-text/25 py-3.5 text-sm font-medium hover:border-brand-text/50 hover:bg-brand-text/5 transition-all duration-200 disabled:opacity-50"
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="Tell us where"
              className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
            />
            <button
              type="button"
              onClick={() => save(other.trim() || "Other")}
              disabled={loading}
              className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 transition-all duration-300 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}