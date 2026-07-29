import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/find-your-fit")({
  head: () => ({ meta: [{ title: "Find your fit — Oakmonte" }] }),
  component: FindYourFitPage,
});

// Legacy parametric shape — still used by MALE_BODY_TYPES / NEUTRAL_BODY_TYPES
// until those get traced references too.
type ParametricBodyShape = {
  id: string;
  shoulder: number;
  bust: number;
  waist: number;
  hip: number;
  thigh: number;
};

// New traced shape — used by FEMALE_BODY_TYPES.
type TracedBodyShape = {
  id: string;
  viewBox: string;
  outline: string;
  extras?: string[];
};

type BodyShape = ParametricBodyShape | TracedBodyShape;

function isTraced(shape: BodyShape): shape is TracedBodyShape {
  return "outline" in shape;
}

const FEMALE_BODY_TYPES: TracedBodyShape[] = [
  {
    id: "f-plus-moderate",
    viewBox: "0 0 1043 1508",
    outline: "M 512 19 L 499 22 L 484 29 L 478 33 L 467 44 L 457 61 L 454 71 L 453 83 L 452 84 L 453 102 L 446 104 L 442 111 L 442 122 L 447 139 L 453 151 L 456 154 L 461 156 L 464 168 L 469 177 L 469 198 L 467 207 L 456 215 L 417 232 L 385 236 L 373 240 L 361 246 L 349 255 L 341 263 L 331 277 L 324 290 L 312 326 L 308 346 L 307 358 L 306 359 L 299 417 L 290 460 L 284 478 L 278 486 L 268 506 L 259 535 L 253 567 L 253 572 L 252 573 L 248 604 L 243 629 L 241 634 L 241 638 L 232 672 L 228 697 L 226 702 L 223 721 L 218 740 L 218 753 L 221 762 L 226 791 L 238 805 L 255 821 L 262 819 L 266 822 L 269 822 L 272 819 L 272 814 L 275 810 L 275 804 L 273 801 L 274 799 L 273 794 L 271 791 L 264 786 L 269 777 L 268 746 L 275 720 L 275 706 L 271 686 L 277 671 L 297 634 L 298 637 L 292 658 L 289 680 L 288 681 L 286 711 L 285 712 L 285 742 L 286 743 L 288 771 L 289 772 L 292 793 L 296 806 L 296 810 L 306 843 L 306 846 L 310 856 L 310 859 L 313 865 L 314 871 L 336 934 L 349 964 L 352 997 L 355 1011 L 355 1020 L 352 1029 L 352 1033 L 346 1058 L 344 1080 L 343 1081 L 343 1118 L 344 1119 L 344 1127 L 345 1128 L 345 1135 L 351 1166 L 362 1206 L 369 1225 L 369 1228 L 381 1265 L 385 1281 L 385 1286 L 388 1298 L 388 1306 L 389 1307 L 389 1313 L 387 1321 L 388 1347 L 377 1376 L 363 1403 L 356 1412 L 355 1415 L 355 1425 L 359 1430 L 365 1431 L 370 1436 L 378 1436 L 384 1440 L 388 1440 L 392 1438 L 397 1442 L 407 1442 L 413 1438 L 420 1443 L 433 1444 L 438 1443 L 445 1439 L 449 1432 L 449 1429 L 456 1422 L 458 1416 L 458 1406 L 456 1400 L 456 1395 L 459 1392 L 462 1385 L 462 1374 L 461 1373 L 461 1368 L 458 1355 L 458 1348 L 457 1347 L 461 1329 L 461 1322 L 458 1308 L 459 1288 L 460 1287 L 461 1274 L 465 1254 L 485 1186 L 494 1146 L 495 1131 L 496 1130 L 496 1118 L 497 1117 L 497 1097 L 496 1096 L 495 1071 L 494 1070 L 492 1045 L 491 1044 L 491 1031 L 502 1003 L 508 978 L 511 949 L 512 948 L 512 940 L 513 939 L 513 931 L 514 930 L 514 922 L 517 906 L 519 879 L 520 878 L 522 886 L 522 896 L 523 897 L 524 913 L 525 914 L 526 929 L 528 937 L 528 946 L 529 947 L 530 964 L 531 965 L 533 984 L 538 1005 L 548 1031 L 547 1053 L 546 1054 L 544 1081 L 543 1082 L 543 1094 L 542 1095 L 542 1116 L 543 1117 L 543 1129 L 544 1130 L 545 1146 L 548 1158 L 548 1163 L 552 1176 L 552 1180 L 573 1252 L 573 1256 L 577 1271 L 578 1284 L 579 1285 L 580 1312 L 578 1320 L 578 1329 L 581 1340 L 581 1354 L 577 1375 L 577 1384 L 579 1390 L 584 1395 L 582 1404 L 582 1416 L 585 1423 L 591 1429 L 593 1436 L 598 1441 L 602 1443 L 616 1444 L 623 1442 L 627 1438 L 633 1442 L 642 1442 L 648 1438 L 652 1440 L 659 1439 L 663 1435 L 669 1436 L 676 1431 L 681 1430 L 685 1426 L 686 1423 L 685 1412 L 678 1403 L 665 1378 L 652 1345 L 653 1340 L 653 1319 L 652 1318 L 651 1308 L 652 1307 L 653 1292 L 659 1265 L 687 1175 L 696 1129 L 697 1081 L 696 1080 L 696 1071 L 695 1070 L 693 1050 L 686 1021 L 686 1011 L 690 991 L 692 964 L 712 914 L 733 851 L 733 848 L 739 831 L 747 801 L 753 769 L 754 751 L 755 750 L 755 704 L 754 703 L 754 693 L 753 692 L 753 684 L 752 683 L 750 665 L 744 639 L 742 635 L 743 633 L 759 660 L 770 686 L 770 692 L 768 697 L 767 708 L 766 709 L 766 716 L 767 717 L 767 725 L 773 744 L 772 775 L 774 782 L 777 785 L 768 794 L 768 802 L 766 805 L 766 810 L 769 814 L 769 818 L 771 821 L 774 822 L 779 819 L 784 821 L 788 820 L 802 807 L 816 790 L 816 785 L 819 774 L 820 764 L 823 755 L 824 745 L 816 708 L 815 698 L 811 684 L 809 669 L 802 643 L 802 639 L 800 634 L 800 630 L 794 605 L 784 539 L 774 506 L 767 491 L 757 475 L 750 452 L 742 411 L 733 340 L 728 318 L 721 297 L 714 282 L 705 268 L 692 254 L 681 246 L 669 240 L 657 236 L 647 235 L 646 234 L 638 234 L 637 233 L 629 233 L 598 221 L 584 214 L 574 206 L 573 201 L 573 178 L 579 166 L 581 157 L 589 152 L 594 143 L 598 133 L 601 118 L 600 109 L 598 105 L 595 103 L 590 104 L 589 103 L 590 81 L 587 66 L 584 58 L 577 46 L 570 38 L 560 30 L 551 25 L 536 20 L 513 19",
    extras: [],
  },
];

