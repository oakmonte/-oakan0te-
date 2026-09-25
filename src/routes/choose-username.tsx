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

function ChooseUsernamePage() {
  const navigate = useNavigate();
  const { userId, checking } = useRequireSession();
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read after mount: reading storage during render made the server and the
  // client disagree and produced a hydration mismatch.
  const [intent, setIntentState] = useState<Intent | null>(null);
  usePrefetchNextStep(intent, "/choose-username");
  const [availability, setAvailability] = useState<Availability>("idle");

  useEffect(() => {
    setIntentState(readIntent() ?? "seller");
  }, []);

  // Prefill if they've been here before — a later step's "Back" link lands
  // here, and this step has to be re-enterable for that to be worth offering.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("personal_username, gender, account_type")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setUsername(data.personal_username ?? "");
        setGender(data.gender ?? "");
        if (data.account_type) setIntentState(data.account_type as Intent);
      });
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

    const formatProblem = validate(username);
    if (formatProblem) {
      setError(formatProblem);
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
        display_name: getDisplayNameFromUser(user) ?? username,
        personal_email: user.email,
        gender: gender || null,
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

  return (
    <OnboardingShell
      title="Choose a personal username"
      subtitle="You can set a separate display and store/brand name later."
      step={step}
    >
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <label htmlFor="username" className="sr-only">
          Username
        </label>
        <input
          id="username"
          type="text"
          required
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={MAX}
          value={username}
          onChange={(e) => setUsername(normalize(e.target.value))}
          placeholder="Username"
          aria-describedby="username-hint"
          aria-invalid={problem ? true : undefined}
          className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
        />
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
                ? "That username is taken."
                : availability === "available"
                  ? "Available."
                  : `oakmonte.com/profile/${username || "your-name"}`)}
        </p>

        {!asksGenderElsewhere && (
          <>
            <label htmlFor="gender" className="sr-only">
              Gender (optional)
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm text-brand-text/80 focus:outline-none focus:border-brand-accent transition-colors"
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="prefer not to say">Prefer not to say</option>
            </select>
          </>
        )}

        <button
          type="submit"
          disabled={loading || !username || Boolean(problem) || availability === "taken"}
          className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-40"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
        <FormError>{error}</FormError>
      </form>
    </OnboardingShell>
  );
}
