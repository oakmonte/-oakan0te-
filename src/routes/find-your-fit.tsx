import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/find-your-fit")({
  head: () => ({ meta: [{ title: "Find your fit — Oakmonte" }] }),
  component: FindYourFitPage,
});

type BodyType = {
  name: string;
  shoulder: number;
  waist: number;
  hip: number;
};

const FEMALE_BODY_TYPES: BodyType[] = [
  { name: "Hourglass", shoulder: 0.75, waist: 0.4, hip: 0.78 },
  { name: "Pear", shoulder: 0.55, waist: 0.45, hip: 0.85 },
  { name: "Apple", shoulder: 0.65, waist: 0.75, hip: 0.55 },
  { name: "Rectangle", shoulder: 0.6, waist: 0.55, hip: 0.6 },
  { name: "Inverted triangle", shoulder: 0.85, waist: 0.5, hip: 0.45 },
  { name: "Athletic", shoulder: 0.7, waist: 0.5, hip: 0.62 },
];

const MALE_BODY_TYPES: BodyType[] = [
  { name: "Trapezoid", shoulder: 0.85, waist: 0.45, hip: 0.5 },
  { name: "Triangle", shoulder: 0.5, waist: 0.6, hip: 0.75 },
  { name: "Oval", shoulder: 0.6, waist: 0.8, hip: 0.6 },
  { name: "Rectangle", shoulder: 0.6, waist: 0.55, hip: 0.58 },
  { name: "Athletic", shoulder: 0.8, waist: 0.45, hip: 0.55 },
];

