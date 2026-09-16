import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { isStandalone } from "@/lib/standalone";
import { isPasswordResetPending, readIntent, setIntent, type Intent } from "@/lib/onboarding-state";

function callbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Legacy client-side guess — kept only in case something still imports it,
// but nothing in the app should call this anymore. Navigation always goes
// through resolvePostAuthRedirect, and display purposes should use
// getDisplayNameFromUser instead.
export function getProfileUsernameFromUser(
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null,
) {
  if (!user) return null;
  const candidates = [user.user_metadata?.full_name, user.user_metadata?.name, user.email];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const slug = slugify(candidate);
      if (slug) return slug;
    }
  }
  const fallback = user.email?.split("@")[0];
  return fallback ? slugify(fallback) : "account";
}

// For display purposes only (e.g. seeding profiles.display_name at signup).
// Not slugified, not used for routing. Returns null if the auth provider
// didn't give us a real name — caller decides the fallback (should be the
// chosen username, not an email-derived string).
export function getDisplayNameFromUser(
  user: { user_metadata?: Record<string, unknown> } | null,
): string | null {
  if (!user) return null;
  const candidates = [user.user_metadata?.full_name, user.user_metadata?.name];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export type PostAuthRedirect =
  | { to: "/profile/$username"; params: { username: string } }
  | { to: "/choose-username" }
  | { to: "/seller-type" }
  | { to: "/where-did-you-hear-about-us" }
  | { to: "/name-your-store" }
  | { to: "/find-your-fit" }
  | { to: "/whats-your-style" }
  | { to: "/switching-roles" }
  | { to: "/create-password" }
  | { to: "/no-account" };

/** Where this user's own profile lives, or the home page if they somehow have
 *  no profile row yet. Used to end every onboarding flow in the same place. */
export async function ownProfileRedirect(
  userId: string,
): Promise<{ to: "/profile/$username"; params: { username: string } } | { to: "/" }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("personal_username")
    .eq("id", userId)
    .maybeSingle();

  if (error) console.error("ownProfileRedirect: failed to read profile", error);

  return data?.personal_username
    ? ({ to: "/profile/$username", params: { username: data.personal_username } } as const)
    : ({ to: "/" } as const);
}

// Each role's identity table — a row's existence is that role's durable
// "onboarding for this role is done" signal (see the creators/curators
// migration and stores' pre-existing use below).
const ROLE_TABLE: Record<Intent, "creators" | "curators" | "stores"> = {
  seller: "stores",
  creator: "creators",
  curator: "curators",
};

/** Every role this account actually holds, independent of
 *  `profiles.account_type`. account_type is written once, at profile
 *  creation, and records only the *first* role someone picked — it's never
 *  updated when they pick up a second one (see resolvePostAuthRedirect's
 *  cross-role branch below), so it answers "what did they sign up as," not
 *  "what are they now." Anything that needs the latter — "does this account
 *  also sell," a multi-role badge, access gating — should call this instead
 *  of trusting account_type alone. */
export async function getUserRoles(userId: string): Promise<Intent[]> {
  const [storesRes, creatorsRes, curatorsRes] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase.from("creators").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase.from("curators").select("id", { count: "exact", head: true }).eq("owner_id", userId),
  ]);

  const roles: Intent[] = [];
  if (!storesRes.error && storesRes.count) roles.push("seller");
  if (!creatorsRes.error && creatorsRes.count) roles.push("creator");
  if (!curatorsRes.error && curatorsRes.count) roles.push("curator");
  return roles;
}