const MALE_BODY_TYPES: ParametricBodyShape[] = [
  { id: "m1", shoulder: 0.45, bust: 0.4, waist: 0.38, hip: 0.4, thigh: 0.38 },
  { id: "m2", shoulder: 0.55, bust: 0.48, waist: 0.42, hip: 0.45, thigh: 0.42 },
  { id: "m3", shoulder: 0.68, bust: 0.58, waist: 0.45, hip: 0.5, thigh: 0.48 },
  { id: "m4", shoulder: 0.85, bust: 0.75, waist: 0.48, hip: 0.55, thigh: 0.58 },
  { id: "m5", shoulder: 0.65, bust: 0.65, waist: 0.68, hip: 0.62, thigh: 0.55 },
  { id: "m6", shoulder: 0.68, bust: 0.75, waist: 0.82, hip: 0.68, thigh: 0.6 },
  { id: "m7", shoulder: 0.72, bust: 0.88, waist: 0.95, hip: 0.78, thigh: 0.68 },
];

const NEUTRAL_BODY_TYPES: ParametricBodyShape[] = [
  { id: "n1", shoulder: 0.5, bust: 0.5, waist: 0.42, hip: 0.5, thigh: 0.45 },
  { id: "n2", shoulder: 0.65, bust: 0.55, waist: 0.48, hip: 0.55, thigh: 0.5 },
  { id: "n3", shoulder: 0.55, bust: 0.6, waist: 0.42, hip: 0.68, thigh: 0.58 },
  { id: "n4", shoulder: 0.78, bust: 0.62, waist: 0.55, hip: 0.6, thigh: 0.55 },
  { id: "n5", shoulder: 0.6, bust: 0.55, waist: 0.55, hip: 0.6, thigh: 0.55 },
];

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

// Legacy parametric silhouette — male/neutral only, for now.
function ParametricBodySilhouette({ shoulder, bust, waist, hip, thigh }: ParametricBodyShape) {
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

// New traced silhouette — female, and eventually all genders.
function TracedBodySilhouette({ viewBox, outline, extras }: TracedBodyShape) {
  const strokeScale = Number(viewBox.split(" ")[2]) || 1043;
  return (
    <svg viewBox={viewBox} className="w-28 h-52 shrink-0" fill="none" aria-hidden="true">
      <path
        d={outline}
        stroke="currentColor"
        strokeWidth={Math.max(1, strokeScale / 400)}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {extras?.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth={Math.max(1, strokeScale / 500)}
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
      ))}
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

  const bodyTypeOptions: BodyShape[] =
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
                      {isTraced(option) ? (
                        <TracedBodySilhouette {...option} />
                      ) : (
                        <ParametricBodySilhouette {...option} />
                      )}
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