import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/product-category")({
  head: () => ({ meta: [{ title: "What do you sell — Oakmonte" }] }),
  component: ProductCategoryPage,
});

const SUGGESTED_CATEGORIES = [
  "Streetwear",
  "Thrift wears",
  "Goth",
  "Corporate",
  "Alte",
  "Old money",
  "Jewelry",
  "Perfume",
  "shoes",
  "sport shoes",
];

function ProductCategoryPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (category: string) => {
    setSelected((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleAddSearch = () => {
    const value = search.trim();
    if (!value) return;
    if (!selected.includes(value)) {
      setSelected((prev) => [...prev, value]);
    }
    setSearch("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return;

    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You're no longer signed in. Please sign in again.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("stores")
      .update({ product_category: selected })
      .eq("owner_id", user.id);

    setLoading(false);

    if (updateError) {
      setError("Something went wrong. Please try again.");
      console.error(updateError);
      return;
    }

    navigate({ to: "/", replace: true }); // or next onboarding step
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">
          What will you sell?
        </h1>
        <p className="text-sm text-brand-text/70 mb-8">
          Pick as many that fit — you can update this anytime.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSearch();
                }
              }}
              placeholder="Search or add your own"
              className="flex-1 rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
            />
            <button
              type="button"
              onClick={handleAddSearch}
              className="shrink-0 rounded-full border border-brand-text/25 px-4 py-3 text-sm hover:bg-brand-text/5 transition-colors"
              aria-label="Add category"
            >
              +
            </button>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {[...new Set([...SUGGESTED_CATEGORIES, ...selected])].map((category) => {
              const isSelected = selected.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggle(category)}
                  className={`rounded-full px-5 py-2.5 text-sm border transition-all duration-200 ${
                    isSelected
                      ? "bg-brand-text text-brand-bg border-brand-text"
                      : "bg-transparent text-brand-text border-brand-text/25 hover:border-brand-text/50"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={loading || selected.length === 0}
            className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-40 mt-2"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
        </form>
      </div>
    </div>
  );
}