// Single source of truth for "where should this user land after auth."
//
// It resumes an unfinished flow rather than dropping a half-onboarded user on
// their profile page: before, any user with a username was sent straight to
// /profile, so anyone who abandoned the flow after choosing a username could
// never reach the remaining steps again.
export async function resolvePostAuthRedirect(
  userId: string,
  /** The intent of the page the user is standing on, when it knows. Passed
   *  explicitly because storage can silently fail (Safari private browsing),
   *  and a null read there used to bounce the user to /no-account forever. */
  intentHint?: Intent | null,
): Promise<PostAuthRedirect> {
  // Central password gate: checking it only inside AuthPanel.finish meant one
  // browser Back press skipped it and left the account without a password.
  // Central password gate. isPasswordResetPending covers the forgot-password
  // route, where the account already has a password so needsPassword is false
  // but the user has just been promised the chance to set a new one.
  const { data: userData } = await supabase.auth.getUser();
  if (needsPassword(userData.user) || isPasswordResetPending()) {
    return { to: "/create-password" } as const;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("personal_username, account_type, referral_source")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("resolvePostAuthRedirect: failed to check profile", error);
  }

  // Resolved once, here, and used for both checks below. Previously each used
  // `intentHint` directly, which is only ever passed by AuthPanel's own
  // sign-in/sign-up handlers — the Google OAuth round-trip and the
  // create-password flow both call this with no hint at all, relying
  // entirely on storage. That meant a seller who clicked "Become a Creator"
  // and signed in with Google skipped the cross-role branch below entirely
  // (intentHint was undefined) and fell through to `intent = account_type`,
  // silently continuing the *seller* flow instead of picking up the creator
  // role they'd just asked for — the acknowledgment page never fired and the
  // creator intent was dropped. Falling back to storage here, once, fixes it
  // for every caller instead of requiring each call site to remember to pass
  // a hint.
  const hint = intentHint ?? readIntent();

  if (!profile?.personal_username) {
    // No profile yet. If they came through one of the three entry points we
    // know what they want; otherwise ask.
    return hint ? ({ to: "/choose-username" } as const) : ({ to: "/no-account" } as const);
  }

  // A returning user picking up a role they don't already have (e.g. an
  // existing seller clicking "Become a Creator", or a creator clicking "Set
  // Up A Store") gets a beat to acknowledge that before the one remaining
  // step in that role's onboarding — everything else (username, referral
  // source) is already answered. Gated on the *target* role's own identity
  // row being absent, not on account_type alone, so re-clicking a role
  // you've already finished just goes straight to your profile like it
  // always has.
  if (hint && profile.account_type && profile.account_type !== hint) {
    const table = ROLE_TABLE[hint];
    const { count, error: roleError } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);
    if (roleError) console.error("resolvePostAuthRedirect: failed to check role", roleError);
    if (!roleError && !count) {
      // The acknowledgment page and find-your-fit both read intent back out
      // of storage rather than off a route param.
      setIntent(hint);
      return { to: "/switching-roles" } as const;
    }
  }

  // Which flow's remaining steps to check below — not "what roles does this
  // account hold" (see getUserRoles for that). account_type only ever records
  // the first role picked at signup; fall back to the resolved hint only for
  // profiles created before account_type existed.
  const intent = (profile.account_type as Intent | null) ?? hint ?? "seller";

  if (!profile.referral_source) {
    return intent === "seller"
      ? ({ to: "/seller-type" } as const)
      : ({ to: "/where-did-you-hear-about-us" } as const);
  }

  if (intent === "seller") {
    const { count, error: storeError } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);

    if (storeError) console.error("resolvePostAuthRedirect: failed to check store", storeError);
    if (!storeError && !count) return { to: "/name-your-store" } as const;
  }

  // Creator/curator onboarding's two differentiating steps (see FLOWS in
  // onboarding-flow.ts). creators/curators are pure role-membership markers —
  // the actual body/style data lives in fit_profiles, shared across both
  // roles, so someone who's already done this as (say) a creator never has to
  // answer the same questions again as a curator; picking up the second role
  // just records membership and reuses what's there.
  if (intent === "creator" || intent === "curator") {
    // Not ROLE_TABLE[intent]: that Record's value type is the union across
    // all three roles (including stores), so indexing it here wouldn't
    // narrow to a specific table.
    const table = intent === "curator" ? "curators" : "creators";
    const [{ count: roleCount, error: roleError }, { data: fitProfile, error: fitProfileError }] =
      await Promise.all([
        supabase.from(table).select("id", { count: "exact", head: true }).eq("owner_id", userId),
        supabase.from("fit_profiles").select("styles").eq("owner_id", userId).maybeSingle(),
      ]);
    if (roleError) console.error("resolvePostAuthRedirect: failed to check role", roleError);
    if (fitProfileError) {
      console.error("resolvePostAuthRedirect: failed to check fit profile", fitProfileError);
    }

    // No membership row yet — a creators/curators row is only ever written
    // when find-your-fit is submitted or skipped, so its absence means that
    // step was abandoned, not "nothing left to ask." Without this, closing
    // the tab on /find-your-fit was treated as fully onboarded on the next
    // sign-in.
    if (!roleError && !roleCount) {
      if (fitProfile) {
        // Fit data already exists from the other role — just record
        // membership here instead of asking find-your-fit/whats-your-style
        // again for a body that hasn't changed.
        const { error: insertError } = await supabase.from(table).insert({ owner_id: userId });
        if (insertError)
          console.error("resolvePostAuthRedirect: failed to record role", insertError);
      } else {
        return { to: "/find-your-fit" } as const;
      }
    } else if (
      !roleError &&
      roleCount &&
      !fitProfileError &&
      (!fitProfile || fitProfile.styles === null)
    ) {
      // Membership exists but styles is still null — same absence-means-
      // abandoned reasoning, one step later: /whats-your-style always writes
      // styles (even as an empty array) on submit or skip.
      return { to: "/whats-your-style" } as const;
    }
  }

  return { to: "/profile/$username", params: { username: profile.personal_username } } as const;
}