const NEUTRAL_BODY_TYPES: BodyType[] = [
  { name: "Slim", shoulder: 0.5, waist: 0.42, hip: 0.5 },
  { name: "Athletic", shoulder: 0.72, waist: 0.48, hip: 0.58 },
  { name: "Curvy", shoulder: 0.65, waist: 0.42, hip: 0.78 },
  { name: "Broad", shoulder: 0.85, waist: 0.55, hip: 0.6 },
  { name: "Average", shoulder: 0.6, waist: 0.55, hip: 0.6 },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function BodySilhouette({ shoulder, waist, hip }: BodyType) {
  const cx = 30;
  const sW = 10 + shoulder * 20;
  const wW = 10 + waist * 20;
  const hW = 10 + hip * 20;

  const shoulderY = 22;
  const waistY = 58;
  const hipY = 82;
  const legY = 116;

  const path = `
    M ${cx - sW} ${shoulderY}
    C ${cx - sW} ${shoulderY + 14}, ${cx - wW} ${waistY - 10}, ${cx - wW} ${waistY}
    C ${cx - wW} ${waistY + 10}, ${cx - hW} ${hipY - 8}, ${cx - hW} ${hipY}
    L ${cx - hW * 0.5} ${legY}
    L ${cx - hW * 0.15} ${hipY + 6}
    L ${cx + hW * 0.15} ${hipY + 6}
    L ${cx + hW * 0.5} ${legY}
    L ${cx + hW} ${hipY}
    C ${cx + hW} ${hipY - 8}, ${cx + wW} ${waistY + 10}, ${cx + wW} ${waistY}
    C ${cx + wW} ${waistY - 10}, ${cx + sW} ${shoulderY + 14}, ${cx + sW} ${shoulderY}
    Z
  `;

  return (
    <svg viewBox="0 0 60 124" className="w-10 h-16 shrink-0" fill="none" aria-hidden="true">
      <circle cx={cx} cy={10} r={7} stroke="currentColor" strokeWidth="1.5" />
      <path d={path} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function FindYourFitPage() {
  const navigate = useNavigate();

  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">("cm");
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");

  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [weight, setWeight] = useState("");

  const [gender, setGender] = useState("");
  const [bodyTypeSetOverride, setBodyTypeSetOverride] = useState<"female" | "male" | "neutral" | null>(null);
  const [bodyType, setBodyType] = useState<string | null>(null);

  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [bust, setBust] = useState("");
  const [waistMeasurement, setWaistMeasurement] = useState("");
  const [hips, setHips] = useState("");
  const [shoulderWidth, setShoulderWidth] = useState("");

  const bodyTypeOptions =
    bodyTypeSetOverride === "female" ? FEMALE_BODY_TYPES
    : bodyTypeSetOverride === "male" ? MALE_BODY_TYPES
    : bodyTypeSetOverride === "neutral" ? NEUTRAL_BODY_TYPES
    : gender === "Female" ? FEMALE_BODY_TYPES
    : gender === "Male" ? MALE_BODY_TYPES
    : NEUTRAL_BODY_TYPES;

  const handleGenderChange = (value: string) => {
    setGender(value);
    setBodyTypeSetOverride(null);
    setBodyType(null);
  };

  const cycleOverride = () => {
    setBodyTypeSetOverride((prev) =>
      prev === "female" ? "male" : prev === "male" ? "neutral" : "female"
    );
    setBodyType(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const height = heightUnit === "cm"
      ? { unit: "cm", value: heightCm }
      : { unit: "ftin", feet: heightFt, inches: heightIn };

    sessionStorage.setItem(
      "oakmonte_creator_fit",
      JSON.stringify({
        height,
        weight: { unit: weightUnit, value: weight },
        gender: gender || null,
        bodyType,
        measurements: measurementsOpen
          ? { bust, waist: waistMeasurement, hips, shoulderWidth }
          : null,
      })
    );

    navigate({ to: "/" });
  };

  const handleSkip = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/creator-niche" className="text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors">
          ← Back
        </Link>
        <button
          type="button"
          onClick={handleSkip}
          className="text-[11px] uppercase tracking-widest text-brand-text/60 hover:text-brand-text transition-colors"
        >
          Skip
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">Find your fit</h1>
          <p className="text-sm text-brand-text/70 mb-8">
            Let us recommend pieces exactly your size.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Height */}
            <div>
              <div className="flex items-center justify-end gap-3 mb-1.5 px-1">
                <button
                  type="button"
                  onClick={() => setHeightUnit("cm")}
                  className={`text-[11px] uppercase tracking-widest transition-colors ${heightUnit === "cm" ? "text-brand-accent" : "text-brand-text/40"}`}
                >
                  cm
                </button>
                <button
                  type="button"
                  onClick={() => setHeightUnit("ftin")}
                  className={`text-[11px] uppercase tracking-widest transition-colors ${heightUnit === "ftin" ? "text-brand-accent" : "text-brand-text/40"}`}
                >
                  ft/in
                </button>
              </div>
              {heightUnit === "cm" ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={heightCm}
                  onChange={(e) => setHeightCm(onlyDigits(e.target.value))}
                  placeholder="Height (cm)"
                  className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                />
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={heightFt}
                    onChange={(e) => setHeightFt(onlyDigits(e.target.value))}
                    placeholder="Feet"
                    className="flex-1 rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={heightIn}
                    onChange={(e) => setHeightIn(onlyDigits(e.target.value))}
                    placeholder="Inches"
                    className="flex-1 rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Weight */}
            <div>
              <div className="flex items-center justify-end gap-3 mb-1.5 px-1">
                <button
                  type="button"
                  onClick={() => setWeightUnit("kg")}
                  className={`text-[11px] uppercase tracking-widest transition-colors ${weightUnit === "kg" ? "text-brand-accent" : "text-brand-text/40"}`}
                >
                  kg
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit("lbs")}
                  className={`text-[11px] uppercase tracking-widest transition-colors ${weightUnit === "lbs" ? "text-brand-accent" : "text-brand-text/40"}`}
                >
                  lbs
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={weight}
                onChange={(e) => setWeight(onlyDigits(e.target.value))}
                placeholder={weightUnit === "kg" ? "Weight (kg)" : "Weight (lbs)"}
                className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
              />
            </div>

            <select
              value={gender}
              onChange={(e) => handleGenderChange(e.target.value)}
              className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm text-brand-text/80 focus:outline-none focus:border-brand-accent transition-colors"
            >
              <option value="">Gender (optional)</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>

            <div className="rounded-2xl border border-brand-text/15 overflow-hidden text-left">
              <button
                type="button"
                onClick={() => setMeasurementsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-brand-text/80 hover:bg-brand-text/5 transition-colors"
              >
                <span>Optional — add specific measurements</span>
                <span className={`transition-transform duration-200 ${measurementsOpen ? "rotate-90" : ""}`}>›</span>
              </button>
              {measurementsOpen && (
                <div className="px-5 pb-4 space-y-3 border-t border-brand-text/10 pt-4">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bust}
                    onChange={(e) => setBust(onlyDigits(e.target.value))}
                    placeholder={gender === "Male" ? "Chest (cm)" : "Bust (cm)"}
                    className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={waistMeasurement}
                    onChange={(e) => setWaistMeasurement(onlyDigits(e.target.value))}
                    placeholder="Waist (cm)"
                    className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={hips}
                    onChange={(e) => setHips(onlyDigits(e.target.value))}
                    placeholder="Hips (cm)"
                    className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={shoulderWidth}
                    onChange={(e) => setShoulderWidth(onlyDigits(e.target.value))}
                    placeholder="Shoulder width (cm)"
                    className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              )}
            </div>

            <div className="pt-4 text-left">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-brand-text/70">Pick a close resembling body type.</p>
                <button
                  type="button"
                  onClick={cycleOverride}
                  className="text-[11px] uppercase tracking-widest text-brand-text/50 hover:text-brand-text transition-colors shrink-0 ml-2"
                >
                  See other options
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
                {bodyTypeOptions.map((option) => {
                  const isSelected = bodyType === option.name;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => setBodyType(option.name)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 px-3 shrink-0 snap-start transition-all duration-200 ${
                        isSelected
                          ? "bg-brand-text text-brand-bg border-brand-text"
                          : "bg-transparent text-brand-text border-brand-text/25 hover:border-brand-text/50"
                      }`}
                    >
                      <BodySilhouette {...option} />
                      <span className="text-[11px] leading-tight whitespace-nowrap">{option.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-brand-text/50 px-2 pt-2">
              The information collected here is strictly for content and piece
              recommendation and is not meant to be or seem intrusive or abusive
              in any way.
            </p>

            <button
              type="submit"
              className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 mt-2"
            >
              Next
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}