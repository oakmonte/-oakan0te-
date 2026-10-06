import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { getDisplayNameFromUser } from "@/lib/auth";
import { readIntent, type Intent } from "@/lib/onboarding-state";
import { flowFor, nextRoute, stepPosition } from "@/lib/onboarding-flow";
import {
  FormError,
  OnboardingChecking,
  OnboardingShell,
} from "@/components/onboarding/OnboardingShell";
import { WheelField } from "@/components/onboarding/WheelField";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { usePrefetchNextStep } from "@/hooks/use-prefetch-next-step";
import {
  USERNAME_MAX as MAX,
  normalizeUsername as normalize,
  validateUsername as validate,
} from "@/lib/username-rules";

export const Route = createFileRoute("/choose-username")({
  head: () => ({
    // White page, so the iOS status strip must be white too — the root
    // default is #000000 and would otherwise paint a black band above it.
    meta: [{ title: "Choose a username — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: ChooseUsernamePage,
});

type Availability = "idle" | "checking" | "available" | "taken" | "error";

const DISPLAY_NAME_MAX = 25;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const MIN_YEAR = 1920;
// What the wheel shows before anyone touches it. Never saved unless engaged.
const DEFAULT_DOB = { day: 15, month: 6, year: 2000 };

const GENDER_OPTIONS = ["Female", "Male", "prefer not to say"] as const;

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ChooseUsernamePage() {
  const navigate = useNavigate();
  const { userId, checking } = useRequireSession();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("");
  const [dobDay, setDobDay] = useState(DEFAULT_DOB.day);
  const [dobMonth, setDobMonth] = useState(DEFAULT_DOB.month);
  const [dobYear, setDobYear] = useState(DEFAULT_DOB.year);
  // The wheel always shows a date, so whether it was actually answered has to
  // be tracked separately -- see WheelField.
  const [dobEngaged, setDobEngaged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read after mount: reading storage during render made the server and the
  // client disagree and produced a hydration mismatch.
  const [intent, setIntentState] = useState<Intent | null>(null);
  usePrefetchNextStep(intent, "/choose-username");
  const [availability, setAvailability] = useState<Availability>("idle");

  const thisYear = new Date().getFullYear();
  // 31 on a 30-day month would be an impossible date, so the day wheel's range
  // follows the month and a day left over from a longer month is pulled back.
  const dayCount = daysInMonth(dobYear, dobMonth);
  const dayShown = Math.min(dobDay, dayCount);

  useEffect(() => {
    setIntentState(readIntent() ?? "seller");
  }, []);

  // Prefill if they've been here before — a later step's "Back" link lands
  // here, and this step has to be re-enterable for that to be worth offering.
  // A display name from the sign-in provider (Google/Apple's real name) is a
  // fair starting point; nothing is derived from the email address.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [{ data }, { data: authData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("personal_username, display_name, gender, account_type, date_of_birth")
          .eq("id", userId)
          .maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      const providerName = getDisplayNameFromUser(authData.user);
      if (!data) {
        if (providerName) setDisplayName(providerName.slice(0, DISPLAY_NAME_MAX));
        return;
      }
      setUsername(data.personal_username ?? "");
      setDisplayName((data.display_name ?? providerName ?? "").slice(0, DISPLAY_NAME_MAX));
      setGender(data.gender ?? "");
      if (data.account_type) setIntentState(data.account_type as Intent);
      if (data.date_of_birth) {
        const [y, m, d] = data.date_of_birth.split("-").map(Number);
        if (y && m && d) {
          setDobYear(y);
          setDobMonth(m);
          setDobDay(d);
          setDobEngaged(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const step = stepPosition(intent, "/choose-username");
  const problem = username ? validate(username) : null;
  // Creators and curators answer this on /find-your-fit later in their flow —
  // asking again here would just be redundant. Sellers never see that step, so
  // they still need to be asked here.
  const asksGenderElsewhere = flowFor(intent).includes("/find-your-fit");

  // Debounced live check — a hint only. The upsert's unique-constraint error
  // on submit is still the authoritative check, since a name freed or taken
  // between typing and submitting can't be caught here.
  useEffect(() => {
    if (problem || !username) {
      setAvailability("idle");
      return;
    }
    let cancelled = false;
    setAvailability("checking");
    const timeout = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("is_username_available", {
        check_username: username,
      });
      if (cancelled) return;
      if (rpcError) {
        console.error("username availability check failed", rpcError);
        setAvailability("error");
        return;
      }
      setAvailability(data ? "available" : "taken");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [username, problem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    const name = displayName.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Add your display name.");
      return;
    }

    const formatProblem = validate(username);
    if (formatProblem) {
      setError(formatProblem);
      return;
    }

    if (!dobEngaged) {
      setError("Scroll to your date of birth.");
      return;
    }
    const dob = `${dobYear}-${pad(dobMonth)}-${pad(dayShown)}`;
    if (new Date(dobYear, dobMonth - 1, dayShown) > new Date()) {
      setError("That date of birth is in the future.");
      return;
    }

    setError(null);
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're no longer signed in. Please sign in again.");
      setLoading(false);
      return;
    }

    // profiles.personal_email is NOT NULL, and Supabase users can reach this
    // point without one (phone auth, or an OAuth provider that withheld it).
    if (!user.email) {
      setError("Your account has no email address. Please sign in with an email instead.");
      setLoading(false);
      return;
    }

    const resolvedIntent = intent ?? readIntent() ?? "seller";

    // upsert, not insert: re-entering this step (via a later step's Back link,
    // or by resuming an abandoned flow) used to hit the primary key and report
    // "that username is taken", trapping the user in an unwinnable rename loop.
    // Columns absent from this payload — referral_source, bio — are untouched.
    const { error: writeError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        personal_username: username,
        display_name: name,
        personal_email: user.email,
        gender: gender || null,
        date_of_birth: dob,
        account_type: resolvedIntent,
      },
      { onConflict: "id" },
    );

    setLoading(false);

    if (writeError) {
      // The only unique constraint left that a user can collide with.
      if (writeError.code === "23505") {
        setError("That username is taken. Try another.");
      } else {
        setError("Something went wrong. Please try again.");
        console.error(writeError);
      }
      return;
    }

    navigate({ to: nextRoute(resolvedIntent, "/choose-username"), replace: true });
  };

  if (checking) return <OnboardingChecking />;

  const fieldClass =
    "w-full min-w-0 rounded-full border border-brand-text/25 bg-transparent px-4 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors";

  return (
    <OnboardingShell
      title="Tell us about you"
      subtitle="Your display name is how you appear. Your handle is your unique @name."
      step={step}
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-left" noValidate>
        <div className="space-y-3">
          <div>
            <label htmlFor="display-name" className="sr-only">
              Display name
            </label>
            <input
              id="display-name"
              type="text"
              required
              autoFocus
              autoComplete="name"
              autoCapitalize="words"
              maxLength={DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="username" className="sr-only">
              Handle
            </label>
            <div className="flex w-full min-w-0 items-center rounded-full border border-brand-text/25 pl-4 pr-3 transition-colors focus-within:border-brand-accent">
              <span aria-hidden="true" className="text-sm text-brand-text/50">
                @
              </span>
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                maxLength={MAX}
                value={username}
                onChange={(e) => setUsername(normalize(e.target.value))}
                placeholder="handle"
                aria-describedby="username-hint"
                aria-invalid={problem ? true : undefined}
                className="w-full min-w-0 bg-transparent py-3.5 pl-0.5 text-sm placeholder:text-brand-text/40 focus:outline-none"
              />
            </div>
          </div>
        </div>
        {(problem || availability !== "idle") && (
          <p
            id="username-hint"
            className={`text-[11px] px-2 text-left ${
              availability === "taken" ? "text-red-500" : "text-brand-text/50"
            }`}
          >
            {problem ??
              (availability === "checking"
                ? "Checking availability…"
                : availability === "taken"
                  ? "That handle is taken."
                  : availability === "available"
                    ? "Available."
                    : "Couldn't check that right now.")}
          </p>
        )}

        {!asksGenderElsewhere && (
          // Tap buttons rather than a native <select>: on Android the system
          // picker is a separate window that jumped to the top of the page when
          // opened, which read as the page breaking.
          <div role="group" aria-label="Gender (optional)" className="grid grid-cols-2 gap-2 pt-3">
            {GENDER_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={gender === option}
                onClick={() => setGender(gender === option ? "" : option)}
                className={`rounded-full border px-3 py-3.5 text-sm transition-colors ${
                  option === "prefer not to say" ? "col-span-2" : ""
                } ${
                  gender === option
                    ? "border-brand-accent bg-brand-accent text-brand-bg"
                    : "border-brand-text/25 text-brand-text/80 hover:border-brand-text/50"
                }`}
              >
                {option === "prefer not to say" ? "Prefer not to say" : option}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-3" role="presentation">
          <span className="h-px flex-1 bg-brand-text/15" />
          <span className="text-[11px] uppercase tracking-widest text-brand-text/50">
            Date of birth
          </span>
          <span className="h-px flex-1 bg-brand-text/15" />
        </div>

        <WheelField
          engaged={dobEngaged}
          onEngage={() => {
            setDobDay(dayShown);
            setDobEngaged(true);
          }}
          columns={[
            {
              min: 1,
              max: dayCount,
              value: dayShown,
              onChange: setDobDay,
            },
            {
              min: 1,
              max: 12,
              labels: MONTHS,
              value: dobMonth,
              onChange: setDobMonth,
            },
            {
              min: MIN_YEAR,
              max: thisYear,
              value: dobYear,
              onChange: setDobYear,
            },
          ]}
        />
        <p className="text-center text-[11px] text-brand-text/50">
          Only used to confirm your age. It&rsquo;s never shown on your profile.
        </p>

        <button
          type="submit"
          disabled={
            loading ||
            !displayName.trim() ||
            !username ||
            Boolean(problem) ||
            availability === "taken" ||
            !dobEngaged
          }
          className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-40"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
        <FormError>{error}</FormError>
      </form>
    </OnboardingShell>
  );
}
