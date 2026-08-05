import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/creator-niche")({
  head: () => ({ meta: [{ title: "What's your niche — Oakmonte" }] }),
  component: CreatorNichePage,
});

const SUGGESTED_NICHES = [
  "Modelling",
  "Styling",
  "Intuitive talks",
  "Concept designs/ideas",
  "Painting",
  "Sculpting",
  "Product designing",
  "Photographer",
  "Videography/editing",
  "Makeup artistry",
  "Hairstyling",
  "Illustration/graphic design",
  "Fashion design/tailoring",
  "Thrift curation",
  "Jewelry/accessories making",
  "Writing/storytelling",
  "Set design/prop styling",
  "Content creation/UGC",
  "Nail artistry",
  "Skincare/beauty",
  "Fragrance",
  "Interior/space styling",
  "Footwear design",
  "Leatherwork",
  "Knitwear/crochet",
  "Embroidery/beadwork",
  "Textile/print design",
  "Costume design",
  "Art direction",
  "Creative direction",
  "Casting",
  "Modelling agency scouting",
  "Music/sound",
  "Dance/performance",
  "Food styling",
  "Event/experience design",
  "Brand strategy",
  "Copywriting",
  "Community building",
  "Fitness/wellness",
  "Travel",
  "Vintage sourcing",
  "Streetwear",
  "Menswear",
  "Womenswear",
  "Kidswear",
  "Bridal",
  "Tailoring/alterations",
  "Print/zines",
  "Digital art/3D",
  "Motion graphics",
  "Ceramics",
  "Woodwork",
  "Metalwork/welding",
  "Candle/home fragrance making",
];

function CreatorNichePage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const allNiches = [...new Set([...SUGGESTED_NICHES, ...selected])];
  const query = search.trim().toLowerCase();
  const visibleNiches = query
    ? allNiches.filter((n) => n.toLowerCase().includes(query))
    : allNiches;

  const toggle = (niche: string) => {
    setSelected((prev) =>
      prev.includes(niche) ? prev.filter((n) => n !== niche) : [...prev, niche],
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return;

    sessionStorage.setItem("oakmonte_creator_niches", JSON.stringify(selected));
    navigate({ to: "/find-your-fit" });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">What's your niche?</h1>
        <p className="text-sm text-brand-text/70 mb-8">
          Pick as many as fit — you can update this anytime.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-3xl border border-brand-text/15 bg-brand-text/[0.02] overflow-hidden text-left">
            <div className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-text/10 p-3 flex gap-2">
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
                className="flex-1 min-w-0 rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
              />
              <button
                type="button"
                onClick={handleAddSearch}
                className="shrink-0 rounded-full border border-brand-text/25 px-4 py-3 text-sm hover:bg-brand-text/5 transition-colors"
                aria-label="Add niche"
              >
                +
              </button>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-3">
              <div className="flex flex-wrap gap-2">
                {visibleNiches.map((niche) => {
                  const isSelected = selected.includes(niche);
                  return (
                    <button
                      key={niche}
                      type="button"
                      onClick={() => toggle(niche)}
                      className={`rounded-full px-5 py-2.5 text-sm border transition-all duration-200 ${
                        isSelected
                          ? "bg-brand-text text-brand-bg border-brand-text"
                          : "bg-transparent text-brand-text border-brand-text/25 hover:border-brand-text/50"
                      }`}
                    >
                      {niche}
                    </button>
                  );
                })}
                {visibleNiches.length === 0 && (
                  <p className="text-sm text-brand-text/50 px-2 py-3">
                    No matches — tap + to add "{search.trim()}".
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={selected.length === 0}
            className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-40 mt-2"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
