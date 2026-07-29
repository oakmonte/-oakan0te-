import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/find-your-fit")({
  head: () => ({ meta: [{ title: "Find your fit — Oakmonte" }] }),
  component: FindYourFitPage,
});

type BodyShape = {
  id: string;
  shoulder: number;
  bust: number;
  waist: number;
  hip: number;
  thigh: number;
};

const FEMALE_BODY_TYPES: BodyShape[] = [
  { id: "f1", shoulder: 0.5, bust: 0.5, waist: 0.42, hip: 0.5, thigh: 0.45 },
  { id: "f2", shoulder: 0.55, bust: 0.55, waist: 0.48, hip: 0.58, thigh: 0.5 },
  { id: "f3", shoulder: 0.5, bust: 0.5, waist: 0.45, hip: 0.7, thigh: 0.55 },
  { id: "f4", shoulder: 0.5, bust: 0.5, waist: 0.45, hip: 0.78, thigh: 0.68 },
  { id: "f5", shoulder: 0.5, bust: 0.45, waist: 0.48, hip: 0.8, thigh: 0.72 },
  { id: "f6", shoulder: 0.6, bust: 0.85, waist: 0.55, hip: 0.65, thigh: 0.58 },
  { id: "f7", shoulder: 0.62, bust: 0.75, waist: 0.42, hip: 0.82, thigh: 0.65 },
  { id: "f8", shoulder: 0.7, bust: 0.55, waist: 0.48, hip: 0.58, thigh: 0.55 },
  { id: "f9", shoulder: 0.78, bust: 0.58, waist: 0.5, hip: 0.55, thigh: 0.58 },
];

const MALE_BODY_TYPES: BodyShape[] = [
  { id: "m1", shoulder: 0.45, bust: 0.4, waist: 0.38, hip: 0.4, thigh: 0.38 },
  { id: "m2", shoulder: 0.55, bust: 0.48, waist: 0.42, hip: 0.45, thigh: 0.42 },
  { id: "m3", shoulder: 0.68, bust: 0.58, waist: 0.45, hip: 0.5, thigh: 0.48 },
  { id: "m4", shoulder: 0.85, bust: 0.75, waist: 0.48, hip: 0.55, thigh: 0.58 },
  { id: "m5", shoulder: 0.65, bust: 0.65, waist: 0.68, hip: 0.62, thigh: 0.55 },
  { id: "m6", shoulder: 0.68, bust: 0.75, waist: 0.82, hip: 0.68, thigh: 0.6 },
  { id: "m7", shoulder: 0.72, bust: 0.88, waist: 0.95, hip: 0.78, thigh: 0.68 },
];

const NEUTRAL_BODY_TYPES: BodyShape[] = [
  { id: "n1", shoulder: 0.5, bust: 0.5, waist: 0.42, hip: 0.5, thigh: 0.45 },
  { id: "n2", shoulder: 0.65, bust: 0.55, waist: 0.48, hip: 0.55, thigh: 0.5 },
  { id: "n3", shoulder: 0.55, bust: 0.6, waist: 0.42, hip: 0.68, thigh: 0.58 },
  { id: "n4", shoulder: 0.78, bust: 0.62, waist: 0.55, hip: 0.6, thigh: 0.55 },
  { id: "n5", shoulder: 0.6, bust: 0.55, waist: 0.55, hip: 0.6, thigh: 0.55 },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function BodySilhouette({ shoulder, bust, waist, hip, thigh }: BodyShape) {
  const cx = 30;
  const w = (v: number) => 8 + v * 24;

  const sh = w(shoulder);
  const bu = w(bust);
  const wa = w(waist);
  const hi = w(hip);
  const th = w(thigh);

  const shoulderY = 20;
  const bustY = 36;
  const waistY = 58;
  const hipY = 78;
  const thighY = 96;
  const ankleY = 132;

  const path = `
    M ${cx - sh} ${shoulderY}
    C ${cx - sh} ${shoulderY + 8}, ${cx - bu} ${bustY - 6}, ${cx - bu} ${bustY}
    C ${cx - bu} ${bustY + 8}, ${cx - wa} ${waistY - 10}, ${cx - wa} ${waistY}
    C ${cx - wa} ${waistY + 8}, ${cx - hi} ${hipY - 8}, ${cx - hi} ${hipY}
    C ${cx - hi} ${hipY + 6}, ${cx - th} ${thighY - 6}, ${cx - th} ${thighY}
    L ${cx - th * 0.35} ${thighY + 6}
    L ${cx - hi * 0.12} ${ankleY}
    L ${cx + hi * 0.12} ${ankleY}
    L ${cx + th * 0.35} ${thighY + 6}
    L ${cx + th} ${thighY}
    C ${cx + th} ${thighY - 6}, ${cx + hi} ${hipY + 6}, ${cx + hi} ${hipY}
    C ${cx + hi} ${hipY - 8}, ${cx + wa} ${waistY + 8}, ${cx + wa} ${waistY}
    C ${cx + wa} ${waistY - 10}, ${cx + bu} ${bustY + 8}, ${cx + bu} ${bustY}
    C ${cx + bu} ${bustY - 6}, ${cx + sh} ${shoulderY + 8}, ${cx + sh} ${shoulderY}
    Z
  `;

  return (
    <svg viewBox="0 0 60 132" className="w-11 h-16 shrink-0" fill="none" aria-hidden="true">
      <circle cx={cx} cy={9} r={7} stroke="currentColor" strokeWidth="1.4" />
      <path d={path} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
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
  const [bodyType, setBodyType] = useState<string | null>(null);

  const [measurementsOpen, setMeasurementsOpen] = useState(false);
  const [bust, setBust] = useState("");
  const [waistMeasurement, setWaistMeasurement] = useState("");
  const [hips, setHips] = useState("");
  const [shoulderWidth, setShoulderWidth] = useState("");

  const bodyTypeOptions =
    gender === "Female" ? FEMALE_BODY_TYPES
    : gender === "Male" ? MALE_BODY_TYPES
    : NEUTRAL_BODY_TYPES;

  const handleGenderChange = (value: string) => {
    setGender(value);
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
              <p className="text-sm text-brand-text/70 mb-3">Pick a close resembling body type.</p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin">
                {bodyTypeOptions.map((option) => {
                  const isSelected = bodyType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setBodyType(option.id)}
                      aria-label={`Body type option ${option.id}`}
                      className={`flex items-center justify-center rounded-xl border py-3 px-3 shrink-0 snap-start transition-all duration-200 ${
                        isSelected
                          ? "bg-brand-text text-brand-bg border-brand-text"
                          : "bg-transparent text-brand-text border-brand-text/25 hover:border-brand-text/50"
                      }`}
                    >
                      <BodySilhouette {...option} />
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