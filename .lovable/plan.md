## Goal
Wire the existing `/set-up-store` and `/become-a-creator` pages to your external Supabase project so the "Continue with Google" button actually signs users in, plus a functional email magic-link flow. Since this project uses your own Supabase (not Lovable Cloud), we use the standard `supabase.auth.*` API directly from `@/integrations/my-supabase/client` — the Lovable managed OAuth broker (`lovable.auth.signInWithOAuth`) does not apply here.

## What gets built

1. **Google sign-in wired up (both pages)**
   - "Continue with Google" calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } })`.
   - Loading state on the button + inline error text if Supabase rejects.

2. **Email magic-link wired up (both pages)**
   - "Send" calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })`.
   - Preserves the existing "Check your email" UI + 30s resend countdown; resend re-invokes `signInWithOtp`.
   - Inline error on failure.

3. **New public route `/auth/callback`** (`src/routes/auth.callback.tsx`)
   - Waits for Supabase to hydrate the session from the URL fragment, then redirects to `/` (or a saved `?next=` path).
   - Shows a small "Signing you in…" state and an error state if hydration fails.

4. **Shared auth helper** (`src/lib/auth.ts`)
   - Small wrappers `signInWithGoogle()` and `sendMagicLink(email)` so both pages call the same code and we don't duplicate logic.

5. **Signed-in affordance in the header**
   - The homepage header currently always shows "Access Dashboard". After sign-in it will show the user's email (truncated) with a "Sign out" action in a small dropdown/menu; signed-out shows "Access Dashboard" as today.
   - Driven by a lightweight `useSession()` hook subscribing to `supabase.auth.onAuthStateChange`.

## What you need to have done in your Supabase dashboard (please confirm)

You said Google is already configured. For it to actually work I need these three to already be true on **your** Supabase project (`lzyflkrqexxuyxyudvbw`):
- Google provider enabled under **Authentication → Providers**.
- **Site URL** set to your production URL and **Redirect URLs** allowlist includes:
  - `http://localhost:8080/**`
  - `https://id-preview--20ab012d-c075-4dc0-92ec-39b0c7e4fbaa.lovable.app/**`
  - `https://oakmonte.store/**`, `https://www.oakmonte.store/**`, `https://oakmontetesting.lovable.app/**`
- Google Cloud OAuth client's **Authorized redirect URI** = `https://lzyflkrqexxuyxyudvbw.supabase.co/auth/v1/callback`.

If any are missing Google sign-in will fail with `redirect_uri_mismatch` or `Requested URL not allowed` — I'll surface those errors in the UI so we can see exactly what to fix.

## Out of scope (say the word to add)
- `profiles` table + trigger (needed only if you want to store display name / avatar / role).
- Separate "seller" vs "creator" onboarding — right now both pages will sign the same user in; role differentiation would need a `profiles` table.
- Protected `/dashboard` route behind an auth gate.

## Files touched
- **New:** `src/routes/auth.callback.tsx`, `src/lib/auth.ts`, `src/hooks/use-session.ts`
- **Edited:** `src/routes/set-up-store.tsx`, `src/routes/become-a-creator.tsx`, `src/routes/index.tsx` (header only)