/** True when this account signs in by email and has no password set yet, so it
 *  would otherwise need a fresh emailed code on every single login. Google-only
 *  accounts never need one. */
export function needsPassword(user: User | null): boolean {
  if (!user) return false;
  if (user.user_metadata?.has_password === true) return false;
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [
    user.app_metadata?.provider,
  ];
  return providers.filter(Boolean).includes("email");
}

/** Google OAuth.
 *
 *  In a browser tab this is the ordinary redirect and it works.
 *
 *  The INSTALLED app is the hard case, and the history matters because each
 *  approach fails in a way that looks like the other one's bug.
 *
 *  This used to hand the sign-in to the real browser with `window.open`, to
 *  dodge iOS presenting a cross-origin navigation as a modal browser sheet —
 *  Google treats that sheet as an embedded webview, so there is no password
 *  box, and a passkey account is offered a QR code the sheet cannot complete.
 *
 *  That dodge was worse. Confirmed in production 2026-09-16: PKCE keeps its
 *  code verifier in the storage of whichever client STARTED the exchange. The
 *  installed app has its own storage jar, so Safari finished the round trip
 *  holding a code nobody could exchange while the app never saw it — users
 *  signed in on the website and still signed out in the app.
 *
 *  So the round trip now stays inside the app: one client starts and finishes
 *  it, one jar holds the verifier, and the callback lands where the session is
 *  needed. `skipBrowserRedirect` gives us the URL rather than navigating to
 *  it, and we navigate ourselves — which is the seam the fallback needs.
 *
 *  It popped a sheet anyway, and the sheet turned out to share the app's jar,
 *  so sign-in completed — but a sheet cannot reach the platform authenticator,
 *  so a passkey-first account got a QR code and no way forward. Hence the
 *  same-origin first hop through `/auth/start`, which iOS has no reason to
 *  intercept; the 302 out of it is a redirect, and redirects stay in the
 *  webview. See that route for why its target is pinned. */
export async function signInWithGoogle() {
  if (isStandalone()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(), skipBrowserRedirect: true },
    });
    if (error) return { data, error };
    // Same-origin first hop, so iOS has no navigation to intercept and the
    // flow stays in this webview -- where WebAuthn works. /auth/start pins the
    // target and 302s out. Not window.open, and not a direct cross-origin
    // assign: see above.
    if (data?.url) window.location.assign(`/auth/start?to=${encodeURIComponent(data.url)}`);
    return { data, error: null };
  }

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl() },
  });
}

/** Emails a 6-digit code. Deliberately no `emailRedirectTo`: the Supabase and
 *  Resend templates send `{{ .Token }}`, not a magic link, so there is no link
 *  for the user to click and no second tab for them to get stranded in. */
export async function sendEmailCode(email: string, { createUser = true } = {}) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: createUser } });
}

/** Whether an account already exists for this email — an explicit, accepted
 *  enumeration trade-off (see the is_email_registered migration) made so
 *  AuthPanel can tell a seller/creator/curator signup screen "you already
 *  have an account, sign in instead" and tell /sign-in "no account with that
 *  email yet" instead of only ever a generic, deliberately-vague error. */
export async function checkEmailRegistered(email: string) {
  return supabase.rpc("is_email_registered", { check_email: email });
}

export async function verifyEmailCode(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: "email" });
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** Sets the password on the current session's user. The `has_password` flag is
 *  what `needsPassword` reads later — Supabase gives the client no other way to
 *  tell whether a password exists. */
export async function setAccountPassword(password: string) {
  return supabase.auth.updateUser({ password, data: { has_password: true } });
}

export async function signOut() {
  return supabase.auth.signOut();
}
