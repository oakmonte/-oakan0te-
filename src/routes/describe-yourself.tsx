import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/describe-yourself")({
  head: () => ({ meta: [{ title: "Describe yourself — Oakmonte" }] }),
  component: DescribeYourselfPage,
});

function DescribeYourselfPage() {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user && description.trim()) {
      await supabase.from("profiles").update({ self_description: description.trim() }).eq("id", user.id);
    }

    setLoading(false);
    navigate({ to: "/name-your-store" });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">Describe yourself</h1>
        <p className="text-sm text-brand-text/70 mb-8">
          In a sentence or two — who are you, what do you do?
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. I curate vintage streetwear for Gen Z in Lagos"
            rows={4}
            className="w-full rounded-2xl border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors resize-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate({ to: "/name-your-store" })}
          className="mt-4 text-[11px] uppercase tracking-widest text-brand-text/60 hover:text-brand-text transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}